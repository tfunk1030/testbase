import { ThreadManager } from '../../core/hardware/thread-manager';
import { CacheAnalytics } from '../../core/cache/cache-analytics';
import { CacheWarmer } from '../../core/cache/cache-warmer';
import { MemoryManager } from '../../core/hardware/memory-manager';

describe('Concurrency Stress Tests', () => {
    let threadManager: ThreadManager;
    let analytics: CacheAnalytics;
    let cacheWarmer: CacheWarmer;
    let memoryManager: MemoryManager;

    beforeEach(() => {
        threadManager = new ThreadManager(4);
        analytics = new CacheAnalytics(1000, 100);
        cacheWarmer = new CacheWarmer(analytics, 1024 * 1024 * 100); // 100MB max
        memoryManager = new MemoryManager();
    });

    afterEach(async () => {
        await threadManager.shutdown();
    });

    it('should handle rapid concurrent cache access', async () => {
        const numOperations = 1000;
        const concurrentClients = 10;
        const operations = new Set<Promise<void>>();

        // Simulate multiple clients accessing cache concurrently
        for (let client = 0; client < concurrentClients; client++) {
            for (let op = 0; op < numOperations; op++) {
                const operation = (async () => {
                    const key = `client-${client}-op-${op}`;
                    const data = Buffer.from(`data-${op}`);
                    await cacheWarmer.preloadData(key, data, data.length);
                })();
                operations.add(operation);
            }
        }

        await Promise.all(operations);
        const recommendations = analytics.getRecommendations();
        
        // Verify system remained stable
        expect(recommendations.some(r => r.type === 'evict')).toBe(true);
        expect(operations.size).toBe(concurrentClients * numOperations);
    });

    it('should maintain consistency under concurrent modifications', async () => {
        const key = 'concurrent-mod-key';
        const iterations = 100;
        const concurrentModifiers = 5;
        const modifications = new Set<Promise<void>>();
        const values = new Set<string>();

        // Perform concurrent modifications
        for (let i = 0; i < concurrentModifiers; i++) {
            for (let j = 0; j < iterations; j++) {
                const modification = (async () => {
                    const value = `value-${i}-${j}`;
                    values.add(value);
                    await cacheWarmer.preloadData(key, value, value.length);
                })();
                modifications.add(modification);
            }
        }

        await Promise.all(modifications);
        
        // Verify consistency
        expect(modifications.size).toBe(concurrentModifiers * iterations);
        expect(values.size).toBe(concurrentModifiers * iterations);
    });

    it('should handle concurrent read-write operations', async () => {
        const numKeys = 100;
        const concurrentReaders = 20;
        const concurrentWriters = 5;
        const operations = new Set<Promise<void>>();
        const readCounts = new Map<string, number>();
        const writeCounts = new Map<string, number>();

        // Setup readers
        for (let reader = 0; reader < concurrentReaders; reader++) {
            const operation = (async () => {
                for (let i = 0; i < numKeys; i++) {
                    const key = `key-${i}`;
                    try {
                        await cacheWarmer.warmup([key]);
                        const count = readCounts.get(key) || 0;
                        readCounts.set(key, count + 1);
                    } catch (error) {
                        // Expected some reads to fail due to concurrent writes
                    }
                }
            })();
            operations.add(operation);
        }

        // Setup writers
        for (let writer = 0; writer < concurrentWriters; writer++) {
            const operation = (async () => {
                for (let i = 0; i < numKeys; i++) {
                    const key = `key-${i}`;
                    const data = Buffer.from(`data-${writer}-${i}`);
                    await cacheWarmer.preloadData(key, data, data.length);
                    const count = writeCounts.get(key) || 0;
                    writeCounts.set(key, count + 1);
                }
            })();
            operations.add(operation);
        }

        await Promise.all(operations);

        // Verify operation counts
        expect(operations.size).toBe(concurrentReaders + concurrentWriters);
        expect(writeCounts.size).toBe(numKeys);
        writeCounts.forEach((count, key) => {
            expect(count).toBe(concurrentWriters);
        });
    });

    it('should handle high-frequency cache updates', async () => {
        const updateInterval = 10; // 10ms between updates
        const duration = 1000; // Run for 1 second
        const numKeys = 50;
        let operations = 0;
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
            const key = `key-${operations % numKeys}`;
            const data = Buffer.from(`data-${operations}`);
            await cacheWarmer.preloadData(key, data, data.length);
            operations++;
            await new Promise(resolve => setTimeout(resolve, updateInterval));
        }

        const actualDuration = Date.now() - startTime;
        const operationsPerSecond = (operations / actualDuration) * 1000;

        // Verify performance
        expect(operationsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec
        expect(actualDuration).toBeGreaterThanOrEqual(duration);
    });

    it('should handle concurrent memory-intensive operations', async () => {
        const concurrentOps = 5;
        const memoryPerOp = 1024 * 1024 * 10; // 10MB per operation
        const operations = new Set<Promise<void>>();

        const initialMemory = process.memoryUsage().heapUsed;

        // Start concurrent memory-intensive operations
        for (let i = 0; i < concurrentOps; i++) {
            const operation = (async () => {
                const data = Buffer.alloc(memoryPerOp);
                await cacheWarmer.preloadData(`memory-op-${i}`, data, memoryPerOp);
                await new Promise(resolve => setTimeout(resolve, 100));
            })();
            operations.add(operation);
        }

        await Promise.all(operations);

        // Force garbage collection if possible
        if (global.gc) {
            global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryDiff = finalMemory - initialMemory;

        // Verify memory usage
        expect(memoryDiff).toBeLessThan(memoryPerOp * concurrentOps * 1.5); // Allow 50% overhead
        expect(operations.size).toBe(concurrentOps);
    });
});
