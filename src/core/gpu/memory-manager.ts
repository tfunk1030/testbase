import * as tf from '@tensorflow/tfjs-node-gpu';

export interface MemoryStats {
    numTensors: number;
    numBytes: number;
    numDataBuffers: number;
    poolSize: number;
    unreliable: boolean;
}

export interface TensorPoolConfig {
    maxPoolSize: number;
    minTensorSize: number;
    enableProfiling: boolean;
}

export class MemoryManager {
    private static instance: MemoryManager;
    private tensorPools: Map<string, tf.Tensor[]>;
    private config: TensorPoolConfig;
    private memoryProfile: Map<string, number>;

    private constructor() {
        this.tensorPools = new Map();
        this.memoryProfile = new Map();
        this.config = {
            maxPoolSize: 1000,
            minTensorSize: 1024,
            enableProfiling: true
        };
    }

    public static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    public acquireTensor(shape: number[], dtype: string = 'float32'): tf.Tensor {
        const key = this.getTensorKey(shape, dtype);
        const pool = this.tensorPools.get(key) || [];

        if (pool.length > 0) {
            const tensor = pool.pop()!;
            this.trackMemoryUsage('acquire', tensor);
            return tensor;
        }

        const newTensor = tf.zeros(shape, dtype as tf.DataType);
        this.trackMemoryUsage('create', newTensor);
        return newTensor;
    }

    public releaseTensor(tensor: tf.Tensor): void {
        const key = this.getTensorKey(tensor.shape, tensor.dtype);
        const pool = this.tensorPools.get(key) || [];

        if (pool.length < this.config.maxPoolSize) {
            pool.push(tensor);
            this.tensorPools.set(key, pool);
            this.trackMemoryUsage('release', tensor);
        } else {
            tensor.dispose();
            this.trackMemoryUsage('dispose', tensor);
        }
    }

    public getMemoryStats(): MemoryStats {
        const tfMemory = tf.memory();
        return {
            numTensors: tfMemory.numTensors,
            numBytes: tfMemory.numBytes,
            numDataBuffers: tfMemory.numDataBuffers,
            poolSize: this.getTotalPoolSize(),
            unreliable: tfMemory.unreliable
        };
    }

    public clearPools(): void {
        for (const pool of this.tensorPools.values()) {
            pool.forEach(tensor => tensor.dispose());
        }
        this.tensorPools.clear();
        this.memoryProfile.clear();
    }

    private getTensorKey(shape: number[], dtype: string): string {
        return `${shape.join('x')}_${dtype}`;
    }

    private getTotalPoolSize(): number {
        let total = 0;
        for (const pool of this.tensorPools.values()) {
            total += pool.length;
        }
        return total;
    }

    private trackMemoryUsage(operation: string, tensor: tf.Tensor): void {
        if (!this.config.enableProfiling) return;

        const bytes = tensor.size * Float32Array.BYTES_PER_ELEMENT;
        const currentUsage = this.memoryProfile.get(operation) || 0;
        this.memoryProfile.set(operation, currentUsage + bytes);
    }

    public getMemoryProfile(): Map<string, number> {
        return new Map(this.memoryProfile);
    }

    public updateConfig(config: Partial<TensorPoolConfig>): void {
        this.config = { ...this.config, ...config };
    }
}
