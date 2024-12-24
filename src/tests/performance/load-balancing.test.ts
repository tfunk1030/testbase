import { ThreadManager } from '../../core/hardware/thread-manager';
import { CacheAnalytics } from '../../core/cache/cache-analytics';
import { CacheWarmer } from '../../core/cache/cache-warmer';
import { MemoryManager } from '../../core/hardware/memory-manager';

describe('Load Balancing Tests', () => {
    let threadManager: ThreadManager;
    let analytics: CacheAnalytics;
    let cacheWarmer: CacheWarmer;
    let memoryManager: MemoryManager;

    beforeEach(() => {
        threadManager = new ThreadManager(4); // 4 worker threads
        analytics = new CacheAnalytics(1000, 100);
        cacheWarmer = new CacheWarmer(analytics, 1024 * 1024 * 100); // 100MB max
        memoryManager = new MemoryManager();
    });

    afterEach(async () => {
        await threadManager.shutdown();
    });

    it('should distribute work evenly across threads', async () => {
        const numOperations = 1000;
        const threadStats = new Map<number, number>();

        // Initialize thread stats
        for (let i = 0; i < threadManager.threadCount; i++) {
            threadStats.set(i, 0);
        }

        // Submit work to thread pool
        const operations = Array(numOperations).fill(null).map((_, index) => {
            return threadManager.submitTask(async (threadId) => {
                const currentCount = threadStats.get(threadId) || 0;
                threadStats.set(threadId, currentCount + 1);
                await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
                return threadId;
            });
        });

        await Promise.all(operations);

        // Calculate distribution metrics
        const counts = Array.from(threadStats.values());
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // Expect relatively even distribution (within 2 standard deviations)
        const expectedOpsPerThread = numOperations / threadManager.threadCount;
        const maxDeviation = expectedOpsPerThread * 0.2; // Allow 20% deviation

        counts.forEach(count => {
            expect(Math.abs(count - expectedOpsPerThread)).toBeLessThan(maxDeviation);
        });
    });

    it('should handle thread failures gracefully', async () => {
        const numOperations = 100;
        let completedOps = 0;
        let failedOps = 0;

        // Submit work including some that will fail
        const operations = Array(numOperations).fill(null).map((_, index) => {
            return threadManager.submitTask(async () => {
                if (index % 10 === 0) { // 10% failure rate
                    throw new Error('Simulated thread failure');
                }
                await new Promise(resolve => setTimeout(resolve, 10));
                return index;
            }).then(() => {
                completedOps++;
            }).catch(() => {
                failedOps++;
            });
        });

        await Promise.all(operations);

        expect(completedOps + failedOps).toBe(numOperations);
        expect(failedOps).toBe(Math.floor(numOperations / 10));
    });

    it('should maintain performance under increasing load', async () => {
        const baselineOperations = 100;
        const loadMultipliers = [1, 2, 4, 8];
        const timings: number[] = [];

        for (const multiplier of loadMultipliers) {
            const startTime = Date.now();
            const numOperations = baselineOperations * multiplier;

            const operations = Array(numOperations).fill(null).map(() => {
                return threadManager.submitTask(async () => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return true;
                });
            });

            await Promise.all(operations);
            const duration = Date.now() - startTime;
            timings.push(duration);
        }

        // Check that performance scales roughly linearly
        for (let i = 1; i < timings.length; i++) {
            const scaleFactor = loadMultipliers[i] / loadMultipliers[i - 1];
            const timeFactor = timings[i] / timings[i - 1];
            // Allow for some overhead in scaling (1.5x instead of perfect 2x)
            expect(timeFactor).toBeLessThan(scaleFactor * 1.5);
        }
    });

    it('should prioritize critical tasks', async () => {
        const normalTasks = 50;
        const criticalTasks = 10;
        const criticalResults: number[] = [];
        const normalResults: number[] = [];

        // Submit normal tasks
        const normalOperations = Array(normalTasks).fill(null).map((_, index) => {
            return threadManager.submitTask(async () => {
                await new Promise(resolve => setTimeout(resolve, 20));
                normalResults.push(Date.now());
                return index;
            }, { priority: 'normal' });
        });

        // Submit critical tasks with delay
        await new Promise(resolve => setTimeout(resolve, 100));
        const criticalOperations = Array(criticalTasks).fill(null).map((_, index) => {
            return threadManager.submitTask(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                criticalResults.push(Date.now());
                return index;
            }, { priority: 'high' });
        });

        await Promise.all([...normalOperations, ...criticalOperations]);

        // Verify critical tasks completed before remaining normal tasks
        const lastCriticalTime = Math.max(...criticalResults);
        const remainingNormalTimes = normalResults.filter(time => time > lastCriticalTime);
        
        expect(remainingNormalTimes.length).toBeGreaterThan(0);
        expect(criticalResults.length).toBe(criticalTasks);
    });

    it('should handle memory-intensive tasks efficiently', async () => {
        const memoryIntensiveTasks = 5;
        const normalTasks = 20;
        const memoryPerTask = 1024 * 1024 * 10; // 10MB per task

        // Submit memory-intensive tasks
        const memoryTasks = Array(memoryIntensiveTasks).fill(null).map((_, index) => {
            return threadManager.submitTask(async () => {
                const data = Buffer.alloc(memoryPerTask);
                await cacheWarmer.preloadData(`memory-task-${index}`, data, memoryPerTask);
                await new Promise(resolve => setTimeout(resolve, 100));
                return index;
            });
        });

        // Submit normal computation tasks
        const computeTasks = Array(normalTasks).fill(null).map((_, index) => {
            return threadManager.submitTask(async () => {
                // Simulate CPU-bound work
                let result = 0;
                for (let i = 0; i < 1000000; i++) {
                    result += Math.sqrt(i);
                }
                return index;
            });
        });

        const startTime = Date.now();
        await Promise.all([...memoryTasks, ...computeTasks]);
        const duration = Date.now() - startTime;

        // Verify memory usage stayed within bounds
        const memoryUsage = process.memoryUsage().heapUsed;
        const maxExpectedMemory = memoryPerTask * memoryIntensiveTasks * 1.5; // Allow 50% overhead
        expect(memoryUsage).toBeLessThan(maxExpectedMemory);

        // Verify completion time is reasonable
        const maxExpectedDuration = (memoryIntensiveTasks + normalTasks) * 150; // 150ms per task
        expect(duration).toBeLessThan(maxExpectedDuration);
    });
});
