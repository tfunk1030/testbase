import * as tf from '@tensorflow/tfjs';

export interface PerformanceMetrics {
    memoryUsage: {
        numTensors: number;
        numBytes: number;
        unreliable: boolean;
    };
    computeTime: number;
    transferTime: number;
    gpuUtilization: number;
}

interface MemoryUsage {
    numTensors: number;
    numBytes: number;
    unreliable: boolean;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    
    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    private constructor() {
        if (PerformanceMonitor.instance) {
            throw new Error('Use PerformanceMonitor.getInstance() instead');
        }
    }

    async getMemoryUsage(): Promise<MemoryUsage> {
        const info = tf.memory();
        return {
            numTensors: info.numTensors,
            numBytes: info.numBytes,
            unreliable: info.unreliable || false
        };
    }

    async trackOperation(name: string, operation: () => Promise<void>): Promise<number> {
        const startTime = performance.now();
        await operation();
        return performance.now() - startTime;
    }

    async getGPUUtilization(): Promise<number> {
        // This would need platform-specific implementation
        // For now, return a mock value
        return 0;
    }

    private computeTimeAccumulator = 0;
    private transferTimeAccumulator = 0;
    private lastResetTime = Date.now();

    async getComputeMetrics(): Promise<number> {
        return this.computeTimeAccumulator;
    }

    async getTransferMetrics(): Promise<number> {
        return this.transferTimeAccumulator;
    }

    async trackComputeOperation(operation: () => Promise<void>): Promise<number> {
        const time = await this.trackOperation('compute', operation);
        this.computeTimeAccumulator += time;
        return time;
    }

    async trackTransferOperation(operation: () => Promise<void>): Promise<number> {
        const time = await this.trackOperation('transfer', operation);
        this.transferTimeAccumulator += time;
        return time;
    }

    resetAccumulators(): void {
        this.computeTimeAccumulator = 0;
        this.transferTimeAccumulator = 0;
        this.lastResetTime = Date.now();
    }

    async getDetailedMetrics(): Promise<PerformanceMetrics> {
        const memory = await this.getMemoryUsage();
        const compute = await this.getComputeMetrics();
        const transfer = await this.getTransferMetrics();
        const gpu = await this.getGPUUtilization();
        
        return {
            memoryUsage: memory,
            computeTime: compute,
            transferTime: transfer,
            gpuUtilization: gpu
        };
    }

    logMetrics(metrics: Record<string, number>): void {
        console.log('Performance Metrics:', metrics);
    }
}
