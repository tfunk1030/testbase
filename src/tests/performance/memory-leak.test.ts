import { CacheAnalytics } from '../../core/cache/cache-analytics';
import { CacheWarmer } from '../../core/cache/cache-warmer';
import { MemoryManager } from '../../core/hardware/memory-manager';
import { ThreadManager } from '../../core/hardware/thread-manager';

describe('Memory Leak Detection', () => {
    let analytics: CacheAnalytics;
    let cacheWarmer: CacheWarmer;
    let memoryManager: MemoryManager;
    let threadManager: ThreadManager;

    beforeEach(() => {
        analytics = new CacheAnalytics(1000, 100);
        cacheWarmer = new CacheWarmer(analytics, 1024 * 1024 * 100); // 100MB max
        memoryManager = new MemoryManager();
        threadManager = new ThreadManager(4); // 4 worker threads
    });

    afterEach(async () => {
        await threadManager.shutdown();
    });

    it('should detect memory leaks in cache operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const iterations = 1000;
        const dataSize = 1024; // 1KB

        // Perform repeated cache operations
        for (let i = 0; i < iterations; i++) {
            const key = `test-key-${i}`;
            const data = Buffer.alloc(dataSize).fill(i % 256);
            await cacheWarmer.preloadData(key, data, dataSize);
        }

        // Force garbage collection if possible
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDiff = finalMemory - initialMemory;
        const expectedMaxGrowth = iterations * dataSize * 0.1; // Allow 10% overhead

        expect(memoryDiff).toBeLessThan(expectedMaxGrowth);
    });

    it('should not leak memory during concurrent operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const concurrentOps = 10;
        const opsPerThread = 100;

        const runOperation = async () => {
            for (let i = 0; i < opsPerThread; i++) {
                const key = `concurrent-key-${i}`;
                const data = Buffer.alloc(512).fill(i % 256);
                await cacheWarmer.preloadData(key, data, 512);
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        };

        // Run concurrent operations
        const operations = Array(concurrentOps).fill(null).map(runOperation);
        await Promise.all(operations);

        // Force garbage collection if possible
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDiff = finalMemory - initialMemory;
        const expectedMaxGrowth = concurrentOps * opsPerThread * 512 * 0.15; // Allow 15% overhead

        expect(memoryDiff).toBeLessThan(expectedMaxGrowth);
    });

    it('should clean up resources properly after large operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const largeDataSize = 1024 * 1024; // 1MB
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            const key = `large-data-${i}`;
            const data = Buffer.alloc(largeDataSize).fill(i % 256);
            await cacheWarmer.preloadData(key, data, largeDataSize);
            
            // Simulate some processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Force eviction
            await cacheWarmer.preloadData(`evict-trigger-${i}`, Buffer.alloc(largeDataSize), largeDataSize);
        }

        // Force garbage collection if possible
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDiff = finalMemory - initialMemory;
        const expectedMaxGrowth = largeDataSize * 2; // Allow space for 2 large blocks

        expect(memoryDiff).toBeLessThan(expectedMaxGrowth);
    });

    it('should handle memory pressure gracefully', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        const pressureThreshold = 0.8; // 80% of max memory
        const maxMemory = 1024 * 1024 * 100; // 100MB
        let currentUsage = 0;

        // Monitor memory pressure
        const memoryPressurePromise = new Promise<void>((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const usage = process.memoryUsage().heapUsed;
                if (usage > maxMemory * pressureThreshold) {
                    clearInterval(checkInterval);
                    reject(new Error('Memory pressure threshold exceeded'));
                }
                if (currentUsage >= maxMemory * 0.7) { // 70% target
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });

        // Generate load until we hit target memory usage
        try {
            while (currentUsage < maxMemory * 0.7) {
                const blockSize = 1024 * 1024; // 1MB blocks
                const key = `pressure-test-${currentUsage}`;
                const data = Buffer.alloc(blockSize).fill(0);
                await cacheWarmer.preloadData(key, data, blockSize);
                currentUsage += blockSize;
            }
            await memoryPressurePromise;
        } catch (error) {
            fail('Memory pressure handling failed');
        }

        // Verify recommendations are generated
        const recommendations = analytics.getRecommendations();
        expect(recommendations.some(r => r.type === 'evict')).toBe(true);

        // Force garbage collection if possible
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDiff = finalMemory - initialMemory;
        expect(memoryDiff).toBeLessThan(maxMemory * pressureThreshold);
    });
});
