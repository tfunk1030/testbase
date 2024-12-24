import { 
    BallState, 
    Environment, 
    BallProperties, 
    LaunchConditions, 
    TrajectoryResult,
    ProfileMetrics,
    ProfileOptions
} from '../types';
import { FlightIntegrator } from './flight-integrator';
import { OptimizationAlgorithms } from './optimization-algorithms';
import { CacheManager } from './cache-manager';
import { PerformanceMonitor } from './performance-monitor';
import { AerodynamicsEngineImpl } from './aerodynamics-engine';
import os from 'os';

export class PerformanceProfiler {
    private readonly integrator: FlightIntegrator;
    private readonly optimizer: OptimizationAlgorithms;
    private readonly cache: CacheManager;
    private readonly monitor: PerformanceMonitor;
    private readonly maxConcurrency: number;
    private readonly aero = new AerodynamicsEngineImpl();

    constructor() {
        this.integrator = new FlightIntegrator();
        this.optimizer = new OptimizationAlgorithms();
        this.cache = CacheManager.getInstance();
        this.monitor = PerformanceMonitor.getInstance();
        this.maxConcurrency = os.cpus().length;
    }

    async profileIntegration(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties,
        iterations: number,
        options: ProfileOptions = {}
    ): Promise<ProfileMetrics> {
        const {
            maxParallelTasks = Math.max(1, Math.floor(this.maxConcurrency / 2)),
            adaptiveBatching = false,
            minBatchSize = 1,
            maxBatchSize = this.maxConcurrency,
            targetExecutionTime = 100 // ms
        } = options;

        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        let peakMemory = startMemory;
        let totalMemory = 0;
        let memoryReadings = 0;
        let currentBatchSize = minBatchSize;
        let batchSizeAdjustments = 0;
        let totalBatchSize = 0;
        let batchCount = 0;

        const results = [];
        for (let i = 0; i < iterations;) {
            const batchTasks = [];
            const batchStartTime = Date.now();
            
            for (let j = 0; j < Math.min(currentBatchSize, iterations - i); j++) {
                batchTasks.push(this.integrator.simulateFlight(
                    initialState,
                    environment,
                    properties,
                    this.aero
                ));
                i++;
            }

            const batchResults = await Promise.all(batchTasks);
            results.push(...batchResults);

            // Memory tracking
            const currentMemory = process.memoryUsage().heapUsed;
            peakMemory = Math.max(peakMemory, currentMemory);
            totalMemory += currentMemory;
            memoryReadings++;

            // Adaptive batch sizing
            if (adaptiveBatching) {
                const batchDuration = Date.now() - batchStartTime;
                if (batchDuration > targetExecutionTime * 1.2) {
                    currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize * 0.8));
                    batchSizeAdjustments++;
                } else if (batchDuration < targetExecutionTime * 0.8) {
                    currentBatchSize = Math.min(maxBatchSize, Math.ceil(currentBatchSize * 1.2));
                    batchSizeAdjustments++;
                }
            }

            totalBatchSize += currentBatchSize;
            batchCount++;
        }

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;

        let totalPoints = 0;
        let totalStepSize = 0;
        let stepCount = 0;

        for (const result of results) {
            totalPoints += result.points.length;
            for (let i = 1; i < result.points.length; i++) {
                totalStepSize += result.points[i].time - result.points[i-1].time;
                stepCount++;
            }
        }

        return {
            executionTime: endTime - startTime,
            memoryUsage: {
                initial: startMemory,
                final: endMemory,
                peak: peakMemory,
                average: totalMemory / memoryReadings
            },
            trajectoryPoints: totalPoints,
            averageStepSize: stepCount > 0 ? totalStepSize / stepCount : 0,
            batchSizeAdjustments: adaptiveBatching ? batchSizeAdjustments : undefined,
            averageBatchSize: batchCount > 0 ? totalBatchSize / batchCount : undefined
        };
    }

    async profileOptimization(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties,
        iterations: number,
        options: ProfileOptions = {}
    ): Promise<ProfileMetrics> {
        const {
            maxParallelTasks = Math.max(1, Math.floor(this.maxConcurrency / 2)),
            adaptiveBatching = false,
            minBatchSize = 1,
            maxBatchSize = this.maxConcurrency,
            targetExecutionTime = 200 // ms
        } = options;

        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        let peakMemory = startMemory;
        let totalMemory = 0;
        let memoryReadings = 0;
        let currentBatchSize = minBatchSize;
        let batchSizeAdjustments = 0;
        let totalBatchSize = 0;
        let batchCount = 0;

        const initialCacheStats = this.cache.getStats();
        const results = [];

        // Metric function for optimization
        const metricFn = (trajectory: TrajectoryResult) => {
            // Example metric: total distance traveled
            const lastPoint = trajectory.points[trajectory.points.length - 1];
            return Math.sqrt(
                lastPoint.position.x * lastPoint.position.x +
                lastPoint.position.y * lastPoint.position.y
            );
        };

        for (let i = 0; i < iterations;) {
            const batchTasks = [];
            const batchStartTime = Date.now();
            
            for (let j = 0; j < Math.min(currentBatchSize, iterations - i); j++) {
                const modifiedConditions = {
                    ...conditions,
                    ballSpeed: conditions.ballSpeed + (Math.random() - 0.5) * 2
                };
                batchTasks.push(this.optimizer.particleSwarmOptimization(
                    modifiedConditions,
                    environment,
                    properties,
                    metricFn,
                    10, // Reduced number of particles for performance testing
                    20  // Reduced iterations for performance testing
                ));
                i++;
            }

            const batchResults = await Promise.all(batchTasks);
            results.push(...batchResults.map(r => r.trajectory));

            // Memory tracking
            const currentMemory = process.memoryUsage().heapUsed;
            peakMemory = Math.max(peakMemory, currentMemory);
            totalMemory += currentMemory;
            memoryReadings++;

            // Adaptive batch sizing
            if (adaptiveBatching) {
                const batchDuration = Date.now() - batchStartTime;
                if (batchDuration > targetExecutionTime * 1.2) {
                    currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize * 0.8));
                    batchSizeAdjustments++;
                } else if (batchDuration < targetExecutionTime * 0.8) {
                    currentBatchSize = Math.min(maxBatchSize, Math.ceil(currentBatchSize * 1.2));
                    batchSizeAdjustments++;
                }
            }

            totalBatchSize += currentBatchSize;
            batchCount++;
        }

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        const finalCacheStats = this.cache.getStats();

        return {
            executionTime: endTime - startTime,
            memoryUsage: {
                initial: startMemory,
                final: endMemory,
                peak: peakMemory,
                average: totalMemory / memoryReadings
            },
            trajectoryPoints: results.reduce((sum, r) => sum + r.points.length, 0),
            averageStepSize: 0, // Not relevant for optimization
            cacheHits: this.monitor.getCacheHits(),
            cacheMisses: this.monitor.getCacheMisses(),
            cacheSize: finalCacheStats.memoryUsage,
            cacheEvictions: finalCacheStats.size - initialCacheStats.size,
            batchSizeAdjustments: adaptiveBatching ? batchSizeAdjustments : undefined,
            averageBatchSize: batchCount > 0 ? totalBatchSize / batchCount : undefined
        };
    }
}
