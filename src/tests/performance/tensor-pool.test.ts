import * as tf from '@tensorflow/tfjs-node-gpu';
import { TensorPool } from '../../core/gpu/tensor-pool';
import { DeviceManager } from '../../core/gpu/device-manager';

// Mock TensorFlow functions
jest.mock('@tensorflow/tfjs-node-gpu', () => ({
    ...jest.requireActual('@tensorflow/tfjs-node-gpu'),
    tidy: jest.fn(),
    tensor: jest.fn(),
    dispose: jest.fn(),
    zeros: jest.fn(() => ({
        shape: [1, 1],
        dataSync: () => new Float32Array([0]),
        dispose: jest.fn(),
        arraySync: jest.fn(() => [[0]]),
        add: jest.fn(x => x),
        mul: jest.fn(x => x),
        isDisposed: false
    }))
}));

// Mock DeviceManager
jest.mock('../../core/gpu/device-manager', () => ({
    DeviceManager: {
        getInstance: jest.fn(() => ({
            selectDevice: jest.fn(),
        })),
    },
}));

describe('TensorPool', () => {
    let mockTensor: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTensor = {
            isDisposed: false,
            dispose: jest.fn(),
        };
        (tf.tensor as jest.Mock).mockReturnValue(mockTensor);
        (tf.tidy as jest.Mock).mockImplementation((fn) => fn());
    });

    let tensorPool: TensorPool;

    beforeEach(() => {
        tensorPool = new TensorPool();
    });

    describe('transferToGPU', () => {
        test('should successfully transfer data to GPU', async () => {
            const data = new Float32Array([1, 2, 3]);
            const result = await tensorPool.transferToGPU(data);
            
            expect(tf.tensor).toHaveBeenCalledWith(data);
            expect(tf.tidy).toHaveBeenCalled();
            expect(result).toBe(mockTensor);
        });

        test('should handle tensor disposal and initialize buffers', async () => {
            const data = new Float32Array([1, 2, 3]);
            mockTensor.isDisposed = true;
            
            const deviceManager = DeviceManager.getInstance();
            const zeros = jest.spyOn(tf, 'zeros');
            
            await tensorPool.transferToGPU(data);
            
            // Verify device reset
            expect(deviceManager.selectDevice).toHaveBeenCalledWith({ preferGPU: true });
            expect(tf.dispose).toHaveBeenCalled();
            
            // Verify buffer initialization
            expect(zeros).toHaveBeenCalledWith([1, 1024]);
            expect(zeros).toHaveBeenCalledWith([1, 2048]);
            expect(zeros).toHaveBeenCalledWith([32, 32]);
            
            // Each shape should be preallocated 5 times
            expect(zeros).toHaveBeenCalledTimes(15);
            
            // Verify pools are populated
            const pool1024 = tensorPool['pools'].get('1,1024');
            const pool2048 = tensorPool['pools'].get('1,2048');
            const pool32 = tensorPool['pools'].get('32,32');
            
            expect(pool1024?.length).toBe(5);
            expect(pool2048?.length).toBe(5);
            expect(pool32?.length).toBe(5);
        });

        test('should reinitialize buffers after device reset', async () => {
            const data = new Float32Array([1, 2, 3]);
            mockTensor.isDisposed = true;
            
            // First reset
            await tensorPool.transferToGPU(data);
            
            // Clear mocks and trigger another reset
            jest.clearAllMocks();
            mockTensor.isDisposed = true;
            await tensorPool.transferToGPU(data);
            
            // Verify buffers were reinitialized
            const zeros = jest.spyOn(tf, 'zeros');
            expect(zeros).toHaveBeenCalledTimes(15); // 3 shapes × 5 tensors
        });
    });


    afterEach(() => {
        tensorPool.dispose();
    });

    test('should create new tensor when pool is empty', () => {
        const shape = [2, 3];
        const tensor = tensorPool.reuseOrCreateTensor(shape);
        
        expect(tensor.shape).toEqual(shape);
        expect(Array.isArray(tensor.arraySync())).toBe(true);
    });

    test('should reuse released tensor', () => {
        const shape = [2, 3];
        const tensor1 = tensorPool.reuseOrCreateTensor(shape);
        tensorPool.releaseTensor(tensor1);
        const tensor2 = tensorPool.reuseOrCreateTensor(shape);
        
        expect(tensor2).toBe(tensor1);
    });

    test('should handle multiple tensor shapes', () => {
        const shape1 = [2, 3];
        const shape2 = [4, 5];
        
        const tensor1 = tensorPool.reuseOrCreateTensor(shape1);
        const tensor2 = tensorPool.reuseOrCreateTensor(shape2);
        
        tensorPool.releaseTensor(tensor1);
        tensorPool.releaseTensor(tensor2);
        
        const reusedTensor1 = tensorPool.reuseOrCreateTensor(shape1);
        const reusedTensor2 = tensorPool.reuseOrCreateTensor(shape2);
        
        expect(reusedTensor1).toBe(tensor1);
        expect(reusedTensor2).toBe(tensor2);
    });

    test('should properly dispose tensors', () => {
        const shape = [2, 3];
        const tensor = tensorPool.reuseOrCreateTensor(shape);
        tensorPool.releaseTensor(tensor);
        tensorPool.dispose();
        
        // Attempting to use the disposed tensor should throw
        expect(() => tensor.arraySync()).toThrow();
    });

    test('should process batch of tensors with custom function', async () => {
        const tensors = Array(250).fill(null).map(() => tf.zeros([2, 3]));
        const processFunction = (t: tf.Tensor) => t.add(1);
        
        const results = await tensorPool.processBatch(tensors, processFunction);
        
        expect(results.length).toBe(250);
        results.forEach(tensor => {
            expect(tensor.shape).toEqual([2, 3]);
            // Check if all values are 1 (zeros + 1)
            expect(tensor.dataSync().every(val => val === 1)).toBe(true);
        });

        // Cleanup
        results.forEach(tensor => tensor.dispose());
        tensors.forEach(tensor => tensor.dispose());
    });

    test('should process batch of tensors without custom function', async () => {
        const tensors = Array(150).fill(null).map(() => tf.zeros([4, 4]));
        
        const results = await tensorPool.processBatch(tensors);
        
        expect(results.length).toBe(150);
        results.forEach(tensor => {
            expect(tensor.shape).toEqual([4, 4]);
            // Check if all values are 0 (no processing function)
            expect(tensor.dataSync().every(val => val === 0)).toBe(true);
        });

        // Cleanup
        results.forEach(tensor => tensor.dispose());
        tensors.forEach(tensor => tensor.dispose());
    });

    test('should handle empty batch', async () => {
        const results = await tensorPool.processBatch([]);
        expect(results.length).toBe(0);
    });

    test('should handle batch smaller than chunk size', async () => {
        const tensors = Array(50).fill(null).map(() => tf.zeros([2, 2]));
        const processFunction = (t: tf.Tensor) => t.mul(2);
        
        const results = await tensorPool.processBatch(tensors, processFunction);
        
        expect(results.length).toBe(50);
        
        // Cleanup
        results.forEach(tensor => tensor.dispose());
        tensors.forEach(tensor => tensor.dispose());
    });
});
