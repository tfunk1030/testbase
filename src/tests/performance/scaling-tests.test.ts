import { ThreadManager } from '../../core/hardware/thread-manager';
import { MemoryManager } from '../../core/hardware/memory-manager';
import { RealTimeMonitor } from '../../core/real-time-monitor';
import { performance } from 'perf_hooks';

interface ScalingMetrics {
    throughput: number;
    latency: number;
    resourceUsage: {
        cpu: number;
        memory: number;
    };
}

describe('System Scaling Performance', () => {
    let threadManager: ThreadManager;
    let memoryManager: MemoryManager;
    let monitor: RealTimeMonitor;
    let baselineMetrics: ScalingMetrics;

    beforeAll(async () => {
        monitor = new RealTimeMonitor();
        baselineMetrics = await collectBaselineMetrics();
    });

    beforeEach(() => {
        threadManager = ThreadManager.getInstance();
        memoryManager = MemoryManager.getInstance();
    });

    describe('Horizontal Scaling', () => {
        test('scales thread count linearly with load', async () => {
            const loadLevels = [1, 2, 4, 8]; // Multipliers for base load
            const metrics: ScalingMetrics[] = [];

            for (const load of loadLevels) {
                const result = await measureScaling(() => simulateLoad(load));
                metrics.push(result);
            }

            // Verify linear scaling
            for (let i = 1; i < metrics.length; i++) {
                const scalingFactor = loadLevels[i] / loadLevels[i-1];
                const throughputRatio = metrics[i].throughput / metrics[i-1].throughput;
                expect(throughputRatio).toBeGreaterThan(scalingFactor * 0.8); // Allow 20% deviation
            }
        });

        test('maintains response time under increasing load', async () => {
            const concurrencyLevels = [1, 5, 10, 20];
            const latencies: number[] = [];

            for (const concurrency of concurrencyLevels) {
                const start = performance.now();
                await Promise.all(Array(concurrency).fill(null).map(() => simulateRequest()));
                latencies.push((performance.now() - start) / concurrency);
            }

            // Verify sub-linear latency growth
            for (let i = 1; i < latencies.length; i++) {
                const latencyIncrease = latencies[i] / latencies[0];
                const concurrencyIncrease = concurrencyLevels[i];
                expect(latencyIncrease).toBeLessThan(concurrencyIncrease);
            }
        });

        test('efficiently distributes work across threads', async () => {
            const workload = Array(100).fill(null).map(() => ({ size: 1024 * 1024 })); // 1MB tasks
            const threadUtilization: number[] = [];

            const startTime = performance.now();
            await threadManager.processWorkload(workload);
            const duration = performance.now() - startTime;

            const threads = await threadManager.getThreadStats();
            threads.forEach(thread => {
                threadUtilization.push(thread.taskCount / thread.totalCapacity);
            });

            // Check even distribution (within 20% of mean)
            const mean = calculateMean(threadUtilization);
            const withinThreshold = threadUtilization.every(util => 
                Math.abs(util - mean) < mean * 0.2
            );
            expect(withinThreshold).toBe(true);
        });
    });

    describe('Vertical Scaling', () => {
        test('optimizes memory allocation with scale', async () => {
            const sizeLevels = [1, 2, 4, 8].map(x => x * 1024 * 1024); // 1MB to 8MB
            const allocationTimes: number[] = [];

            for (const size of sizeLevels) {
                const start = performance.now();
                await memoryManager.allocateMemory(size);
                allocationTimes.push(performance.now() - start);
            }

            // Verify sub-linear scaling of allocation time
            for (let i = 1; i < allocationTimes.length; i++) {
                const timeRatio = allocationTimes[i] / allocationTimes[0];
                const sizeRatio = sizeLevels[i] / sizeLevels[0];
                expect(timeRatio).toBeLessThan(sizeRatio);
            }
        });

        test('handles memory pressure during scaling', async () => {
            const initialMemory = await monitor.getMemoryUsage();
            const scalingSteps = 5;
            const memoryMetrics: number[] = [];

            for (let i = 0; i < scalingSteps; i++) {
                await simulateMemoryIntensiveTask(1024 * 1024 * (i + 1));
                const currentMemory = await monitor.getMemoryUsage();
                memoryMetrics.push(currentMemory.used - initialMemory.used);
            }

            // Verify efficient memory usage during scaling
            const memoryGrowth = memoryMetrics[memoryMetrics.length - 1] / memoryMetrics[0];
            expect(memoryGrowth).toBeLessThan(scalingSteps);
        });
    });

    describe('Resource Efficiency', () => {
        test('maintains resource efficiency under scale', async () => {
            const baselineEfficiency = await measureResourceEfficiency();
            const loadMultiplier = 4;
            
            // Simulate increased load
            await simulateLoad(loadMultiplier);
            const scaledEfficiency = await measureResourceEfficiency();

            // Efficiency should not degrade more than 30%
            expect(scaledEfficiency).toBeGreaterThan(baselineEfficiency * 0.7);
        });

        test('optimizes thread pool size dynamically', async () => {
            const loadLevels = [0.2, 0.5, 0.8]; // 20%, 50%, 80% CPU load
            const poolSizes: number[] = [];

            for (const load of loadLevels) {
                await simulateCPULoad(load);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Allow time for adjustment
                poolSizes.push(await threadManager.getActiveThreadCount());
            }

            // Verify pool size adapts to load
            expect(poolSizes[1]).toBeGreaterThan(poolSizes[0]);
            expect(poolSizes[2]).toBeGreaterThan(poolSizes[1]);
        });

        test('balances resource allocation under mixed workloads', async () => {
            const workloads = [
                { cpu: 0.3, memory: 0.7 },
                { cpu: 0.7, memory: 0.3 },
                { cpu: 0.5, memory: 0.5 }
            ];

            for (const workload of workloads) {
                await simulateMixedLoad(workload);
                const metrics = await monitor.getResourceMetrics();
                
                // Verify resource balance
                expect(metrics.cpu.utilization).toBeLessThan(workload.cpu * 1.2);
                expect(metrics.memory.utilization).toBeLessThan(workload.memory * 1.2);
            }
        });
    });
});

// Utility functions
async function collectBaselineMetrics(): Promise<ScalingMetrics> {
    const start = performance.now();
    await simulateLoad(1);
    const duration = performance.now() - start;

    const resourceMetrics = await monitor.getResourceMetrics();
    
    return {
        throughput: 1000 / duration,
        latency: duration,
        resourceUsage: {
            cpu: resourceMetrics.cpu.utilization,
            memory: resourceMetrics.memory.utilization
        }
    };
}

async function simulateLoad(multiplier: number): Promise<void> {
    const tasks = Array(Math.floor(10 * multiplier)).fill(null)
        .map(() => simulateRequest());
    await Promise.all(tasks);
}

async function simulateRequest(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    await simulateCPULoad(0.5);
}

async function simulateCPULoad(percentage: number): Promise<void> {
    const duration = 100;
    const startTime = performance.now();
    while (performance.now() - startTime < duration * percentage) {
        Math.random() * Math.random();
    }
}

async function simulateMemoryIntensiveTask(sizeBytes: number): Promise<void> {
    const arr = new Array(Math.floor(sizeBytes / 8)).fill(0);
    await new Promise(resolve => setTimeout(resolve, 100));
}

async function simulateMixedLoad(workload: { cpu: number; memory: number }): Promise<void> {
    await Promise.all([
        simulateCPULoad(workload.cpu),
        simulateMemoryIntensiveTask(workload.memory * 1024 * 1024 * 100)
    ]);
}

async function measureResourceEfficiency(): Promise<number> {
    const before = await monitor.getResourceMetrics();
    const start = performance.now();
    
    await simulateLoad(1);
    
    const duration = performance.now() - start;
    const after = await monitor.getResourceMetrics();
    
    const cpuUsage = after.cpu.utilization - before.cpu.utilization;
    const memoryUsage = after.memory.utilization - before.memory.utilization;
    
    return 1 / (duration * (cpuUsage + memoryUsage));
}

function calculateMean(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}
