import * as os from 'os';
import { PerformanceProfiler } from '../core/performance-profiler';
import { FlightModel } from '../core/flight-model';
import { ProfileOptions, HardwareProfile, PerformanceReport } from '../types';

export class HardwarePerformanceTester {
    private readonly profiler: PerformanceProfiler;
    private readonly model: FlightModel;

    constructor() {
        this.profiler = new PerformanceProfiler();
        this.model = new FlightModel();
    }

    /**
     * Get hardware profile information
     */
    private getHardwareProfile(): HardwareProfile {
        const cpus = os.cpus();
        return {
            cpuModel: cpus[0].model,
            cpuCount: cpus.length,
            cpuSpeed: cpus[0].speed,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            platform: os.platform(),
            arch: os.arch()
        };
    }

    /**
     * Run performance tests with different batch sizes
     */
    private async testBatchSizes(
        minBatch: number = 10,
        maxBatch: number = 1000,
        step: number = 10
    ): Promise<{
        batchSize: number;
        timePerShot: number;
        memoryPerShot: number;
        throughput: number;
    }[]> {
        const results = [];
        
        for (let batchSize = minBatch; batchSize <= maxBatch; batchSize += step) {
            const options: ProfileOptions = {
                maxParallelTasks: os.cpus().length,
                adaptiveBatching: true,
                minBatchSize: batchSize,
                maxBatchSize: batchSize,
                targetExecutionTime: 1000 // 1 second target
            };

            const conditions = Array(batchSize).fill(null).map(() => 
                this.model.generateRandomConditions()
            );
            const environment = this.model.generateRandomEnvironment();
            const properties = this.model.generateRandomBallProperties();

            const startTime = process.hrtime();
            const startMem = process.memoryUsage().heapUsed;

            await Promise.all(conditions.map(condition =>
                this.model.simulateShot(condition, environment, properties)
            ));

            const [seconds, nanoseconds] = process.hrtime(startTime);
            const totalTime = seconds * 1000 + nanoseconds / 1e6; // Convert to ms
            const memoryUsed = process.memoryUsage().heapUsed - startMem;

            results.push({
                batchSize,
                timePerShot: totalTime / batchSize,
                memoryPerShot: memoryUsed / batchSize,
                throughput: batchSize / (totalTime / 1000) // shots per second
            });
        }

        return results;
    }

    /**
     * Run memory leak detection test
     */
    private async detectMemoryLeaks(iterations: number = 100): Promise<{
        hasLeak: boolean;
        memoryGrowth: number;
        averageGrowthRate: number;
    }> {
        const memorySnapshots: number[] = [];
        const batchSize = 100;

        for (let i = 0; i < iterations; i++) {
            const conditions = Array(batchSize).fill(null).map(() => 
                this.model.generateRandomConditions()
            );
            const environment = this.model.generateRandomEnvironment();
            const properties = this.model.generateRandomBallProperties();

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const memBefore = process.memoryUsage().heapUsed;

            await Promise.all(conditions.map(condition =>
                this.model.simulateShot(condition, environment, properties)
            ));

            memorySnapshots.push(process.memoryUsage().heapUsed - memBefore);
        }

        // Calculate memory growth trend
        const growthRates = [];
        for (let i = 1; i < memorySnapshots.length; i++) {
            growthRates.push(memorySnapshots[i] - memorySnapshots[i - 1]);
        }

        const averageGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
        const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];

        return {
            hasLeak: averageGrowthRate > 1000, // Consider growth over 1KB per iteration as a leak
            memoryGrowth,
            averageGrowthRate
        };
    }

    /**
     * Run comprehensive performance tests
     */
    public async runPerformanceTests(): Promise<PerformanceReport> {
        const hardwareProfile = this.getHardwareProfile();
        
        // Test different batch sizes
        const batchResults = await this.testBatchSizes();
        
        // Find optimal batch size
        const optimalBatch = batchResults.reduce((prev, curr) => 
            curr.throughput > prev.throughput ? curr : prev
        );

        // Memory leak detection
        const memoryLeakResults = await this.detectMemoryLeaks();

        // Cache efficiency test with optimal batch size
        const options: ProfileOptions = {
            maxParallelTasks: hardwareProfile.cpuCount,
            adaptiveBatching: true,
            minBatchSize: optimalBatch.batchSize,
            maxBatchSize: optimalBatch.batchSize,
            targetExecutionTime: 1000
        };

        const conditions = this.model.generateRandomConditions();
        const environment = this.model.generateRandomEnvironment();
        const properties = this.model.generateRandomBallProperties();

        const metrics = await this.profiler.profileOptimization(
            conditions,
            environment,
            properties,
            100,
            options
        );

        return {
            timestamp: new Date().toISOString(),
            hardware: hardwareProfile,
            batchPerformance: {
                optimalBatchSize: optimalBatch.batchSize,
                maxThroughput: optimalBatch.throughput,
                averageTimePerShot: optimalBatch.timePerShot,
                averageMemoryPerShot: optimalBatch.memoryPerShot
            },
            memoryHealth: memoryLeakResults,
            cacheEfficiency: {
                hits: metrics.cacheHits,
                misses: metrics.cacheMisses,
                hitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
            },
            recommendations: []
        };
    }
}
