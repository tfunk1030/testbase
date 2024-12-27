import { GPUCompute } from '../core/gpu/gpu-compute';
import { PerformanceMonitor } from '../core/performance-monitor';
import { CacheWarmer } from '../core/cache/cache-warmer';
import { MemoryManager } from '../core/memory-manager';
import { ThreadManager } from '../core/thread-manager';

// Mock GPU methods
jest.mock('../core/gpu/gpu-compute', () => {
    const mockInstance = {
        transferToGPU: jest.fn().mockImplementation(async (data: Float32Array) => ({
            data,
            dispose: jest.fn()
        })),
        processDataset: jest.fn().mockImplementation(async (data: Float32Array) => {
            if (data.length === 0) {
                throw new Error('Invalid data');
            }
            return {
                data,
                metrics: {
                    computeTime: 10,
                    transferTime: 5,
                    memoryUsage: 1000,
                    gpuUtilization: 0.5
                }
            };
        }),
        dispose: jest.fn()
    };

    return {
        GPUCompute: {
            getInstance: jest.fn().mockReturnValue(mockInstance)
        }
    };
});

// Mock DeviceManager
jest.mock('../core/gpu/device-manager', () => {
    const mockInstance = {
        cleanup: jest.fn().mockImplementation(async () => {}),
        selectDevice: jest.fn().mockImplementation(async () => {}),
        getActiveDevice: jest.fn().mockReturnValue('webgl')
    };

    return {
        DeviceManager: {
            getInstance: jest.fn().mockReturnValue(mockInstance)
        }
    };
});

// Mock PerformanceMonitor
jest.mock('../core/performance-monitor', () => {
    return {
        PerformanceMonitor: jest.fn().mockImplementation(() => ({
            clearMetrics: jest.fn(),
            startOperation: jest.fn(),
            getMemoryUsage: jest.fn().mockImplementation(async () => ({
                numTensors: 100,
                numBytes: 1000,
                unreliable: false,
                total: 1000,
                used: 500,
                free: 500,
                heapTotal: 800,
                heapUsed: 400
            }))
        }))
    };
});

// Mock CacheWarmer
jest.mock('../core/cache/cache-warmer', () => {
    return {
        CacheWarmer: jest.fn().mockImplementation(() => ({
            preloadData: jest.fn().mockImplementation(async () => {}),
            warmup: jest.fn().mockImplementation(async () => {})
        }))
    };
});

// Mock MemoryManager
jest.mock('../core/memory-manager', () => {
    return {
        MemoryManager: jest.fn().mockImplementation(() => ({
            allocateMemory: jest.fn().mockImplementation(async () => {})
        }))
    };
});

// Mock ThreadManager
jest.mock('../core/thread-manager', () => {
    return {
        ThreadManager: jest.fn().mockImplementation(() => ({
            shutdown: jest.fn().mockImplementation(async () => {}),
            processWorkload: jest.fn().mockImplementation(async () => {}),
            getThreadStats: jest.fn().mockImplementation(async () => []),
            submitTask: jest.fn().mockImplementation(async () => {}),
            getActiveThreadCount: jest.fn().mockImplementation(async () => 4),
            threadCount: 4
        }))
    };
});

// Mock URL.createObjectURL
if (typeof window === 'undefined') {
    (global as any).URL = {
        createObjectURL: jest.fn(() => 'mock-url'),
        revokeObjectURL: jest.fn()
    };
}

// Mock TensorFlow
jest.mock('@tensorflow/tfjs', () => {
    const engine = {
        startScope: jest.fn(),
        endScope: jest.fn(),
        reset: jest.fn()
    };

    return {
        ready: jest.fn().mockResolvedValue(undefined),
        memory: jest.fn().mockReturnValue({
            numBytes: 1000000,
            numTensors: 100,
            numDataBuffers: 50,
            unreliable: false
        }),
        tensor: jest.fn().mockReturnValue({
            dispose: jest.fn(),
            dataSync: jest.fn().mockReturnValue(new Float32Array(100)),
            shape: [10, 10]
        }),
        dispose: jest.fn(),
        tidy: jest.fn((fn) => fn()),
        engine: jest.fn().mockReturnValue(engine)
    };
});

// Mock TextEncoder/TextDecoder if needed
if (typeof TextEncoder === 'undefined') {
    (global as any).TextEncoder = jest.fn(() => ({
        encode: jest.fn(str => new Uint8Array([]))
    }));
}

if (typeof TextDecoder === 'undefined') {
    (global as any).TextDecoder = jest.fn(() => ({
        decode: jest.fn(arr => '')
    }));
}

// Global test configuration
beforeEach(() => {
    jest.clearAllMocks();
});
