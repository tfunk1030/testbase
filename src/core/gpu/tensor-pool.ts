import * as tf from '@tensorflow/tfjs-node-gpu';
import { DeviceManager } from './device-manager';

/**
 * A simple tensor pooling system that reuses tensors of the same shape
 * to reduce memory allocation and garbage collection overhead.
 */
export class TensorPool {
    private pools: Map<string, tf.Tensor[]>;
    private deviceManager: DeviceManager;

    constructor() {
        this.pools = new Map();
        this.deviceManager = DeviceManager.getInstance();
    }

    /**
     * Transfers data to GPU memory as a tensor with error recovery
     * @param data Float32Array of data to transfer
     * @returns Promise resolving to the GPU tensor
     */
    async transferToGPU(data: Float32Array): Promise<tf.Tensor> {
        try {
            const tensor = await tf.tidy(() => {
                const t = tf.tensor(data);
                // Keep tensor in memory and clone to prevent disposal
                return tf.keep(t.clone());
            });
            
            if (tensor.isDisposed) {
                throw new Error('Tensor was disposed during creation');
            }
            return tensor;
        } catch (error) {
            console.error('Transfer to GPU failed:', error);
            // Attempt recovery by resetting device and retrying
            await this.resetDevice();
            return this.transferToGPU(data);
        }
    }

    /**
     * Resets the device and reinitializes buffers
     */
    private async resetDevice(): Promise<void> {
        // Clean up existing tensors
        await tf.dispose();
        // Reset device and reinitialize
        await this.deviceManager.selectDevice({ preferGPU: true });
        await tf.ready();
        // Reinitialize tensor pools
        await this.initializeBuffers();
    }

    /**
     * Initializes GPU buffers and preallocates memory
     */
    private async initializeBuffers(): Promise<void> {
        // Clean up existing pool
        this.dispose();
        
        // Preallocate common tensor shapes with error handling
        const commonShapes = [[1, 1024], [1, 2048], [32, 32]];
        for (const shape of commonShapes) {
            try {
                const tensors = await tf.tidy(() => {
                    return Array(5).fill(null).map(() => {
                        const tensor = tf.zeros(shape);
                        return tf.keep(tensor); // Keep tensor in memory
                    });
                });
                const key = shape.join(',');
                this.pools.set(key, tensors);
            } catch (error) {
                console.error(`Failed to initialize buffer for shape ${shape}:`, error);
            }
        }
    }

    /**
     * Gets a tensor from the pool if available, or creates a new one if not.
     * @param shape The shape of the tensor needed
     * @returns A tensor of the requested shape
     */
    reuseOrCreateTensor(shape: number[]): tf.Tensor {
        const key = shape.join(',');
        const pool = this.pools.get(key) || [];
        return pool.pop() || tf.zeros(shape);
    }

    /**
     * Returns a tensor to the pool for reuse.
     * @param tensor The tensor to release back to the pool
     */
    releaseTensor(tensor: tf.Tensor): void {
        const key = tensor.shape.join(',');
        if (!this.pools.has(key)) {
            this.pools.set(key, []);
        }
        this.pools.get(key)!.push(tensor);
    }

    /**
     * Disposes all tensors in the pools and clears the pools.
     */
    dispose(): void {
        for (const pool of this.pools.values()) {
            pool.forEach(tensor => tensor.dispose());
        }
        this.pools.clear();
    }

    /**
     * Process a batch of tensors in chunks to optimize memory usage.
     * @param tensors Array of tensors to process
     * @param processFunction Optional custom processing function
     * @returns Processed tensor results
     */
    async processBatch(
        tensors: tf.Tensor[],
        processFunction?: (t: tf.Tensor) => tf.Tensor
    ): Promise<tf.Tensor[]> {
        const CHUNK_SIZE = 100;
        return tf.tidy(() => {
            const results: tf.Tensor[] = [];
            for (let i = 0; i < tensors.length; i += CHUNK_SIZE) {
                const chunk = tensors.slice(i, i + CHUNK_SIZE);
                const processedChunk = this.processChunk(chunk, processFunction);
                results.push(...processedChunk);
            }
            return results;
        });
    }

    /**
     * Process a chunk of tensors.
     * @param chunk Array of tensors to process
     * @param processFunction Optional custom processing function
     * @returns Processed tensor results
     */
    private processChunk(
        chunk: tf.Tensor[],
        processFunction?: (t: tf.Tensor) => tf.Tensor
    ): tf.Tensor[] {
        return chunk.map(tensor => {
            const reusedTensor = this.reuseOrCreateTensor(tensor.shape);
            if (processFunction) {
                const result = processFunction(reusedTensor);
                this.releaseTensor(reusedTensor);
                return result;
            }
            return reusedTensor;
        });
    }
}
