import { PerformanceProfiler } from '../core/performance-profiler';
import { CacheManager } from '../core/cache-manager';
import { PerformanceMonitor } from '../core/performance-monitor';
import { Environment, BallProperties, LaunchConditions } from '../core/types';
import { FlightIntegrator } from '../core/flight-integrator';
import { AerodynamicsEngine } from '../core/aerodynamics-engine';
import * as os from 'os';

export class PerformanceTestSuite {
    private readonly profiler: PerformanceProfiler;
    private readonly monitor: PerformanceMonitor;
    private readonly cache: CacheManager;
    private readonly integrator: FlightIntegrator;
    private readonly aero: AerodynamicsEngine;
    private readonly maxConcurrency: number;

    constructor() {
        this.profiler = new PerformanceProfiler();
        this.monitor = PerformanceMonitor.getInstance();
        this.cache = CacheManager.getInstance();
        this.integrator = new FlightIntegrator();
        this.aero = new AerodynamicsEngine();
        this.maxConcurrency = os.cpus().length;
    }

    /**
     * Run comprehensive performance tests
     */
    public async runPerformanceTests(): Promise<PerformanceReport> {
        const report: PerformanceReport = {
            hardwareInfo: this.getHardwareInfo(),
            memoryTests: await this.runMemoryTests(),
            parallelTests: await this.runParallelTests(),
            cacheTests: await this.runCacheTests(),
            batchTests: await this.runBatchTests(),
            timestamp: new Date().toISOString()
        };

        return report;
    }

    /**
     * Get hardware configuration information
     */
    private getHardwareInfo(): HardwareInfo {
        return {
            cpus: os.cpus().map(cpu => ({
                model: cpu.model,
                speed: cpu.speed,
                times: { ...cpu.times }
            })),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            platform: os.platform(),
            arch: os.arch(),
            cpuCount: os.cpus().length
        };
    }

    /**
     * Run memory usage pattern tests
     */
    private async runMemoryTests(): Promise<MemoryTestResults> {
        const standardConditions = this.getStandardConditions();
        const standardEnv = this.getStandardEnvironment();
        const standardBall = this.getStandardBallProperties();

        const results: MemoryTestResults = {
            baselineMemory: process.memoryUsage(),
            trajectoryMemory: [],
            batchMemory: [],
            peakMemory: 0,
            leakTest: false
        };

        // Test single trajectory memory usage
        for (let i = 0; i < 10; i++) {
            const before = process.memoryUsage().heapUsed;
            await this.integrator.simulateFlight(
                standardConditions[0],
                standardEnv,
                standardBall,
                this.aero
            );
            const after = process.memoryUsage().heapUsed;
            results.trajectoryMemory.push(after - before);
        }

        // Test batch processing memory usage
        for (let batchSize = 10; batchSize <= 100; batchSize += 10) {
            const before = process.memoryUsage().heapUsed;
            await Promise.all(
                standardConditions.slice(0, batchSize).map(condition =>
                    this.integrator.simulateFlight(
                        condition,
                        standardEnv,
                        standardBall,
                        this.aero
                    )
                )
            );
            const after = process.memoryUsage().heapUsed;
            results.batchMemory.push({
                batchSize,
                memoryUsed: after - before
            });
        }

        // Memory leak test
        const initialMemory = process.memoryUsage().heapUsed;
        for (let i = 0; i < 1000; i++) {
            await this.integrator.simulateFlight(
                standardConditions[0],
                standardEnv,
                standardBall,
                this.aero
            );
            if (i % 100 === 0) {
                global.gc?.(); // Run garbage collection if available
            }
        }
        const finalMemory = process.memoryUsage().heapUsed;
        results.leakTest = (finalMemory - initialMemory) < 1024 * 1024; // Less than 1MB growth

        return results;
    }

    /**
     * Run parallel processing tests
     */
    private async runParallelTests(): Promise<ParallelTestResults> {
        const results: ParallelTestResults = {
            singleThread: [],
            multiThread: [],
            scalingEfficiency: [],
            optimalBatchSize: 0
        };

        const conditions = this.getStandardConditions();
        const env = this.getStandardEnvironment();
        const ball = this.getStandardBallProperties();

        // Test single-threaded performance
        const singleStart = Date.now();
        for (const condition of conditions) {
            await this.integrator.simulateFlight(condition, env, ball, this.aero);
            results.singleThread.push(Date.now() - singleStart);
        }

        // Test multi-threaded performance with different batch sizes
        for (let batchSize = 2; batchSize <= this.maxConcurrency * 2; batchSize++) {
            const multiStart = Date.now();
            const batches = this.createBatches(conditions, batchSize);
            
            for (const batch of batches) {
                await Promise.all(
                    batch.map(condition =>
                        this.integrator.simulateFlight(condition, env, ball, this.aero)
                    )
                );
            }
            
            const duration = Date.now() - multiStart;
            results.multiThread.push({ batchSize, duration });

            // Calculate scaling efficiency
            const singleThreadTime = results.singleThread[results.singleThread.length - 1];
            const efficiency = (singleThreadTime * batchSize) / duration;
            results.scalingEfficiency.push({ batchSize, efficiency });
        }

        // Find optimal batch size
        results.optimalBatchSize = results.scalingEfficiency.reduce(
            (optimal, current) =>
                current.efficiency > results.scalingEfficiency[optimal].efficiency
                    ? results.scalingEfficiency.indexOf(current)
                    : optimal,
            0
        );

        return results;
    }

    /**
     * Run cache optimization tests
     */
    private async runCacheTests(): Promise<CacheTestResults> {
        const results: CacheTestResults = {
            hitRates: [],
            missRates: [],
            evictionRates: [],
            memoryUsage: [],
            optimalSettings: {
                maxSize: 0,
                maxAge: 0,
                cleanupInterval: 0
            }
        };

        const conditions = this.getStandardConditions();
        const env = this.getStandardEnvironment();
        const ball = this.getStandardBallProperties();

        // Test different cache sizes
        const cacheSizes = [50, 100, 200, 500];
        for (const size of cacheSizes) {
            this.cache.clear();
            const cache = new CacheManager(size);

            // Warm up cache
            for (const condition of conditions.slice(0, Math.floor(conditions.length / 2))) {
                const trajectory = await this.integrator.simulateFlight(
                    condition,
                    env,
                    ball,
                    this.aero
                );
                cache.set(JSON.stringify(condition), trajectory);
            }

            // Test cache performance
            let hits = 0;
            let misses = 0;
            let evictions = 0;

            for (const condition of conditions) {
                const key = JSON.stringify(condition);
                const result = cache.get(key, 'test');
                
                if (result) {
                    hits++;
                } else {
                    misses++;
                    const trajectory = await this.integrator.simulateFlight(
                        condition,
                        env,
                        ball,
                        this.aero
                    );
                    const beforeSize = cache.getStats().entryCount;
                    cache.set(key, trajectory);
                    if (cache.getStats().entryCount <= beforeSize) {
                        evictions++;
                    }
                }
            }

            results.hitRates.push({ size, rate: hits / conditions.length });
            results.missRates.push({ size, rate: misses / conditions.length });
            results.evictionRates.push({ size, rate: evictions / misses });
            results.memoryUsage.push({
                size,
                usage: cache.getStats().memoryUsage
            });
        }

        // Find optimal settings
        const optimalSize = results.hitRates.reduce(
            (optimal, current) =>
                current.rate > results.hitRates[optimal].rate
                    ? results.hitRates.indexOf(current)
                    : optimal,
            0
        );

        results.optimalSettings = {
            maxSize: cacheSizes[optimalSize],
            maxAge: 3600,  // 1 hour
            cleanupInterval: 300  // 5 minutes
        };

        return results;
    }

    /**
     * Run batch processing tests
     */
    private async runBatchTests(): Promise<BatchTestResults> {
        const results: BatchTestResults = {
            throughput: [],
            latency: [],
            resourceUsage: [],
            optimalBatchSize: 0
        };

        const conditions = this.getStandardConditions();
        const env = this.getStandardEnvironment();
        const ball = this.getStandardBallProperties();

        // Test different batch sizes
        for (let batchSize = 1; batchSize <= this.maxConcurrency * 4; batchSize *= 2) {
            const batches = this.createBatches(conditions, batchSize);
            const startTime = Date.now();
            const startMemory = process.memoryUsage().heapUsed;

            let totalLatency = 0;
            let processedItems = 0;

            for (const batch of batches) {
                const batchStart = Date.now();
                await Promise.all(
                    batch.map(condition =>
                        this.integrator.simulateFlight(condition, env, ball, this.aero)
                    )
                );
                const batchLatency = Date.now() - batchStart;
                totalLatency += batchLatency;
                processedItems += batch.length;
            }

            const duration = Date.now() - startTime;
            const memoryUsed = process.memoryUsage().heapUsed - startMemory;

            results.throughput.push({
                batchSize,
                itemsPerSecond: processedItems / (duration / 1000)
            });

            results.latency.push({
                batchSize,
                averageLatency: totalLatency / batches.length
            });

            results.resourceUsage.push({
                batchSize,
                memoryPerItem: memoryUsed / processedItems
            });
        }

        // Find optimal batch size based on throughput/resource usage balance
        results.optimalBatchSize = results.throughput.reduce(
            (optimal, current) => {
                const currentScore = current.itemsPerSecond /
                    results.resourceUsage[results.throughput.indexOf(current)].memoryPerItem;
                const optimalScore = results.throughput[optimal].itemsPerSecond /
                    results.resourceUsage[optimal].memoryPerItem;
                return currentScore > optimalScore
                    ? results.throughput.indexOf(current)
                    : optimal;
            },
            0
        );

        return results;
    }

    /**
     * Helper function to create batches of conditions
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, Math.min(i + batchSize, items.length)));
        }
        return batches;
    }

    /**
     * Get standard test conditions
     */
    private getStandardConditions(): LaunchConditions[] {
        const conditions: LaunchConditions[] = [];
        const speeds = [130, 150, 170];
        const angles = [8, 12, 16];
        const spins = [2000, 2500, 3000];

        for (const speed of speeds) {
            for (const angle of angles) {
                for (const spin of spins) {
                    conditions.push({
                        ballSpeed: speed,
                        launchAngle: angle,
                        spinRate: spin,
                        spinAxis: { x: 0, y: 1, z: 0 }
                    });
                }
            }
        }

        return conditions;
    }

    /**
     * Get standard environment
     */
    private getStandardEnvironment(): Environment {
        return {
            temperature: 20,
            pressure: 1013.25,
            humidity: 0.5,
            wind: { x: 0, y: 0, z: 0 },
            altitude: 0
        };
    }

    /**
     * Get standard ball properties
     */
    private getStandardBallProperties(): BallProperties {
        return {
            mass: 0.0459,
            diameter: 0.0428,
            cd: 0.3,
            cl: 0.2,
            spinDecayRate: 0.95
        };
    }
}

interface PerformanceReport {
    hardwareInfo: HardwareInfo;
    memoryTests: MemoryTestResults;
    parallelTests: ParallelTestResults;
    cacheTests: CacheTestResults;
    batchTests: BatchTestResults;
    timestamp: string;
}

interface HardwareInfo {
    cpus: {
        model: string;
        speed: number;
        times: {
            user: number;
            nice: number;
            sys: number;
            idle: number;
            irq: number;
        };
    }[];
    totalMemory: number;
    freeMemory: number;
    platform: string;
    arch: string;
    cpuCount: number;
}

interface MemoryTestResults {
    baselineMemory: NodeJS.MemoryUsage;
    trajectoryMemory: number[];
    batchMemory: { batchSize: number; memoryUsed: number; }[];
    peakMemory: number;
    leakTest: boolean;
}

interface ParallelTestResults {
    singleThread: number[];
    multiThread: { batchSize: number; duration: number; }[];
    scalingEfficiency: { batchSize: number; efficiency: number; }[];
    optimalBatchSize: number;
}

interface CacheTestResults {
    hitRates: { size: number; rate: number; }[];
    missRates: { size: number; rate: number; }[];
    evictionRates: { size: number; rate: number; }[];
    memoryUsage: { size: number; usage: number; }[];
    optimalSettings: {
        maxSize: number;
        maxAge: number;
        cleanupInterval: number;
    };
}

interface BatchTestResults {
    throughput: { batchSize: number; itemsPerSecond: number; }[];
    latency: { batchSize: number; averageLatency: number; }[];
    resourceUsage: { batchSize: number; memoryPerItem: number; }[];
    optimalBatchSize: number;
}
