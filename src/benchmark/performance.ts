import { FlightModel } from '../api/flight-model';
import { TrajectoryResult } from '../core/types';

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
    public async measureSingleShot(): Promise<{
        executionTime: number;
        memoryUsage: number;
        trajectory: TrajectoryResult;
    }> {
        const startTime = process.hrtime();
        const startMemory = process.memoryUsage().heapUsed;

        // Generate random conditions
        const conditions = this.model.generateRandomConditions();
        const environment = this.model.generateRandomEnvironment();
        const ballProperties = this.model.generateRandomBallProperties();

        // Run simulation
        const trajectory = await this.model.simulateShot(conditions, environment, ballProperties);

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
    public async measureBatch(batchSize: number): Promise<{
        totalTime: number;
        averageTime: number;
        totalMemory: number;
        averageMemory: number;
        trajectories: TrajectoryResult[];
    }> {
        const startTime = process.hrtime();
        const startMemory = process.memoryUsage().heapUsed;

        // Run multiple simulations
        const trajectories: TrajectoryResult[] = [];
        for (let i = 0; i < batchSize; i++) {
            const conditions = this.model.generateRandomConditions();
            const environment = this.model.generateRandomEnvironment();
            const ballProperties = this.model.generateRandomBallProperties();

            const trajectory = await this.model.simulateShot(conditions, environment, ballProperties);
            trajectories.push(trajectory);
        }

        // Calculate metrics
        const endTime = process.hrtime(startTime);
        const endMemory = process.memoryUsage().heapUsed;

        const totalTime = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
        const totalMemory = endMemory - startMemory;

        return {
            totalTime,
            averageTime: totalTime / batchSize,
            totalMemory,
            averageMemory: totalMemory / batchSize,
            trajectories
        };
    }
}

// Run benchmarks
async function runBenchmarks() {
    console.log('===================================================');
    console.log('Golf Ball Flight Model - Performance Benchmark');
    console.log('===================================================');

    const benchmark = new PerformanceBenchmark();

    // Single shot performance
    console.log('\nSingle Shot Performance:');
    const singleResult = await benchmark.measureSingleShot();
    console.log(`Execution Time: ${singleResult.executionTime.toFixed(2)} ms`);
    console.log(`Memory Usage: ${(singleResult.memoryUsage / 1024).toFixed(2)} KB`);

    // Batch performance
    console.log('\nBatch Performance (100 shots):');
    const batchResult = await benchmark.measureBatch(100);
    console.log(`Total Time: ${batchResult.totalTime.toFixed(2)} ms`);
    console.log(`Average Time per Shot: ${batchResult.averageTime.toFixed(2)} ms`);
    console.log(`Total Memory: ${(batchResult.totalMemory / 1024).toFixed(2)} KB`);
    console.log(`Average Memory per Shot: ${(batchResult.averageMemory / 1024).toFixed(2)} KB`);
}

// Run benchmarks
runBenchmarks().catch(console.error);
