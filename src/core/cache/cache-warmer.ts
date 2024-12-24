import * as fs from 'fs/promises';
import * as path from 'path';
import { DiskStorage } from './disk-storage';
import { CacheEntry, CacheMetadata, CacheRecommendation, MemorySnapshot } from './types';
import { CacheAnalytics } from './cache-analytics';
import { EventEmitter } from 'events';

interface WarmingConfig {
    concurrency?: number;
    batchSize?: number;
    warmingStrategy?: 'sequential' | 'priority' | 'random';
    preloadPatterns?: string[];
}

interface WarmingStats {
    totalItems: number;
    warmedItems: number;
    failedItems: number;
    timeTaken: number;
}

interface WarmupConfig {
    maxConcurrent: number;
    interval: number;
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
}

interface WarmupStats {
    totalAttempted: number;
    successful: number;
    failed: number;
    skipped: number;
    duration: number;
}

export class CacheWarmer extends EventEmitter {
    private static instance: CacheWarmer;
    private readonly storage: DiskStorage;
    private readonly analytics: CacheAnalytics;
    private readonly config: Required<WarmingConfig>;
    private readonly warmupConfig: WarmupConfig;
    private isWarming: boolean = false;
    private warmingQueue: Set<string> = new Set();
    private currentStats: WarmupStats;

    private constructor(
        storage: DiskStorage,
        analytics: CacheAnalytics,
        config: WarmingConfig = {},
        warmupConfig: Partial<WarmupConfig> = {}
    ) {
        super();
        this.storage = storage;
        this.analytics = analytics;
        this.config = {
            concurrency: config.concurrency || 4,
            batchSize: config.batchSize || 100,
            warmingStrategy: config.warmingStrategy || 'priority',
            preloadPatterns: config.preloadPatterns || []
        };
        this.warmupConfig = {
            maxConcurrent: warmupConfig.maxConcurrent || 5,
            interval: warmupConfig.interval || 300000, // 5 minutes
            batchSize: warmupConfig.batchSize || 100,
            retryAttempts: warmupConfig.retryAttempts || 3,
            retryDelay: warmupConfig.retryDelay || 1000
        };
        this.currentStats = this.initializeStats();
    }

    public static getInstance(
        storage: DiskStorage,
        analytics: CacheAnalytics,
        config?: WarmingConfig,
        warmupConfig?: Partial<WarmupConfig>
    ): CacheWarmer {
        if (!CacheWarmer.instance) {
            CacheWarmer.instance = new CacheWarmer(storage, analytics, config, warmupConfig);
        }
        return CacheWarmer.instance;
    }

    private initializeStats(): WarmupStats {
        return {
            totalAttempted: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            duration: 0
        };
    }

    public async warmCache(keys?: string[]): Promise<WarmingStats> {
        if (this.isWarming) {
            throw new Error('Cache warming already in progress');
        }

        this.isWarming = true;
        const startTime = Date.now();
        const stats: WarmingStats = {
            totalItems: 0,
            warmedItems: 0,
            failedItems: 0,
            timeTaken: 0
        };

        try {
            // Get keys to warm
            const keysToWarm = keys || await this.getKeysToWarm();
            stats.totalItems = keysToWarm.length;

            // Sort keys based on strategy
            const sortedKeys = await this.prioritizeKeys(keysToWarm);

            // Process in batches
            for (let i = 0; i < sortedKeys.length; i += this.config.batchSize) {
                const batch = sortedKeys.slice(i, i + this.config.batchSize);
                const results = await this.warmBatch(batch);
                
                stats.warmedItems += results.filter(r => r.success).length;
                stats.failedItems += results.filter(r => !r.success).length;
            }

        } finally {
            this.isWarming = false;
            stats.timeTaken = Date.now() - startTime;
        }

        return stats;
    }

    private async getKeysToWarm(): Promise<string[]> {
        const keys: Set<string> = new Set();

        // Add queued keys
        this.warmingQueue.forEach(key => keys.add(key));

        // Add pattern-matched keys
        if (this.config.preloadPatterns.length > 0) {
            const allKeys = await this.getAllCacheKeys();
            for (const key of allKeys) {
                if (this.matchesPattern(key)) {
                    keys.add(key);
                }
            }
        }

        return Array.from(keys);
    }

    private async prioritizeKeys(keys: string[]): Promise<string[]> {
        switch (this.config.warmingStrategy) {
            case 'priority':
                return this.prioritizeByUsage(keys);
            case 'random':
                return this.shuffleArray(keys);
            case 'sequential':
            default:
                return keys;
        }
    }

    private async prioritizeByUsage(keys: string[]): Promise<string[]> {
        // Get analytics recommendations
        const recommendations = this.analytics.getRecommendations();
        const preloadRecommendations = recommendations
            .filter(r => r.type === 'preload')
            .reduce((acc, r) => {
                const [key, priority] = r.suggestedAction.split(':').map(s => s.trim());
                acc[key] = parseFloat(priority);
                return acc;
            }, {} as Record<string, number>);

        const keyStats = await Promise.all(
            keys.map(async key => {
                try {
                    const metadata = await this.getMetadata(key);
                    return {
                        key,
                        accessCount: metadata.accessCount || 0,
                        lastAccess: metadata.lastAccess || 0,
                        analyticsScore: preloadRecommendations[key] || 0
                    };
                } catch {
                    return { 
                        key, 
                        accessCount: 0, 
                        lastAccess: 0,
                        analyticsScore: preloadRecommendations[key] || 0 
                    };
                }
            })
        );

        // Sort by analytics score, access count, and recency
        return keyStats
            .sort((a, b) => {
                // Prioritize analytics recommendations
                const analyticsDiff = b.analyticsScore - a.analyticsScore;
                if (analyticsDiff !== 0) return analyticsDiff;

                // Then consider access patterns
                const scoreDiff = b.accessCount - a.accessCount;
                if (scoreDiff !== 0) return scoreDiff;

                // Finally, consider recency
                return b.lastAccess - a.lastAccess;
            })
            .map(stat => stat.key);
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    private async warmBatch(
        keys: string[]
    ): Promise<Array<{ key: string; success: boolean }>> {
        // Process keys concurrently with limited concurrency
        const results: Array<{ key: string; success: boolean }> = [];
        const batches: string[][] = [];

        // Split into smaller batches based on concurrency
        for (let i = 0; i < keys.length; i += this.config.concurrency) {
            batches.push(keys.slice(i, i + this.config.concurrency));
        }

        for (const batch of batches) {
            const batchResults = await Promise.all(
                batch.map(key => this.warmSingle(key))
            );
            results.push(...batchResults);
        }

        return results;
    }

    private async warmSingle(key: string): Promise<{ key: string; success: boolean }> {
        try {
            const { data } = await this.storage.retrieve(key);
            // Record successful warming in analytics
            this.analytics.recordAccess(key, true, data.length);
            return { key, success: true };
        } catch (error) {
            // Record failed warming in analytics
            this.analytics.recordAccess(key, false, 0);
            console.error(`Failed to warm cache for key: ${key}`, error);
            return { key, success: false };
        } finally {
            // Record memory usage after each operation
            this.analytics.recordMemoryUsage({
                total: process.memoryUsage().heapTotal,
                used: process.memoryUsage().heapUsed,
                timestamp: new Date()
            });
        }
    }

    private async getAllCacheKeys(): Promise<string[]> {
        const dataPath = path.join(this.storage['config'].basePath, 'data');
        const files = await fs.readdir(dataPath);
        return files;
    }

    private matchesPattern(key: string): boolean {
        return this.config.preloadPatterns.some(pattern => {
            const regex = new RegExp(pattern);
            return regex.test(key);
        });
    }

    private async getMetadata(key: string): Promise<CacheMetadata> {
        const metadataPath = path.join(
            this.storage['config'].basePath,
            'metadata',
            `${key}.json`
        );
        const data = await fs.readFile(metadataPath, 'utf8');
        return JSON.parse(data);
    }

    public queueForWarming(key: string): void {
        this.warmingQueue.add(key);
    }

    public removeFromQueue(key: string): void {
        this.warmingQueue.delete(key);
    }

    public clearQueue(): void {
        this.warmingQueue.clear();
    }

    public isWarmingInProgress(): boolean {
        return this.isWarming;
    }

    public getQueueSize(): number {
        return this.warmingQueue.size;
    }

    public async warmCacheWithWarmupConfig(entries: CacheEntry<unknown>[]): Promise<WarmupStats> {
        if (this.isWarming) {
            throw new Error('Cache warming already in progress');
        }

        this.isWarming = true;
        this.currentStats = this.initializeStats();
        const startTime = Date.now();

        try {
            const recommendations = this.analytics.getRecommendations();
            const prioritizedEntries = this.prioritizeEntries(entries, recommendations);
            
            for (let i = 0; i < prioritizedEntries.length; i += this.warmupConfig.batchSize) {
                const batch = prioritizedEntries.slice(i, i + this.warmupConfig.batchSize);
                await this.processBatch(batch);
            }

            this.currentStats.duration = Date.now() - startTime;
            this.emit('warmupComplete', this.currentStats);
            return this.currentStats;
        } finally {
            this.isWarming = false;
        }
    }

    private prioritizeEntries(entries: CacheEntry<unknown>[], recommendations: CacheRecommendation[]): CacheEntry<unknown>[] {
        const priorityMap = new Map<string, number>();
        
        recommendations.forEach(r => {
            if (r.type === 'preload' && r.keys) {
                r.keys.forEach(key => priorityMap.set(key, r.priority));
            }
        });

        return entries.sort((a, b) => {
            const priorityA = priorityMap.get(a.key) || 0;
            const priorityB = priorityMap.get(b.key) || 0;
            return priorityB - priorityA;
        });
    }

    private async processBatch(entries: CacheEntry<unknown>[]): Promise<void> {
        const promises = entries.map(entry => this.warmEntry(entry));
        await Promise.all(promises);
    }

    private async warmEntry(entry: CacheEntry<unknown>): Promise<void> {
        this.currentStats.totalAttempted++;

        for (let attempt = 0; attempt < this.warmupConfig.retryAttempts; attempt++) {
            try {
                await this.loadEntry(entry);
                this.currentStats.successful++;
                this.analytics.recordAccess(entry.key, true, entry.size, 0);
                return;
            } catch (error) {
                if (attempt === this.warmupConfig.retryAttempts - 1) {
                    this.currentStats.failed++;
                    this.emit('warmupError', { entry, error });
                } else {
                    await new Promise(resolve => setTimeout(resolve, this.warmupConfig.retryDelay));
                }
            }
        }
    }

    private async loadEntry(entry: CacheEntry<unknown>): Promise<void> {
        // Simulate entry loading - replace with actual loading logic
        await new Promise<void>((resolve, reject) => {
            if (Math.random() > 0.1) { // 90% success rate
                setTimeout(resolve, Math.random() * 100);
            } else {
                reject(new Error('Failed to load entry'));
            }
        });
    }

    public getStats(): WarmupStats {
        return { ...this.currentStats };
    }
}
