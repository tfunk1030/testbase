import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';
import { DeviceManager } from './device-manager';
import { HardwareMonitor } from '../hardware/hardware-monitor';
import { MemoryManager } from '../hardware/memory-manager';

interface ResourceConfig {
    maxGPUMemory?: number;
    maxCPUMemory?: number;
    gpuUtilizationTarget?: number;
    memoryUtilizationTarget?: number;
    cleanupInterval?: number;
    preemptiveCleanup?: boolean;
}

interface ResourceUsage {
    gpu: {
        memoryUsed: number;
        utilization: number;
        temperature?: number;
    };
    cpu: {
        memoryUsed: number;
        utilization: number;
    };
    tensors: {
        count: number;
        bytes: number;
    };
}

export class ResourceManager {
    private static instance: ResourceManager;
    private readonly gpuCompute: GPUCompute;
    private readonly deviceManager: DeviceManager;
    private readonly hardwareMonitor: HardwareMonitor;
    private readonly memoryManager: MemoryManager;
    private readonly config: Required<ResourceConfig>;
    private cleanupTimer: NodeJS.Timer | null = null;
    private resourceWarnings: Set<string> = new Set();

    private constructor(config: ResourceConfig = {}) {
        this.gpuCompute = GPUCompute.getInstance();
        this.deviceManager = DeviceManager.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
        this.memoryManager = MemoryManager.getInstance();

        // Set default configuration
        this.config = {
            maxGPUMemory: config.maxGPUMemory || 0.8 * this.getAvailableGPUMemory(),
            maxCPUMemory: config.maxCPUMemory || 0.8 * this.getAvailableCPUMemory(),
            gpuUtilizationTarget: config.gpuUtilizationTarget || 80,
            memoryUtilizationTarget: config.memoryUtilizationTarget || 80,
            cleanupInterval: config.cleanupInterval || 5000,
            preemptiveCleanup: config.preemptiveCleanup ?? true
        };

        this.initialize();
    }

    public static getInstance(config?: ResourceConfig): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager(config);
        }
        return ResourceManager.instance;
    }

    private initialize(): void {
        // Start resource monitoring
        this.startMonitoring();

        // Register cleanup handlers
        this.registerCleanupHandlers();

        // Initialize tensor tracking
        this.initializeTensorTracking();
    }

    private startMonitoring(): void {
        this.cleanupTimer = setInterval(() => {
            this.monitorResources();
        }, this.config.cleanupInterval);
    }

    private async monitorResources(): Promise<void> {
        try {
            const usage = await this.getResourceUsage();

            // Check GPU memory
            if (usage.gpu.memoryUsed > this.config.maxGPUMemory) {
                this.handleResourceWarning('gpu_memory', 'GPU memory usage exceeds limit');
                if (this.config.preemptiveCleanup) {
                    await this.cleanupGPUMemory();
                }
            }

            // Check CPU memory
            if (usage.cpu.memoryUsed > this.config.maxCPUMemory) {
                this.handleResourceWarning('cpu_memory', 'CPU memory usage exceeds limit');
                if (this.config.preemptiveCleanup) {
                    await this.cleanupCPUMemory();
                }
            }

            // Check GPU utilization
            if (usage.gpu.utilization > this.config.gpuUtilizationTarget) {
                this.handleResourceWarning('gpu_utilization', 'GPU utilization exceeds target');
            }

            // Check tensor count
            if (usage.tensors.count > 1000) { // Arbitrary threshold
                this.handleResourceWarning('tensor_count', 'High number of tensors detected');
                if (this.config.preemptiveCleanup) {
                    await this.cleanupTensors();
                }
            }

        } catch (error) {
            console.error('Resource monitoring error:', error);
        }
    }

    private handleResourceWarning(type: string, message: string): void {
        if (!this.resourceWarnings.has(type)) {
            console.warn(`Resource Warning: ${message}`);
            this.resourceWarnings.add(type);

            // Clear warning after some time
            setTimeout(() => {
                this.resourceWarnings.delete(type);
            }, 300000); // 5 minutes
        }
    }

    private registerCleanupHandlers(): void {
        // Handle process exit
        process.on('beforeExit', async () => {
            await this.cleanup();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught Exception:', error);
            await this.cleanup();
            process.exit(1);
        });
    }

    private initializeTensorTracking(): void {
        tf.enableDebugMode();
        tf.engine().registerBackend('webgl', () => {
            const backend = tf.findBackend('webgl');
            if (backend) {
                // Add tensor tracking
                const originalMakeTensor = backend.makeTensor;
                backend.makeTensor = function(...args: any[]) {
                    const tensor = originalMakeTensor.apply(this, args);
                    // Track tensor creation
                    return tensor;
                };
            }
            return backend;
        });
    }

    public async allocateResources(
        requirements: {
            gpuMemory?: number;
            cpuMemory?: number;
            tensors?: number;
        }
    ): Promise<boolean> {
        const usage = await this.getResourceUsage();

        // Check GPU memory
        if (requirements.gpuMemory &&
            usage.gpu.memoryUsed + requirements.gpuMemory > this.config.maxGPUMemory) {
            return false;
        }

        // Check CPU memory
        if (requirements.cpuMemory &&
            usage.cpu.memoryUsed + requirements.cpuMemory > this.config.maxCPUMemory) {
            return false;
        }

        // Allocate memory pools if needed
        if (requirements.gpuMemory) {
            await this.memoryManager.createPool({
                name: `gpu_pool_${Date.now()}`,
                initialSize: requirements.gpuMemory,
                maxSize: requirements.gpuMemory * 1.2,
                itemSize: 1024
            });
        }

        return true;
    }

    public async releaseResources(
        resources: {
            gpuMemory?: number;
            cpuMemory?: number;
            tensors?: tf.Tensor[];
        }
    ): Promise<void> {
        // Release tensors
        if (resources.tensors) {
            tf.dispose(resources.tensors);
        }

        // Release memory pools
        if (resources.gpuMemory || resources.cpuMemory) {
            // Memory pools will be cleaned up automatically
            await this.memoryManager.cleanup();
        }
    }

    private async cleanupGPUMemory(): Promise<void> {
        // Dispose unused tensors
        tf.dispose();

        // Clear tensor caches
        const backend = tf.findBackend('webgl');
        if (backend) {
            // @ts-ignore: Access internal properties
            backend.disposeIntermediateTensorInfo();
        }

        // Run garbage collection
        if (global.gc) {
            global.gc();
        }
    }

    private async cleanupCPUMemory(): Promise<void> {
        // Clear memory pools
        await this.memoryManager.cleanup();

        // Run garbage collection
        if (global.gc) {
            global.gc();
        }
    }

    private async cleanupTensors(): Promise<void> {
        // Dispose all intermediate tensors
        tf.dispose();

        // Clear backend caches
        const backend = tf.findBackend('webgl');
        if (backend) {
            // @ts-ignore: Access internal properties
            backend.disposeIntermediateTensorInfo();
        }
    }

    private getAvailableGPUMemory(): number {
        const gpuInfo = this.gpuCompute.getGPUStatus();
        return gpuInfo.info?.memorySize || 0;
    }

    private getAvailableCPUMemory(): number {
        return this.hardwareMonitor.getHardwareProfile().memory.total;
    }

    public async getResourceUsage(): Promise<ResourceUsage> {
        const device = this.deviceManager.getActiveDevice();
        const gpuStatus = await this.gpuCompute.getGPUStatus();
        const cpuStatus = await this.hardwareMonitor.getResourceSnapshot();

        return {
            gpu: {
                memoryUsed: gpuStatus.memoryUsage || 0,
                utilization: device?.load || 0,
                temperature: device?.temperature
            },
            cpu: {
                memoryUsed: cpuStatus.memory.used,
                utilization: cpuStatus.cpu.usage
            },
            tensors: {
                count: tf.memory().numTensors,
                bytes: tf.memory().numBytes
            }
        };
    }

    public async cleanup(): Promise<void> {
        // Stop monitoring
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        // Cleanup GPU resources
        await this.cleanupGPUMemory();

        // Cleanup CPU resources
        await this.cleanupCPUMemory();

        // Clear warnings
        this.resourceWarnings.clear();
    }
}
