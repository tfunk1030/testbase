import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';

interface TransferConfig {
    useAsync?: boolean;
    batchSize?: number;
    pinned?: boolean;
    compression?: boolean;
}

interface TransferStats {
    bytesTransferred: number;
    transferTime: number;
    throughput: number;
}

export class MemoryTransfer {
    private static instance: MemoryTransfer;
    private readonly gpuCompute: GPUCompute;
    private readonly transferBuffers: Map<string, ArrayBuffer> = new Map();
    private readonly pinnedMemory: Set<ArrayBuffer> = new Set();
    private readonly defaultConfig: Required<TransferConfig> = {
        useAsync: true,
        batchSize: 1024 * 1024, // 1MB
        pinned: true,
        compression: true
    };

    private constructor() {
        this.gpuCompute = GPUCompute.getInstance();
    }

    public static getInstance(): MemoryTransfer {
        if (!MemoryTransfer.instance) {
            MemoryTransfer.instance = new MemoryTransfer();
        }
        return MemoryTransfer.instance;
    }

    public async toGPU(
        data: ArrayBuffer | Float32Array | Float64Array,
        config: TransferConfig = {}
    ): Promise<tf.Tensor> {
        const opts = { ...this.defaultConfig, ...config };
        const startTime = performance.now();

        try {
            // Convert to appropriate format
            const buffer = this.prepareBuffer(data);

            // Compress if enabled
            const processedBuffer = opts.compression ?
                await this.compressBuffer(buffer) :
                buffer;

            // Split into batches if needed
            if (processedBuffer.byteLength > opts.batchSize) {
                return this.batchTransfer(processedBuffer, opts);
            }

            // Pin memory if enabled
            if (opts.pinned) {
                this.pinMemory(processedBuffer);
            }

            // Transfer to GPU
            const tensor = opts.useAsync ?
                await this.asyncTransfer(processedBuffer) :
                this.syncTransfer(processedBuffer);

            // Record stats
            const endTime = performance.now();
            this.recordTransferStats({
                bytesTransferred: processedBuffer.byteLength,
                transferTime: endTime - startTime,
                throughput: processedBuffer.byteLength / (endTime - startTime)
            });

            return tensor;
        } catch (error) {
            console.error('GPU transfer failed:', error);
            throw error;
        }
    }

    public async fromGPU(
        tensor: tf.Tensor,
        config: TransferConfig = {}
    ): Promise<ArrayBuffer> {
        const opts = { ...this.defaultConfig, ...config };
        const startTime = performance.now();

        try {
            // Get data from GPU
            const data = opts.useAsync ?
                await tensor.data() :
                tensor.dataSync();

            // Convert to buffer
            const buffer = data.buffer;

            // Decompress if needed
            const processedBuffer = opts.compression ?
                await this.decompressBuffer(buffer) :
                buffer;

            // Record stats
            const endTime = performance.now();
            this.recordTransferStats({
                bytesTransferred: processedBuffer.byteLength,
                transferTime: endTime - startTime,
                throughput: processedBuffer.byteLength / (endTime - startTime)
            });

            return processedBuffer;
        } catch (error) {
            console.error('GPU transfer failed:', error);
            throw error;
        }
    }

    private prepareBuffer(
        data: ArrayBuffer | Float32Array | Float64Array
    ): ArrayBuffer {
        if (data instanceof ArrayBuffer) {
            return data;
        }
        return data.buffer;
    }

    private async compressBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
        // Simple compression: convert to 16-bit floats if possible
        const view = new Float32Array(buffer);
        const compressed = new Float16Array(view.length);
        
        for (let i = 0; i < view.length; i++) {
            compressed[i] = view[i];
        }

        return compressed.buffer;
    }

    private async decompressBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
        // Decompress from 16-bit floats
        const view = new Float16Array(buffer);
        const decompressed = new Float32Array(view.length);
        
        for (let i = 0; i < view.length; i++) {
            decompressed[i] = view[i];
        }

        return decompressed.buffer;
    }

    private async batchTransfer(
        buffer: ArrayBuffer,
        config: Required<TransferConfig>
    ): Promise<tf.Tensor> {
        const chunks = this.splitBuffer(buffer, config.batchSize);
        const tensors: tf.Tensor[] = [];

        for (const chunk of chunks) {
            const tensor = config.useAsync ?
                await this.asyncTransfer(chunk) :
                this.syncTransfer(chunk);
            tensors.push(tensor);
        }

        return tf.concat(tensors);
    }

    private splitBuffer(
        buffer: ArrayBuffer,
        batchSize: number
    ): ArrayBuffer[] {
        const chunks: ArrayBuffer[] = [];
        let offset = 0;

        while (offset < buffer.byteLength) {
            const size = Math.min(batchSize, buffer.byteLength - offset);
            chunks.push(buffer.slice(offset, offset + size));
            offset += size;
        }

        return chunks;
    }

    private async asyncTransfer(buffer: ArrayBuffer): Promise<tf.Tensor> {
        return new Promise((resolve, reject) => {
            try {
                const tensor = tf.tensor(new Float32Array(buffer));
                resolve(tensor);
            } catch (error) {
                reject(error);
            }
        });
    }

    private syncTransfer(buffer: ArrayBuffer): tf.Tensor {
        return tf.tensor(new Float32Array(buffer));
    }

    private pinMemory(buffer: ArrayBuffer): void {
        if (this.pinnedMemory.has(buffer)) return;

        // Create a fixed location in memory
        const pinnedBuffer = new ArrayBuffer(buffer.byteLength);
        new Uint8Array(pinnedBuffer).set(new Uint8Array(buffer));
        
        this.pinnedMemory.add(pinnedBuffer);
        this.transferBuffers.set(buffer.toString(), pinnedBuffer);
    }

    private unpinMemory(buffer: ArrayBuffer): void {
        const pinnedBuffer = this.transferBuffers.get(buffer.toString());
        if (pinnedBuffer) {
            this.pinnedMemory.delete(pinnedBuffer);
            this.transferBuffers.delete(buffer.toString());
        }
    }

    private recordTransferStats(stats: TransferStats): void {
        // Could be extended to maintain historical stats
        console.debug('Transfer stats:', stats);
    }

    public cleanup(): void {
        // Unpin all memory
        for (const buffer of this.pinnedMemory) {
            this.unpinMemory(buffer);
        }

        // Clear maps
        this.transferBuffers.clear();
        this.pinnedMemory.clear();
    }
}

// Polyfill for Float16Array if not available
class Float16Array {
    private data: Uint16Array;

    constructor(length: number) {
        this.data = new Uint16Array(length);
    }

    public set(index: number, value: number): void {
        this.data[index] = this.toFloat16(value);
    }

    public get(index: number): number {
        return this.fromFloat16(this.data[index]);
    }

    private toFloat16(value: number): number {
        // Simple conversion, in practice would use proper IEEE-754 half-precision
        return Math.fround(value);
    }

    private fromFloat16(value: number): number {
        // Simple conversion, in practice would use proper IEEE-754 half-precision
        return value;
    }
}
