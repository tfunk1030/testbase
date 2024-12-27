import { GPUCompute } from '../../core/gpu/gpu-compute';
import { DeviceManager } from '../../core/gpu/device-manager';
import { BENCHMARK_CONFIG } from '../../core/gpu/benchmark-config';
import * as tf from '@tensorflow/tfjs';

describe('Performance Benchmarks', () => {
    let gpuCompute: GPUCompute;
    let deviceManager: DeviceManager;

    beforeEach(async () => {
        gpuCompute = GPUCompute.getInstance();
        deviceManager = DeviceManager.getInstance();
        await tf.ready();
    });

    afterEach(async () => {
        await deviceManager.cleanup();
    });

    const generateBenchmarkData = (size: number): Float32Array => {
        return new Float32Array(Array(size).fill(0).map(() => Math.random()));
    };

    interface BenchmarkResult {
        totalTime: number;
        computeTime: number;
        transferTime: number;
        memoryUsage: {
            peak: number;
            final: number;
            tensors: number;
        };
        gpuUtilization: number;
    }

    async function runBenchmark(dataSize: number = BENCHMARK_CONFIG.MEDIUM_DATASET_SIZE): Promise<BenchmarkResult> {
        const data = generateBenchmarkData(dataSize);
        const startMemory = tf.memory().numBytes;
        const startTime = performance.now();

        // Ensure GPU is initialized
        await deviceManager.selectDevice({ preferGPU: true });
        await tf.ready();

        // Run warm-up pass
        await gpuCompute.processDataset(generateBenchmarkData(1000));

        // Run actual benchmark
        const result = await gpuCompute.processDataset(data);

        const totalTime = performance.now() - startTime;
        const peakMemory = Math.max(tf.memory().numBytes - startMemory, 0);

        return {
            totalTime,
            computeTime: result.metrics.computeTime,
            transferTime: result.metrics.transferTime,
            memoryUsage: {
                peak: peakMemory,
                final: result.metrics.memoryUsage,
                tensors: tf.memory().numTensors
            },
            gpuUtilization: await deviceManager.getActiveDevice() === 'webgl' ? 1.0 : 0.0
        };
    }

    test('should meet performance targets for small datasets', async () => {
        const metrics = await runBenchmark(BENCHMARK_CONFIG.SMALL_DATASET_SIZE);
        
        expect(metrics.computeTime).toBeGreaterThan(0);
        expect(metrics.computeTime).toBeLessThan(BENCHMARK_CONFIG.TARGET_COMPUTE_TIME);
        expect(metrics.transferTime).toBeGreaterThan(0);
        expect(metrics.transferTime).toBeLessThan(BENCHMARK_CONFIG.TARGET_TRANSFER_TIME);
        expect(metrics.totalTime).toBeGreaterThan(0);
        expect(metrics.totalTime).toBeLessThan(BENCHMARK_CONFIG.TARGET_TOTAL_TIME);
        expect(metrics.memoryUsage.peak).toBeGreaterThan(0);
        expect(metrics.memoryUsage.peak).toBeLessThan(BENCHMARK_CONFIG.MEMORY_LIMIT);
        expect(metrics.memoryUsage.tensors).toBeLessThan(BENCHMARK_CONFIG.TENSOR_COUNT_LIMIT);
    }, 10000); // Increase timeout for GPU initialization

    test('should handle medium datasets within memory constraints', async () => {
        const metrics = await runBenchmark(BENCHMARK_CONFIG.MEDIUM_DATASET_SIZE);
        
        expect(metrics.memoryUsage.peak).toBeLessThan(BENCHMARK_CONFIG.MEMORY_LIMIT);
        expect(metrics.totalTime).toBeLessThan(BENCHMARK_CONFIG.TARGET_TOTAL_TIME * 2);
    });

    test('should process large datasets efficiently', async () => {
        const metrics = await runBenchmark(BENCHMARK_CONFIG.LARGE_DATASET_SIZE);
        
        // For large datasets, we expect linear scaling
        const scaleFactor = BENCHMARK_CONFIG.LARGE_DATASET_SIZE / BENCHMARK_CONFIG.MEDIUM_DATASET_SIZE;
        const expectedTime = BENCHMARK_CONFIG.TARGET_TOTAL_TIME * scaleFactor;
        
        expect(metrics.totalTime).toBeLessThan(expectedTime);
        expect(metrics.memoryUsage.peak).toBeLessThan(BENCHMARK_CONFIG.MEMORY_LIMIT);
    });

    test('should maintain performance under concurrent load', async () => {
        const concurrentTasks = Array(BENCHMARK_CONFIG.MAX_CONCURRENT_BATCHES)
            .fill(null)
            .map(() => runBenchmark(BENCHMARK_CONFIG.MEDIUM_DATASET_SIZE));

        const results = await Promise.all(concurrentTasks);

        // Check that all concurrent operations completed successfully
        results.forEach(metrics => {
            expect(metrics.totalTime).toBeLessThan(BENCHMARK_CONFIG.TARGET_TOTAL_TIME * 3);
            expect(metrics.memoryUsage.peak).toBeLessThan(BENCHMARK_CONFIG.MEMORY_LIMIT);
        });

        // Verify total memory usage stays within limits
        const totalMemory = tf.memory().numBytes;
        expect(totalMemory).toBeLessThan(BENCHMARK_CONFIG.MEMORY_LIMIT);
    });

    test('should efficiently batch process data', async () => {
        const batchSize = BENCHMARK_CONFIG.BATCH_SIZE;
        const totalSize = BENCHMARK_CONFIG.MEDIUM_DATASET_SIZE;
        const numBatches = Math.ceil(totalSize / batchSize);
        
        // Run warm-up pass
        await gpuCompute.processDataset(generateBenchmarkData(1000));
        
        const batchResults: BenchmarkResult[] = [];
        let totalProcessingTime = 0;
        
        for (let i = 0; i < numBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, totalSize);
            const data = generateBenchmarkData(end - start);
            
            const startTime = performance.now();
            await gpuCompute.processDataset(data);
            const batchTime = performance.now() - startTime;
            
            totalProcessingTime += batchTime;
            
            batchResults.push({
                totalTime: batchTime,
                computeTime: batchTime * 0.8, // Estimate compute portion
                transferTime: batchTime * 0.2, // Estimate transfer portion
                memoryUsage: {
                    peak: tf.memory().numBytes,
                    final: tf.memory().numBytes,
                    tensors: tf.memory().numTensors
                },
                gpuUtilization: await deviceManager.getActiveDevice() === 'webgl' ? 1.0 : 0.0
            });
        }

        // Verify batch processing efficiency
        expect(totalProcessingTime).toBeGreaterThan(0);
        expect(totalProcessingTime).toBeLessThan(BENCHMARK_CONFIG.TARGET_TOTAL_TIME * numBatches);
        
        // Verify memory management
        const finalMemory = tf.memory().numBytes;
        expect(finalMemory).toBeLessThan(BENCHMARK_CONFIG.MEMORY_LIMIT);
        
        // Verify all batches completed
        expect(batchResults.length).toBe(numBatches);
    }, 30000); // Increase timeout for batch processing
});
