import * as tf from '@tensorflow/tfjs';
import { DeviceManager } from '../../core/gpu/device-manager';
import { GPUCompute } from '../../core/gpu/gpu-compute';
import { PerformanceMonitor } from '../../core/performance-monitor';

describe('GPU Optimization Tests', () => {
    let deviceManager: DeviceManager;
    let gpuCompute: GPUCompute;
    let performanceMonitor: PerformanceMonitor;

    beforeEach(() => {
        deviceManager = DeviceManager.getInstance();
        gpuCompute = GPUCompute.getInstance();
        performanceMonitor = PerformanceMonitor.getInstance();
    });

    afterEach(async () => {
        // Cleanup
        await tf.dispose();
    });

    describe('Memory Transfer Benchmarks', () => {
        test('should efficiently transfer large datasets to GPU', async () => {
            const data = new Float32Array(1024 * 1024 * 10); // 10MB of trajectory data
            
            const startTime = performance.now();
            const tensor = await gpuCompute.transferToGPU(data);
            const transferTime = performance.now() - startTime;

            expect(tensor).toBeDefined();
            expect(transferTime).toBeLessThan(1000); // Should transfer within 1 second
            
            // Verify data integrity
            const transferredData = await tensor.data();
            expect(transferredData.length).toBe(data.length);
        });

        test('should handle batch transfers efficiently', async () => {
            const batches = Array(10).fill(0).map(() => 
                new Float32Array(1024 * 1024) // 1MB each
            );

            const startTime = performance.now();
            const tensors = await Promise.all(
                batches.map(batch => gpuCompute.transferToGPU(batch))
            );
            const totalTime = performance.now() - startTime;

            expect(tensors.length).toBe(batches.length);
            expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
        });
    });

    describe('Resource Utilization Tests', () => {
        test('should efficiently manage GPU memory', async () => {
            const initialMemory = await performanceMonitor.getMemoryUsage();

            // Create and process large tensors
            await tf.tidy(() => {
                const largeTensor = tf.randomNormal([1024, 1024]);
                const result = largeTensor.square().mean();
                return result.dataSync();
            });

            const finalMemory = await performanceMonitor.getMemoryUsage();
            
            // Verify memory was properly released
            expect(finalMemory.numTensors).toBe(initialMemory.numTensors);
            expect(finalMemory.numBytes).toBeLessThanOrEqual(initialMemory.numBytes * 1.1); // Allow 10% overhead
        });

        test('should handle concurrent computations', async () => {
            const computations = Array(5).fill(0).map(async () => {
                return tf.tidy(() => {
                    const tensor = tf.randomNormal([512, 512]);
                    return tensor.square().mean().dataSync();
                });
            });

            const startTime = performance.now();
            await Promise.all(computations);
            const totalTime = performance.now() - startTime;

            expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });

    describe('Error Condition Tests', () => {
        test('should handle out-of-memory gracefully', async () => {
            expect.assertions(1);

            try {
                await tf.tidy(() => {
                    // Attempt to allocate an extremely large tensor
                    const hugeTensor = tf.zeros([1024 * 1024, 1024]);
                    return hugeTensor.dataSync();
                });
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        test('should recover from computation errors', async () => {
            // First cause an error
            try {
                await tf.tidy(() => {
                    const tensor = tf.zeros([1024 * 1024]);
                    return tensor.matMul(tf.zeros([1, 1])); // Invalid shape for matMul
                });
            } catch (error) {
                // Error expected
            }

            // Then verify we can still compute
            const result = await tf.tidy(() => {
                const tensor = tf.zeros([10, 10]);
                return tensor.mean().dataSync();
            });

            expect(result).toBeDefined();
        });

        test('should handle device disconnection', async () => {
            const initialDevice = deviceManager.getActiveDevice();
            
            // Simulate device switch
            await deviceManager.selectDevice({ preferGPU: false });
            
            // Verify computation still works
            const result = await tf.tidy(() => {
                const tensor = tf.zeros([10, 10]);
                return tensor.mean().dataSync();
            });

            expect(result).toBeDefined();
            
            // Restore original device
            if (initialDevice) {
                await deviceManager.selectDevice({ preferGPU: true });
            }
        });
    });
});
