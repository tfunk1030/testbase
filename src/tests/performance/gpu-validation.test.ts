import { GPUCompute, ComputeResult, ValidationError, OutOfMemoryError, DeviceError } from '../../core/gpu/gpu-compute';
import { DeviceManager } from '../../core/gpu/device-manager';
import * as tf from '@tensorflow/tfjs';

describe('GPU Performance Validation', () => {
    let gpuCompute: GPUCompute;
    let deviceManager: DeviceManager;

    beforeEach(async () => {
        gpuCompute = GPUCompute.getInstance();
        deviceManager = DeviceManager.getInstance();
        await tf.ready();
        // Warm up GPU
        const warmupData = generateTestData(0.1); // 100KB warmup
        await gpuCompute.processDataset(warmupData);
    });

    afterEach(async () => {
        if (gpuCompute?.dispose) {
            gpuCompute.dispose();
        }
        const engine = tf.engine();
        if (engine?.reset) {
            engine.reset();
        }
    });

    const generateTestData = (sizeInMB: number): Float32Array => {
        const numElements = Math.floor((sizeInMB * 1024 * 1024) / 4);
        const data = new Float32Array(numElements);
        for (let i = 0; i < numElements; i++) {
            data[i] = Math.random();
        }
        return data;
    };

    describe('Performance Metrics', () => {
        test('memory transfer speed meets target for 10MB data', async () => {
            const data = generateTestData(10);
            const result = await gpuCompute.processDataset(data);
            expect(result.metrics.transferTime).toBeLessThan(1000); // < 1s
        }, 10000);

        test('batch processing meets target for 10x1MB batches', async () => {
            const batchSize = 1; // 1MB
            const numBatches = 10;
            const startTime = performance.now();

            for (let i = 0; i < numBatches; i++) {
                await gpuCompute.processDataset(generateTestData(batchSize));
            }
            
            const totalTime = performance.now() - startTime;
            expect(totalTime).toBeLessThan(2000); // < 2s
        }, 10000);

        test('memory overhead stays within target', async () => {
            const initialMemory = tf.memory().numBytes;
            const data = generateTestData(5); // 5MB
            
            const result = await gpuCompute.processDataset(data);
            
            const overhead = (result.metrics.memoryUsage / (data.length * 4)) - 1;
            expect(overhead).toBeLessThan(0.1); // < 10%
        });
    });

    describe('Error Handling', () => {
        test('recovers from device failures', async () => {
            // Force device failure by corrupting WebGL context
            const engine = tf.engine();
            await deviceManager.selectDevice({ preferGPU: true });
            
            // Simulate device failure
            await deviceManager.resetDevice();
            const data = generateTestData(1);
            
            // Should automatically recover and process on CPU
            const result = await gpuCompute.processDataset(data);
            
            expect(result.data).toBeDefined();
            expect(result.metrics).toBeDefined();
            expect(deviceManager.getActiveDevice()).toBe('cpu');
            
            // Verify can recover back to GPU
            await deviceManager.selectDevice({ preferGPU: true });
            const result2 = await gpuCompute.processDataset(data);
            expect(deviceManager.getActiveDevice()).toBe('webgl');
        });

        test('handles memory exhaustion', async () => {
            // Create data large enough to cause memory pressure
            const largeData = generateTestData(500); // 500MB
            const smallData = generateTestData(1); // 1MB control
            
            try {
                // Process large data to trigger memory pressure
                await gpuCompute.processDataset(largeData);
                fail('Expected OutOfMemoryError');
            } catch (error) {
                if (error instanceof OutOfMemoryError) {
                    expect(error.message).toMatch(/memory|allocation|OOM/i);
                } else {
                    throw error;
                }
            }
            
            // Should recover and process new data
            const result = await gpuCompute.processDataset(smallData);
            expect(result.data).toBeDefined();
            expect(result.metrics.memoryUsage).toBeDefined();
        });

        test('handles invalid operations gracefully', async () => {
            // Test empty data
            await expect(async () => {
                await gpuCompute.processDataset(new Float32Array(0));
            }).rejects.toThrow(ValidationError);
            
            // Test null data
            await expect(async () => {
                await gpuCompute.processDataset(null as any);
            }).rejects.toThrow(ValidationError);
            
            // Test invalid data type
            await expect(async () => {
                await gpuCompute.processDataset([1,2,3] as any);
            }).rejects.toThrow(ValidationError);
            
            // Test oversized dimensions
            const invalidShape = generateTestData(1);
            (invalidShape as any).shape = [-1, 0];
            await expect(async () => {
                await gpuCompute.processDataset(invalidShape);
            }).rejects.toThrow(ValidationError);
        });

        test('provides meaningful error messages', async () => {
            try {
                await gpuCompute.processDataset(null as any);
                fail('Expected ValidationError');
            } catch (error) {
                if (error instanceof ValidationError) {
                    expect(error.message).toMatch(/Invalid data: Dataset is null/);
                    expect(error.name).toBe('ValidationError');
                } else {
                    throw error;
                }
            }

            try {
                const oversizedData = generateTestData(1000); // 1GB
                await gpuCompute.processDataset(oversizedData);
                fail('Expected OutOfMemoryError');
            } catch (error) {
                if (error instanceof OutOfMemoryError) {
                    expect(error.message).toMatch(/memory|allocation|OOM/i);
                    expect(error.name).toBe('OutOfMemoryError');
                } else {
                    throw error;
                }
            }

            try {
                await deviceManager.selectDevice({ minMemory: Number.MAX_VALUE });
                fail('Expected DeviceError');
            } catch (error) {
                if (error instanceof DeviceError) {
                    expect(error.message).toMatch(/Insufficient GPU memory/);
                    expect(error.name).toBe('DeviceError');
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Resource Management', () => {
        test('properly cleans up tensors', async () => {
            const initialTensors = tf.memory().numTensors;
            const data = generateTestData(1);
            
            await gpuCompute.processDataset(data);
            
            expect(tf.memory().numTensors).toBeLessThanOrEqual(initialTensors + 100);
        });

        test('memory pool functions correctly', async () => {
            const data = generateTestData(1);
            const results: ComputeResult[] = [];
            
            for (let i = 0; i < 5; i++) {
                results.push(await gpuCompute.processDataset(data));
            }
            
            const uniqueMemoryUsages = new Set(results.map(r => r.metrics.memoryUsage));
            expect(uniqueMemoryUsages.size).toBeLessThanOrEqual(2);
        });

        test('no memory leaks under sustained load', async () => {
            const iterations = 10;
            const data = generateTestData(1);
            const initialMemory = tf.memory().numBytes;
            
            for (let i = 0; i < iterations; i++) {
                await gpuCompute.processDataset(data);
            }
            
            const finalMemory = tf.memory().numBytes;
            expect(finalMemory).toBeLessThan(initialMemory * 2);
        });
    });

    describe('Integration', () => {
        test('maintains consistent performance', async () => {
            const iterations = 5;
            const data = generateTestData(1);
            const times: number[] = [];
            
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await gpuCompute.processDataset(data);
                times.push(performance.now() - start);
            }
            
            const avgTime = times.reduce((a, b) => a + b) / times.length;
            const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
            
            expect(maxDeviation / avgTime).toBeLessThan(2); // Allow more variation in test environment
        });

        test('handles concurrent operations', async () => {
            const concurrentOps = 3;
            const data = generateTestData(1);
            
            const promises = Array(concurrentOps)
                .fill(null)
                .map(() => gpuCompute.processDataset(data));
            
            const results = await Promise.all(promises);
            results.forEach(result => {
                expect(result.data).toBeDefined();
                expect(result.metrics).toBeDefined();
            });
        });
    });
});
