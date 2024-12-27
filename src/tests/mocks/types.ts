// Type declarations for test mocks
import { MemoryUsage } from '../../core/types';

// Declare class interfaces
declare class GPUCompute {
    transferToGPU(data: Float32Array): Promise<{ data: Float32Array; dispose: () => void }>;
    processDataset(data: Float32Array): Promise<{
        data: Float32Array;
        metrics: {
            computeTime: number;
            transferTime: number;
            memoryUsage: number;
            gpuUtilization: number;
        };
    }>;
}

declare class PerformanceMonitor {
    clearMetrics(): void;
    startOperation(name: string): void;
    getMemoryUsage(): Promise<MemoryUsage>;
}

declare class CacheWarmer {
    constructor(analytics: any, maxSize: number);
    preloadData(key: string, data: any, size: number): Promise<void>;
    warmup(keys: string[]): Promise<void>;
}

declare class MemoryManager {
    constructor();
    allocateMemory(size: number): Promise<void>;
}

declare class ThreadManager {
    constructor(threadCount: number);
    shutdown(): Promise<void>;
    processWorkload(workload: any): Promise<void>;
    getThreadStats(): Promise<any[]>;
    submitTask(task: Function): Promise<any>;
    getActiveThreadCount(): Promise<number>;
    threadCount: number;
}

// Export types
export {
    GPUCompute,
    PerformanceMonitor,
    CacheWarmer,
    MemoryManager,
    ThreadManager
};
