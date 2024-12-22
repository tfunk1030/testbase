import { TrajectoryResult, BallState, Environment, BallProperties } from './types';
import { PerformanceMonitor } from './performance-monitor';

interface CacheEntry {
    trajectory: TrajectoryResult;
    timestamp: number;
    accessCount: number;
    size: number;  // Approximate size in bytes
}

export class CacheManager {
    private static instance: CacheManager;
    private readonly cache: Map<string, CacheEntry> = new Map();
    private readonly monitor = PerformanceMonitor.getInstance();
    private readonly maxSize: number;  // Maximum cache size in bytes
    private readonly maxAge: number;   // Maximum age in milliseconds
    private readonly cleanupInterval: number;  // Cleanup interval in milliseconds
    private currentSize: number = 0;
    private cleanupTimer: NodeJS.Timeout | null = null;

    private constructor(
        maxSizeMB: number = 100,
        maxAgeSeconds: number = 3600,
        cleanupIntervalSeconds: number = 300
    ) {
        this.maxSize = maxSizeMB * 1024 * 1024;
        this.maxAge = maxAgeSeconds * 1000;
        this.cleanupInterval = cleanupIntervalSeconds * 1000;
        this.startCleanupTimer();
    }

    public static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    public get(key: string, operationId: string): TrajectoryResult | null {
        const entry = this.cache.get(key);
        if (!entry) {
            this.monitor.recordCacheMiss(operationId);
            return null;
        }

        const age = Date.now() - entry.timestamp;
        if (age > this.maxAge) {
            this.cache.delete(key);
            this.currentSize -= entry.size;
            this.monitor.recordCacheMiss(operationId);
            return null;
        }

        entry.accessCount++;
        entry.timestamp = Date.now();
        this.monitor.recordCacheHit(operationId);
        return entry.trajectory;
    }

    public set(key: string, trajectory: TrajectoryResult): void {
        const size = this.calculateSize(trajectory);

        // If single entry is too large, don't cache it
        if (size > this.maxSize * 0.1) {
            return;
        }

        // Make space if needed
        while (this.currentSize + size > this.maxSize) {
            if (!this.evictLeastValuable()) {
                // If we can't evict anything, don't cache new entry
                return;
            }
        }

        const entry: CacheEntry = {
            trajectory,
            timestamp: Date.now(),
            accessCount: 1,
            size
        };

        this.cache.set(key, entry);
        this.currentSize += size;
    }

    public generateKey(
        state: BallState | null,
        environment: Environment,
        properties: BallProperties,
        additionalParams: Record<string, any> = {}
    ): string {
        // Use a more compact key format
        const keyObj = {
            s: state ? {
                p: this.roundVector(state.position, 2),
                v: this.roundVector(state.velocity, 2),
                s: {
                    r: Math.round(state.spin.rate / 100) * 100,
                    a: this.roundVector(state.spin.axis, 1)
                }
            } : null,
            e: {
                t: Math.round(environment.temperature),
                p: Math.round(environment.pressure / 100) * 100,
                h: Math.round(environment.humidity * 100) / 100,
                w: this.roundVector(environment.wind, 1)
            },
            p: {
                m: Math.round(properties.mass * 10000) / 10000,
                r: Math.round(properties.radius * 10000) / 10000,
                d: Math.round(properties.dragCoefficient * 100) / 100,
                l: Math.round(properties.liftCoefficient * 100) / 100,
                s: Math.round(properties.spinDecayRate * 100) / 100
            },
            ...additionalParams
        };

        return JSON.stringify(keyObj);
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
        // Approximate size calculation
        let size = 0;
        
        // Add size for each trajectory point
        for (const point of trajectory.points) {
            // Vector3D = 3 numbers = 24 bytes
            // SpinState = 1 number + Vector3D = 32 bytes
            // Forces = 4 Vector3D = 96 bytes
            // time = 8 bytes
            size += (24 + 24 + 32 + 96 + 8);
        }

        // Add size for metrics if present
        if (trajectory.metrics) {
            size += 48;  // 6 numbers = 48 bytes
        }

        return size;
    }

    private evictLeastValuable(): boolean {
        let leastValuableKey: string | null = null;
        let lowestValue = Infinity;

        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            // Value = (hits per hour) / (size in KB)
            const value = (entry.accessCount * 3600000 / age) / (entry.size / 1024);

            if (value < lowestValue) {
                lowestValue = value;
                leastValuableKey = key;
            }
        }

        if (leastValuableKey) {
            const entry = this.cache.get(leastValuableKey)!;
            this.cache.delete(leastValuableKey);
            this.currentSize -= entry.size;
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
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                this.cache.delete(key);
                this.currentSize -= entry.size;
            }
        }
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
            totalHits += entry.accessCount - 1; // Subtract first access
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
}
