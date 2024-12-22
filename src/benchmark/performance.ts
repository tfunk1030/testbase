import { FlightModel } from '../api/flight-model';
import { Trajectory } from '../core/types';

/**
 * Benchmark the flight model performance
 */
export class PerformanceBenchmark {
    private readonly model: FlightModel;

    constructor() {
        this.model = new FlightModel();
    }

    /**
     * Measure single shot performance
     */
    public measureSingleShot(): {
        executionTime: number;
        memoryUsage: number;
        trajectory: Trajectory;
    } {
        const startTime = process.hrtime();
        const startMemory = process.memoryUsage().heapUsed;

        // Generate random conditions
        const conditions = this.model.generateRandomConditions();
        const environment = this.model.generateRandomEnvironment();
        const ballProperties = this.model.generateRandomBallProperties();

        // Run simulation
        const trajectory = this.model.simulateShot(
            conditions,
            environment,
            ballProperties
        );

        // Calculate metrics
        const endTime = process.hrtime(startTime);
        const endMemory = process.memoryUsage().heapUsed;

        const executionTime = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
        const memoryUsage = endMemory - startMemory;

        return {
            executionTime,
            memoryUsage,
            trajectory
        };
    }

    /**
     * Measure batch performance
     */
    public measureBatchPerformance(batchSize: number): {
        averageExecutionTime: number;
        averageMemoryUsage: number;
        averageTrajectoryPoints: number;
        totalExecutionTime: number;
        totalMemoryUsage: number;
    } {
        const startTime = process.hrtime();
        const startMemory = process.memoryUsage().heapUsed;

        // Generate and simulate batch
        const trajectories = this.model.generateRandomDataset(batchSize);

        // Calculate metrics
        const endTime = process.hrtime(startTime);
        const endMemory = process.memoryUsage().heapUsed;

        const totalExecutionTime = endTime[0] * 1000 + endTime[1] / 1000000;
        const totalMemoryUsage = endMemory - startMemory;

        // Calculate averages
        const averageTrajectoryPoints = trajectories.reduce((sum, t) => sum + t.points.length, 0) / batchSize;
        const averageExecutionTime = totalExecutionTime / batchSize;
        const averageMemoryUsage = totalMemoryUsage / batchSize;

        return {
            averageExecutionTime,
            averageMemoryUsage,
            averageTrajectoryPoints,
            totalExecutionTime,
            totalMemoryUsage
        };
    }

    /**
     * Run complete benchmark suite
     */
    public runBenchmarkSuite(): {
        singleShot: {
            executionTime: number;
            memoryUsage: number;
            trajectory: Trajectory;
        };
        smallBatch: {
            averageExecutionTime: number;
            averageMemoryUsage: number;
            averageTrajectoryPoints: number;
            totalExecutionTime: number;
            totalMemoryUsage: number;
        };
        largeBatch: {
            averageExecutionTime: number;
            averageMemoryUsage: number;
            averageTrajectoryPoints: number;
            totalExecutionTime: number;
            totalMemoryUsage: number;
        };
    } {
        return {
            singleShot: this.measureSingleShot(),
            smallBatch: this.measureBatchPerformance(100),
            largeBatch: this.measureBatchPerformance(1000)
        };
    }
}

// Run benchmarks
console.log('===================================================');
console.log('Golf Ball Flight Model - Performance Benchmark');
console.log('===================================================');

const benchmark = new PerformanceBenchmark();
const results = benchmark.runBenchmarkSuite();

console.log('Single Shot Performance:');
console.log('Execution Time:', results.singleShot.executionTime, 'ms');
console.log('Memory Usage:', results.singleShot.memoryUsage, 'bytes');
console.log('Trajectory Points:', results.singleShot.trajectory.points.length);

console.log();

console.log('Small Batch Performance (100 shots):');
console.log('Average Execution Time:', results.smallBatch.averageExecutionTime, 'ms');
console.log('Average Memory Usage:', results.smallBatch.averageMemoryUsage, 'bytes');
console.log('Average Trajectory Points:', results.smallBatch.averageTrajectoryPoints);
console.log('Total Execution Time:', results.smallBatch.totalExecutionTime, 'ms');
console.log('Total Memory Usage:', results.smallBatch.totalMemoryUsage, 'bytes');

console.log();

console.log('Large Batch Performance (1000 shots):');
console.log('Average Execution Time:', results.largeBatch.averageExecutionTime, 'ms');
console.log('Average Memory Usage:', results.largeBatch.averageMemoryUsage, 'bytes');
console.log('Average Trajectory Points:', results.largeBatch.averageTrajectoryPoints);
console.log('Total Execution Time:', results.largeBatch.totalExecutionTime, 'ms');
console.log('Total Memory Usage:', results.largeBatch.totalMemoryUsage, 'bytes');
