import { GPUCompute, ComputeResult } from '../../core/gpu/gpu-compute';
import { DeviceManager } from '../../core/gpu/device-manager';
import * as tf from '@tensorflow/tfjs';

describe('GPU Integration Tests', () => {
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

    const generateTestData = (size: number = 1000): Float32Array => {
        return new Float32Array(Array(size).fill(0).map(() => Math.random()));
    };

    const validateResults = (result: ComputeResult): void => {
        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.every(val => !isNaN(val))).toBe(true);
        
        expect(result.metrics).toBeDefined();
        expect(result.metrics.computeTime).toBeGreaterThan(0);
        expect(result.metrics.transferTime).toBeGreaterThan(0);
        expect(result.metrics.memoryUsage).toBeGreaterThan(0);
    };

    test('should handle full computation pipeline', async () => {
        const data = generateTestData();
        const result = await gpuCompute.processDataset(data);
        
        validateResults(result);
        expect(result.data.length).toBe(1); // Mean operation reduces to single value
    });

    test('should recover from device failures', async () => {
        // First successful computation
        const data = generateTestData();
        const initialResult = await gpuCompute.processDataset(data);
        validateResults(initialResult);

        // Simulate device failure by forcing a backend reset
        await deviceManager.resetDevice();

        // Attempt computation after failure
        const recoveryResult = await gpuCompute.processDataset(data);
        validateResults(recoveryResult);

        // Results should be consistent before and after recovery
        expect(recoveryResult.data[0]).toBeCloseTo(initialResult.data[0], 5);
    });

    test('should handle large datasets', async () => {
        const largeData = generateTestData(1000000); // 1M elements
        const result = await gpuCompute.processDataset(largeData);
        
        validateResults(result);
        expect(result.metrics.memoryUsage).toBeGreaterThan(0);
    });

    test('should maintain precision across operations', async () => {
        const data = new Float32Array([1.23456789, 2.34567890, 3.45678901]);
        const result = await gpuCompute.processDataset(data);
        
        validateResults(result);
        // Square and mean operations should maintain reasonable precision
        const expectedMean = (1.23456789**2 + 2.34567890**2 + 3.45678901**2) / 3;
        expect(result.data[0]).toBeCloseTo(expectedMean, 5);
    });

    test('should handle concurrent operations', async () => {
        const data1 = generateTestData(1000);
        const data2 = generateTestData(1000);
        
        const [result1, result2] = await Promise.all([
            gpuCompute.processDataset(data1),
            gpuCompute.processDataset(data2)
        ]);
        
        validateResults(result1);
        validateResults(result2);
    });

    test('should cleanup resources properly', async () => {
        const initialTensors = tf.memory().numTensors;
        
        const data = generateTestData();
        await gpuCompute.processDataset(data);
        
        // After processing, tensor count should return to initial state
        expect(tf.memory().numTensors).toBe(initialTensors);
    });
});
