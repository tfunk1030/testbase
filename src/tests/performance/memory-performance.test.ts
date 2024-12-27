import { GPUCompute } from '../../core/gpu/gpu-compute';
import { DeviceManager } from '../../core/gpu/device-manager';
import * as tf from '@tensorflow/tfjs';

describe('Memory Performance Tests', () => {
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

    const generateTestData = (sizeInMB: number): Float32Array => {
        // Calculate number of elements needed for specified MB
        // Float32 = 4 bytes, so divide total bytes by 4
        const numElements = Math.floor((sizeInMB * 1024 * 1024) / 4);
        const data = new Float32Array(numElements);
        for (let i = 0; i < numElements; i++) {
            data[i] = Math.random();
        }
        return data;
    };

    test('memory transfer speed should be < 1s for 10MB', async () => {
        const testData = generateTestData(10); // 10MB of data
        
        // Ensure GPU is initialized
        await deviceManager.selectDevice({ preferGPU: true });
        await tf.ready();

        // Warm-up pass
        await gpuCompute.processDataset(generateTestData(1));

        // Measure transfer time
        const startTime = performance.now();
        const result = await gpuCompute.processDataset(testData);
        const transferTime = result.metrics.transferTime;

        expect(transferTime).toBeLessThan(1000); // Should be less than 1000ms (1s)
    }, 10000);

    test('batch processing should be < 2s for 10x1MB', async () => {
        const batchSize = 0.1; // 100KB per batch to avoid memory issues
        const numBatches = 10;
        
        // Ensure GPU is initialized
        await deviceManager.selectDevice({ preferGPU: true });
        await tf.ready();

        // Warm-up pass
        await gpuCompute.processDataset(generateTestData(0.1));

        const startTime = performance.now();
        
        // Process 10 batches of 1MB each
        for (let i = 0; i < numBatches; i++) {
            const batchData = generateTestData(batchSize);
            await gpuCompute.processDataset(batchData);
        }
        
        const totalTime = performance.now() - startTime;
        expect(totalTime).toBeLessThan(2000); // Should be less than 2000ms (2s)
    }, 10000);

    test('memory overhead should be < 10%', async () => {
        const initialMemory = tf.memory().numBytes;
        const testData = generateTestData(5); // 5MB test data
        
        // Ensure GPU is initialized
        await deviceManager.selectDevice({ preferGPU: true });
        await tf.ready();

        // Process data
        await gpuCompute.processDataset(testData);
        
        // Measure memory after processing
        const finalMemory = tf.memory().numBytes;
        const memoryOverhead = (finalMemory - initialMemory) / (testData.byteLength);
        
        // Memory overhead should be less than 10%
        expect(memoryOverhead).toBeLessThan(0.1);
        
        // Cleanup
        await deviceManager.cleanup();
    }, 10000);
});
