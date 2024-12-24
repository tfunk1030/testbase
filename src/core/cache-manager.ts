import { TrajectoryResult, BallState, Environment, BallProperties, LaunchConditions } from './types';
import { PerformanceMonitor } from './performance-monitor';
import { CacheAnalytics } from './cache-analytics';

interface CacheEntry {
    trajectory: TrajectoryResult;
    timestamp: number;
    accessCount: number;
    size: number;
    frequency: number;
    lastAccess: number;
}

export class CacheManager {
    private static instance: CacheManager;
    private readonly cache: Map<string, CacheEntry> = new Map();
    private readonly monitor = PerformanceMonitor.getInstance();
    private readonly analytics = CacheAnalytics.getInstance();
    private readonly maxSize: number;
    private readonly maxAge: number;
    private readonly cleanupInterval: number;
    private currentSize: number = 0;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private readonly preloadPatterns: Set<string> = new Set();
    private readonly frequencyWindow: number = 300000;

    private constructor(
        maxSizeMB: number = 100,
        maxAgeSeconds: number = 3600,
        cleanupIntervalSeconds: number = 300
    ) {
        this.maxSize = maxSizeMB * 1024 * 1024;
        this.maxAge = maxAgeSeconds * 1000;
        this.cleanupInterval = cleanupIntervalSeconds * 1000;
        this.startCleanupTimer();
        this.initializePreloadPatterns();
    }

    public static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    private initializePreloadPatterns(): void {
        const commonConditions = [
            { speed: 160, angle: 12, spin: 2500 },
            { speed: 130, angle: 16, spin: 3000 },
            { speed: 120, angle: 20, spin: 3500 },
            { speed: 100, angle: 26, spin: 4500 }
        ];

        commonConditions.forEach(condition => {
            const pattern = this.generatePreloadPattern(condition);
            this.preloadPatterns.add(pattern);
        });
    }

    private generatePreloadPattern(condition: { speed: number, angle: number, spin: number }): string {
        return `${condition.speed}_${condition.angle}_${condition.spin}`;
    }

    public async preloadCache(environment: Environment, properties: BallProperties): Promise<void> {
        const preloadPromises: Promise<void>[] = [];

        for (const pattern of this.preloadPatterns) {
            const [speed, angle, spin] = pattern.split('_').map(Number);
            const conditions: LaunchConditions = {
                ballSpeed: speed,
                launchAngle: angle,
                spinRate: spin,
                spinAxis: { x: 0, y: 1, z: 0 }
            };

            const promise = this.preloadTrajectory(conditions, environment, properties);
            preloadPromises.push(promise);
        }

        await Promise.all(preloadPromises);
    }

    private async preloadTrajectory(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<void> {
        const key = this.generateCacheKey(conditions, environment, properties);
        if (!this.cache.has(key)) {
            const trajectory = await this.calculateTrajectory(conditions, environment, properties);
            this.set(key, trajectory);
        }
    }

    private generateCacheKey(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): string {
        return JSON.stringify({
            conditions,
            environment: {
                temperature: Math.round(environment.temperature),
                pressure: Math.round(environment.pressure * 100) / 100,
                humidity: Math.round(environment.humidity * 100) / 100,
                altitude: Math.round(environment.altitude)
            },
            properties: {
                mass: properties.mass,
                diameter: properties.diameter,
                cd: Math.round(properties.cd * 1000) / 1000,
                cl: Math.round(properties.cl * 1000) / 1000
            }
        });
    }

    public get(key: string, operationId: string): TrajectoryResult | null {
        const startTime = performance.now();
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.monitor.recordCacheMiss(operationId);
            this.analytics.recordAccess(key, false, 0);
            return null;
        }

        const now = Date.now();
        const age = now - entry.timestamp;
        if (age > this.maxAge) {
            this.cache.delete(key);
            this.currentSize -= entry.size;
            this.monitor.recordCacheMiss(operationId);
            this.analytics.recordEviction(key);
            this.analytics.recordAccess(key, false, entry.size);
            return null;
        }

        entry.accessCount++;
        entry.lastAccess = now;
        entry.frequency = entry.accessCount / ((now - entry.timestamp) / this.frequencyWindow);

        this.monitor.recordCacheHit(operationId);
        this.analytics.recordAccess(key, true, entry.size);
        
        this.analytics.recordMemoryUsage({
            total: process.memoryUsage().heapTotal,
            used: process.memoryUsage().heapUsed,
            timestamp: new Date()
        });
        
        return entry.trajectory;
    }

    public set(key: string, trajectory: TrajectoryResult): void {
        const size = this.calculateSize(trajectory);

        const recommendations = this.analytics.getRecommendations();
        const evictionRecommendations = recommendations
            .filter(r => r.type === 'evict')
            .map(r => r.suggestedAction.split(':')[0].trim());

        if (this.currentSize + size > this.maxSize) {
            for (const evictKey of evictionRecommendations) {
                if (this.cache.has(evictKey)) {
                    const entry = this.cache.get(evictKey)!;
                    this.cache.delete(evictKey);
                    this.currentSize -= entry.size;
                    this.analytics.recordEviction(evictKey);
                    
                    if (this.currentSize + size <= this.maxSize) {
                        break;
                    }
                }
            }
        }

        while (this.currentSize + size > this.maxSize) {
            if (!this.evictLeastValuable()) {
                return;
            }
        }

        const now = Date.now();
        this.cache.set(key, {
            trajectory,
            timestamp: now,
            lastAccess: now,
            accessCount: 1,
            frequency: 1 / this.frequencyWindow,
            size
        });

        this.currentSize += size;
        
        this.analytics.recordMemoryUsage({
            total: process.memoryUsage().heapTotal,
            used: process.memoryUsage().heapUsed,
            timestamp: new Date()
        });
    }

    private evictLeastValuable(): boolean {
        let leastValuable: [string, CacheEntry] | null = null;
        let minValue = Infinity;

        const recommendations = this.analytics.getRecommendations();
        const evictionScores = recommendations
            .filter(r => r.type === 'evict')
            .reduce((acc, r) => {
                const [key, score] = r.suggestedAction.split(':').map(s => s.trim());
                acc[key] = parseFloat(score);
                return acc;
            }, {} as Record<string, number>);

        for (const [key, entry] of this.cache.entries()) {
            const age = Date.now() - entry.timestamp;
            const analyticsScore = evictionScores[key] || 0;
            const value = (entry.frequency * (this.maxAge - age) / entry.size) - analyticsScore;
            if (value < minValue) {
                minValue = value;
                leastValuable = [key, entry];
            }
        }

        if (leastValuable) {
            const [key, entry] = leastValuable;
            this.cache.delete(key);
            this.currentSize -= entry.size;
            this.analytics.recordEviction(key);
            return true;
        }

        return false;
    }

    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    private cleanup(): void {
        const startTime = performance.now();
        const now = Date.now();
        let removedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                this.cache.delete(key);
                this.currentSize -= entry.size;
                removedCount++;
            }
        }

        this.analytics.recordCleanup(performance.now() - startTime);
    }

    public clear(): void {
        this.cache.clear();
        this.currentSize = 0;
    }

    public getStats(): {
        size: number;
        hitRate: number;
        averageAge: number;
        memoryUsage: number;
        entryCount: number;
    } {
        let totalHits = 0;
        let totalAccesses = 0;
        let totalAge = 0;
        const now = Date.now();

        for (const entry of this.cache.values()) {
            totalHits += entry.accessCount - 1;
            totalAccesses += entry.accessCount;
            totalAge += now - entry.timestamp;
        }

        return {
            size: this.cache.size,
            hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
            averageAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
            memoryUsage: this.currentSize,
            entryCount: this.cache.size
        };
    }

    public getEntries(): CacheEntry[] {
        return Array.from(this.cache.values());
    }

    private roundVector(vec: { x: number, y: number, z: number }, decimals: number): { x: number, y: number, z: number } {
        const factor = Math.pow(10, decimals);
        return {
            x: Math.round(vec.x * factor) / factor,
            y: Math.round(vec.y * factor) / factor,
            z: Math.round(vec.z * factor) / factor
        };
    }

    private calculateSize(trajectory: TrajectoryResult): number {
        let size = 0;

        for (const point of trajectory.points) {
            size += (24 + 24 + 32 + 96 + 8);
        }

        if (trajectory.metrics) {
            size += 48;
        }

        return size;
    }

    private extractPattern(key: string): string {
        // Extract the general pattern from the cache key
        // Example: "v=70,a=12,s=2500" -> "v=70-80,a=10-15,s=2000-3000"
        const parts = key.split(',');
        return parts.map(part => {
            const [name, value] = part.split('=');
            const num = parseFloat(value);
            if (isNaN(num)) return part;
            
            // Create range buckets
            const bucket = Math.floor(num / 10) * 10;
            return `${name}=${bucket}-${bucket + 10}`;
        }).join(',');
    }
}
