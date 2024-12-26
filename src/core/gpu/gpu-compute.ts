import * as tf from '@tensorflow/tfjs-node-gpu';
import { RealTimeMonitor } from '../real-time-monitor';
import { HardwareMonitor } from '../hardware/hardware-monitor';
import { MemoryManager } from './memory-manager';
import { DeviceManager } from './device-manager';
import { PerformanceMonitor } from './performance-monitor';

interface GPUInfo {
    name: string;
    memorySize: number;
    computeCapability: string;
    isAvailable: boolean;
    webGLVersion: 1 | 2;
    maxTextureSize: number;
}

interface ComputeOptions {
    precision?: 'high' | 'medium' | 'low';
    batchSize?: number;
    useAsync?: boolean;
    timeout?: number;
    useTensorPool?: boolean;
    enablePipelineCache?: boolean;
    validateShapes?: boolean;
}

interface TensorShape {
    dims: number[];
    dtype: 'float32' | 'int32';
}

class TensorPool {
    private static pools: Map<string, tf.Tensor[]> = new Map();
    
    static acquire(shape: number[], dtype: string = 'float32'): tf.Tensor {
        const key = `${shape.join('x')}_${dtype}`;
        const pool = this.pools.get(key) || [];
        return pool.pop() || tf.zeros(shape, dtype as 'float32');
    }
    
    static release(tensor: tf.Tensor): void {
        const key = `${tensor.shape.join('x')}_${tensor.dtype}`;
        const pool = this.pools.get(key) || [];
        pool.push(tensor);
        this.pools.set(key, pool);
    }
}

export class GPUCompute {
    private static instance: GPUCompute;
    private readonly monitor: RealTimeMonitor;
    private readonly hardwareMonitor: HardwareMonitor;
    private readonly memoryManager: MemoryManager;
    private readonly deviceManager: DeviceManager;
    private readonly performanceMonitor: PerformanceMonitor;
    private gpuInfo: GPUInfo | null = null;
    private isInitialized: boolean = false;
    private defaultOptions: Required<ComputeOptions> = {
        precision: 'high',
        batchSize: 128,
        useAsync: true,
        timeout: 30000,
        useTensorPool: true,
        enablePipelineCache: true,
        validateShapes: true
    };
    private tensorPool: TensorPool;
    private pipelineCache: Map<string, tf.Tensor> = new Map();
    private webGLVersion: 1 | 2 = 1;

    private constructor() {
        this.monitor = RealTimeMonitor.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
        this.memoryManager = MemoryManager.getInstance();
        this.deviceManager = DeviceManager.getInstance();
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.tensorPool = new TensorPool();
    }

    public static getInstance(): GPUCompute {
        if (!GPUCompute.instance) {
            GPUCompute.instance = new GPUCompute();
        }
        return GPUCompute.instance;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Initialize TensorFlow.js with GPU support
            await tf.setBackend('webgl');
            const backend = tf.getBackend();
            
            if (backend === 'webgl') {
                const gpu = await this.getGPUInfo();
                this.gpuInfo = gpu;
                this.isInitialized = true;
                
                this.monitor.emit('gpuInitialized', {
                    status: 'success',
                    info: gpu
                });
            } else {
                throw new Error('WebGL backend not available');
            }
        } catch (error) {
            this.monitor.emit('gpuInitialized', {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    private async getGPUInfo(): Promise<GPUInfo> {
        const gl = await this.getWebGLContext();
        if (!gl) {
            return {
                name: 'No GPU Available',
                memorySize: 0,
                computeCapability: 'none',
                isAvailable: false,
                webGLVersion: 1,
                maxTextureSize: 0
            };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
            name: debugInfo ? 
                gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 
                'Unknown GPU',
            memorySize: this.estimateGPUMemory(gl),
            computeCapability: this.getComputeCapability(gl),
            isAvailable: true,
            webGLVersion: this.webGLVersion,
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
        };
    }

    private async getWebGLContext(): Promise<WebGLRenderingContext | WebGL2RenderingContext | null> {
        try {
            const canvas = new OffscreenCanvas(1, 1);
            // Try WebGL2 first
            const gl2 = canvas.getContext('webgl2');
            if (gl2) {
                this.webGLVersion = 2;
                return gl2;
            }
            // Fall back to WebGL1
            this.webGLVersion = 1;
            return canvas.getContext('webgl') || null;
        } catch {
            return null;
        }
    }

    private estimateGPUMemory(gl: WebGLRenderingContext): number {
        // This is a rough estimate based on WebGL limits
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        return Math.min(maxTextureSize, maxRenderBufferSize) * 4; // 4 bytes per pixel
    }

    private getComputeCapability(gl: WebGLRenderingContext): string {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'unknown';

        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        
        // Rough estimate based on GPU name
        if (renderer.includes('rtx')) return 'high';
        if (renderer.includes('gtx')) return 'medium';
        return 'basic';
    }

    public async computeTrajectories(
        initialStates: Float32Array[],
        options: ComputeOptions = {}
    ): Promise<Float32Array[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const opts = { ...this.defaultOptions, ...options };
        const batchSize = this.optimizeBatchSize(opts.batchSize);
        const startTime = performance.now();

        try {
            // Pre-allocate batch tensors if using tensor pool
            const results: Float32Array[] = [];
            await tf.tidy(async () => {
                for (let i = 0; i < initialStates.length; i += batchSize) {
                    const batch = initialStates.slice(i, i + batchSize);
                    let batchTensor: tf.Tensor2D;
                    
                    // Validate shapes if enabled
                    if (opts.validateShapes) {
                        this.validateBatchShapes(batch);
                    }
                    
                    // Use tensor pooling if enabled
                    if (opts.useTensorPool) {
                        batchTensor = this.tensorPool.acquire([batch.length, batch[0].length]) as tf.Tensor2D;
                        batchTensor.assign(tf.concat(batch.map(state => tf.tensor2d(state, [1, state.length])), 0));
                    } else {
                        batchTensor = tf.concat(batch.map(state => tf.tensor2d(state, [1, state.length])), 0);
                    }

                    try {
                        // Use pipeline caching if enabled
                        const cacheKey = `${batchTensor.shape.join('x')}_${opts.precision}`;
                        let computed: tf.Tensor2D;
                        const computeStartTime = performance.now();
                        
                        if (opts.enablePipelineCache && this.pipelineCache.has(cacheKey)) {
                            computed = this.pipelineCache.get(cacheKey) as tf.Tensor2D;
                            this.performanceMonitor.recordPipelineStats(true, performance.now() - computeStartTime);
                        } else {
                            computed = await this.computeBatch(batchTensor, opts);
                            if (opts.enablePipelineCache) {
                                this.pipelineCache.set(cacheKey, computed.clone());
                            }
                            this.performanceMonitor.recordPipelineStats(false, performance.now() - computeStartTime);
                        }

                        const batchResults = await computed.array();
                        results.push(...batchResults.map(r => new Float32Array(r)));

                        // Release tensors back to pool
                        if (opts.useTensorPool) {
                            this.tensorPool.release(batchTensor);
                            this.tensorPool.release(computed);
                        }
                    } catch (error) {
                        // Clean up on error
                        if (opts.useTensorPool) {
                            this.tensorPool.release(batchTensor);
                        }
                        throw error;
                    }
                }
            });

            return results;
        } catch (error) {
            this.monitor.emit('computeError', {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
            throw error;
        } finally {
            const endTime = performance.now();
            this.monitor.emit('computeComplete', {
                duration: endTime - startTime,
                batchSize,
                options: opts
            });
        }
    }

    private validateBatchShapes(batch: Float32Array[]): void {
        if (batch.length === 0) {
            throw new Error('Empty batch provided');
        }

        const expectedLength = batch[0].length;
        const invalidStates = batch.filter(state => state.length !== expectedLength);
        
        if (invalidStates.length > 0) {
            throw new Error(`Inconsistent state dimensions. Expected length ${expectedLength}, found states with lengths: ${invalidStates.map(s => s.length).join(', ')}`);
        }
    }

    private async computeBatch(
        batch: tf.Tensor2D,
        options: Required<ComputeOptions>
    ): Promise<tf.Tensor2D> {
        // Physics computation pipeline
        const pipeline = tf.tidy(() => {
            // Extract components
            const [positions, velocities] = tf.split(batch, [3, 3], 1);

            // Apply physics calculations
            const gravity = tf.tensor2d([[0, -9.81, 0]]);
            const dt = 1/60; // 60 fps simulation

            // Update velocities
            const newVelocities = velocities.add(gravity.mul(dt));

            // Update positions
            const newPositions = positions.add(
                velocities.mul(dt).add(gravity.mul(0.5 * dt * dt))
            );

            // Combine results
            return tf.concat([newPositions, newVelocities], 1);
        });

        return pipeline;
    }

    private optimizeBatchSize(requested: number): number {
        if (!this.gpuInfo?.isAvailable) return 1;

        // Adjust based on GPU memory
        const memoryGB = this.gpuInfo.memorySize / (1024 * 1024 * 1024);
        const maxBatchSize = Math.floor(memoryGB * 1000); // Rough estimate

        // Use hardware monitor to check system state
        const stats = this.hardwareMonitor.getResourceSnapshot();
        const memoryPressure = stats.memory.used / stats.memory.total;

        // Adjust batch size based on memory pressure
        let adjustedSize = requested;
        if (memoryPressure > 0.8) {
            adjustedSize = Math.floor(requested * 0.5);
        } else if (memoryPressure > 0.6) {
            adjustedSize = Math.floor(requested * 0.75);
        }

        return Math.min(adjustedSize, maxBatchSize);
    }

    public async warmup(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Run a small computation to warm up the GPU
        const dummyData = new Float32Array([0, 0, 0, 1, 1, 1]);
        await this.computeTrajectories([dummyData], {
            precision: 'low',
            batchSize: 1,
            useAsync: false
        });
    }

    public getGPUStatus(): {
        isAvailable: boolean;
        info: GPUInfo | null;
        memoryUsage?: number;
        tensorPoolSize?: number;
        pipelineCacheSize?: number;
    } {
        return {
            isAvailable: this.isInitialized && this.gpuInfo?.isAvailable,
            info: this.gpuInfo,
            memoryUsage: tf.memory().numBytes,
            tensorPoolSize: TensorPool.pools?.size,
            pipelineCacheSize: this.pipelineCache.size
        };
    }

    public async cleanup(): Promise<void> {
        // Cleanup TensorFlow.js resources
        tf.dispose();
        this.isInitialized = false;
    }
}
