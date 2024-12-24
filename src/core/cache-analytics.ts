import { PerformanceMonitor } from './performance-monitor';
import { CacheManager } from './cache-manager';
import { TrajectoryResult } from './types';

export interface CacheAnalytics {
    timestamp: number;
    overallStats: {
        size: number;
        hitRate: number;
        averageAge: number;
        memoryUsage: number;
        entryCount: number;
    };
    timeSeriesStats: {
        timestamp: number;
        hitRate: number;
        memoryUsage: number;
        entryCount: number;
    }[];
    patternStats: {
        pattern: string;
        hitCount: number;
        missCount: number;
        hitRate: number;
        averageAccessTime: number;
    }[];
    memoryStats: {
        currentUsage: number;
        peakUsage: number;
        averageEntrySize: number;
        sizeDistribution: {
            range: string;
            count: number;
            totalSize: number;
        }[];
    };
    performanceStats: {
        averageAccessTime: number;
        p95AccessTime: number;
        p99AccessTime: number;
        evictionRate: number;
        cleanupTime: number;
    };
}

export class CacheAnalytics {
    private static instance: CacheAnalytics;
    private readonly monitor: PerformanceMonitor;
    private readonly cache: CacheManager;
    private readonly timeSeriesData: {
        timestamp: number;
        hitRate: number;
        memoryUsage: number;
        entryCount: number;
    }[] = [];
    private readonly accessTimes: number[] = [];
    private readonly patternHits: Map<string, number> = new Map();
    private readonly patternMisses: Map<string, number> = new Map();
    private readonly patternAccessTimes: Map<string, number[]> = new Map();
    private lastCleanupTime: number = 0;
    private evictionCount: number = 0;

    private constructor() {
        this.monitor = PerformanceMonitor.getInstance();
        this.cache = CacheManager.getInstance();
        this.startPeriodicCollection();
    }

    public static getInstance(): CacheAnalytics {
        if (!CacheAnalytics.instance) {
            CacheAnalytics.instance = new CacheAnalytics();
        }
        return CacheAnalytics.instance;
    }

    private startPeriodicCollection(): void {
        setInterval(() => {
            this.collectTimeSeriesData();
        }, 60000); // Collect every minute
    }

    private collectTimeSeriesData(): void {
        const stats = this.cache.getStats();
        this.timeSeriesData.push({
            timestamp: Date.now(),
            hitRate: stats.hitRate,
            memoryUsage: stats.memoryUsage,
            entryCount: stats.entryCount
        });

        // Keep only last 24 hours of data
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        while (this.timeSeriesData.length > 0 && this.timeSeriesData[0].timestamp < dayAgo) {
            this.timeSeriesData.shift();
        }
    }

    public recordAccess(pattern: string, hit: boolean, accessTime: number): void {
        this.accessTimes.push(accessTime);
        
        if (hit) {
            this.patternHits.set(pattern, (this.patternHits.get(pattern) || 0) + 1);
        } else {
            this.patternMisses.set(pattern, (this.patternMisses.get(pattern) || 0) + 1);
        }

        const times = this.patternAccessTimes.get(pattern) || [];
        times.push(accessTime);
        this.patternAccessTimes.set(pattern, times);

        // Keep only last 1000 access times for memory efficiency
        if (this.accessTimes.length > 1000) {
            this.accessTimes.shift();
        }
    }

    public recordEviction(): void {
        this.evictionCount++;
    }

    public recordCleanup(duration: number): void {
        this.lastCleanupTime = duration;
    }

    public getAnalytics(): CacheAnalytics {
        const stats = this.cache.getStats();
        const now = Date.now();

        // Calculate pattern statistics
        const patternStats = Array.from(this.patternHits.keys()).map(pattern => {
            const hits = this.patternHits.get(pattern) || 0;
            const misses = this.patternMisses.get(pattern) || 0;
            const times = this.patternAccessTimes.get(pattern) || [];
            return {
                pattern,
                hitCount: hits,
                missCount: misses,
                hitRate: hits / (hits + misses),
                averageAccessTime: times.reduce((a, b) => a + b, 0) / times.length
            };
        });

        // Calculate size distribution
        const entries = this.cache.getEntries();
        const sizeRanges = [0, 1024, 10240, 102400, 1048576]; // 0B, 1KB, 10KB, 100KB, 1MB
        const distribution = sizeRanges.map((min, i) => {
            const max = sizeRanges[i + 1] || Infinity;
            const inRange = entries.filter(e => e.size >= min && e.size < max);
            return {
                range: `${this.formatSize(min)}-${this.formatSize(max)}`,
                count: inRange.length,
                totalSize: inRange.reduce((sum, e) => sum + e.size, 0)
            };
        });

        // Calculate performance statistics
        const sortedTimes = [...this.accessTimes].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedTimes.length * 0.95);
        const p99Index = Math.floor(sortedTimes.length * 0.99);

        return {
            timestamp: now,
            overallStats: stats,
            timeSeriesStats: this.timeSeriesData,
            patternStats: patternStats,
            memoryStats: {
                currentUsage: stats.memoryUsage,
                peakUsage: Math.max(...this.timeSeriesData.map(d => d.memoryUsage)),
                averageEntrySize: stats.memoryUsage / stats.entryCount,
                sizeDistribution: distribution
            },
            performanceStats: {
                averageAccessTime: this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length,
                p95AccessTime: sortedTimes[p95Index] || 0,
                p99AccessTime: sortedTimes[p99Index] || 0,
                evictionRate: this.evictionCount / (stats.entryCount || 1),
                cleanupTime: this.lastCleanupTime
            }
        };
    }

    private formatSize(bytes: number): string {
        if (bytes === Infinity) return '∞';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1048576).toFixed(1)}MB`;
    }
}
