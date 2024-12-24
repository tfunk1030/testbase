import { MemoryManager } from '../../core/hardware/memory-manager';
import { ThreadManager } from '../../core/hardware/thread-manager';
import { RealTimeMonitor } from '../../core/real-time-monitor';
import { performance } from 'perf_hooks';

interface PerformanceBaseline {
    memoryUsage: {
        mean: number;
        standardDev: number;
        peak: number;
    };
    cpuUsage: {
        mean: number;
        standardDev: number;
        peak: number;
    };
    responseTime: {
        mean: number;
        p95: number;
        p99: number;
    };
}

describe('Resource Usage Performance', () => {
    let memoryManager: MemoryManager;
    let threadManager: ThreadManager;
    let monitor: RealTimeMonitor;
    let baseline: PerformanceBaseline;

    beforeAll(async () => {
        // Initialize baseline from historical data or create new
        baseline = await loadOrCreateBaseline();
        monitor = new RealTimeMonitor();
    });

    beforeEach(() => {
        memoryManager = MemoryManager.getInstance();
        threadManager = ThreadManager.getInstance();
    });

    describe('Memory Management Performance', () => {
        test('maintains memory usage within baseline', async () => {
            const metrics: number[] = [];
            const duration = 5000; // 5 seconds
            const startTime = performance.now();

            while (performance.now() - startTime < duration) {
                // Simulate memory-intensive operations
                await simulateMemoryLoad();
                const usage = await monitor.getMemoryUsage();
                metrics.push(usage.used);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const stats = calculateStats(metrics);
            expect(stats.mean).toBeLessThan(baseline.memoryUsage.mean * 1.1); // Allow 10% deviation
            expect(stats.peak).toBeLessThan(baseline.memoryUsage.peak * 1.15); // Allow 15% deviation
        });

        test('handles memory pressure efficiently', async () => {
            const pressurePoints = [0.7, 0.8, 0.9]; // 70%, 80%, 90% memory usage
            const responseTimesUnderPressure: number[] = [];

            for (const pressure of pressurePoints) {
                await simulateMemoryPressure(pressure);
                const startTime = performance.now();
                await memoryManager.allocateMemory(1024 * 1024); // 1MB
                responseTimesUnderPressure.push(performance.now() - startTime);
            }

            const avgResponseTime = calculateMean(responseTimesUnderPressure);
            expect(avgResponseTime).toBeLessThan(baseline.responseTime.p95);
        });

        test('detects memory leaks', async () => {
            const initialMemory = await monitor.getMemoryUsage();
            const leakThreshold = 1024 * 1024 * 10; // 10MB

            // Run memory-intensive operations
            for (let i = 0; i < 10; i++) {
                await simulateWorkload();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const finalMemory = await monitor.getMemoryUsage();
            const leak = finalMemory.used - initialMemory.used;
            expect(leak).toBeLessThan(leakThreshold);
        });
    });

    describe('CPU Usage Performance', () => {
        test('maintains CPU usage within baseline', async () => {
            const metrics: number[] = [];
            const duration = 5000;
            const startTime = performance.now();

            while (performance.now() - startTime < duration) {
                await simulateCPULoad();
                const usage = await monitor.getCPUUsage();
                metrics.push(usage);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const stats = calculateStats(metrics);
            expect(stats.mean).toBeLessThan(baseline.cpuUsage.mean * 1.1);
            expect(stats.peak).toBeLessThan(baseline.cpuUsage.peak * 1.15);
        });

        test('optimizes thread allocation under load', async () => {
            const loadLevels = [0.3, 0.6, 0.9]; // 30%, 60%, 90% CPU load
            const threadCounts: number[] = [];

            for (const load of loadLevels) {
                await simulateCPULoad(load);
                const activeThreads = await threadManager.getActiveThreadCount();
                threadCounts.push(activeThreads);
            }

            // Verify thread count scales with load
            expect(threadCounts[1]).toBeGreaterThan(threadCounts[0]);
            expect(threadCounts[2]).toBeGreaterThan(threadCounts[1]);
        });
    });

    describe('Resource Allocation Performance', () => {
        test('maintains allocation speed under load', async () => {
            const allocationTimes: number[] = [];
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await memoryManager.allocateMemory(1024); // 1KB
                allocationTimes.push(performance.now() - start);
            }

            const stats = calculateStats(allocationTimes);
            expect(stats.mean).toBeLessThan(baseline.responseTime.mean * 1.2);
            expect(stats.p95).toBeLessThan(baseline.responseTime.p95);
        });

        test('handles concurrent allocations efficiently', async () => {
            const concurrentRequests = 10;
            const allocationSize = 1024 * 1024; // 1MB
            const startTime = performance.now();

            await Promise.all(Array(concurrentRequests).fill(null).map(() => 
                memoryManager.allocateMemory(allocationSize)
            ));

            const totalTime = performance.now() - startTime;
            expect(totalTime).toBeLessThan(baseline.responseTime.p99 * concurrentRequests * 0.5);
        });
    });
});

// Utility functions
async function loadOrCreateBaseline(): Promise<PerformanceBaseline> {
    // In a real implementation, this would load from a database or file
    return {
        memoryUsage: { mean: 500 * 1024 * 1024, standardDev: 50 * 1024 * 1024, peak: 800 * 1024 * 1024 },
        cpuUsage: { mean: 0.4, standardDev: 0.1, peak: 0.8 },
        responseTime: { mean: 10, p95: 50, p99: 100 }
    };
}

async function simulateMemoryLoad(sizeInMB: number = 100): Promise<void> {
    const arr = new Array(sizeInMB * 256).fill(0); // Roughly sizeInMB megabytes
    await new Promise(resolve => setTimeout(resolve, 100));
}

async function simulateMemoryPressure(percentage: number): Promise<void> {
    const totalMemory = await monitor.getMemoryUsage().total;
    await simulateMemoryLoad(totalMemory * percentage / (1024 * 1024));
}

async function simulateCPULoad(percentage: number = 0.5): Promise<void> {
    const startTime = performance.now();
    while (performance.now() - startTime < 100) {
        Math.random() * Math.random(); // CPU-intensive operation
    }
}

async function simulateWorkload(): Promise<void> {
    await simulateMemoryLoad(10);
    await simulateCPULoad(0.5);
}

function calculateStats(metrics: number[]): { mean: number; standardDev: number; peak: number; p95: number } {
    const mean = calculateMean(metrics);
    const standardDev = calculateStandardDeviation(metrics, mean);
    const peak = Math.max(...metrics);
    const p95 = calculatePercentile(metrics, 95);
    return { mean, standardDev, peak, p95 };
}

function calculateMean(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function calculateStandardDeviation(numbers: number[], mean: number): number {
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
}

function calculatePercentile(numbers: number[], percentile: number): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
}
