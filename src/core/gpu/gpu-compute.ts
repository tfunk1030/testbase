import * as tf from '@tensorflow/tfjs-node-gpu';
import { RealTimeMonitor } from '../real-time-monitor';
import { HardwareMonitor } from '../hardware/hardware-monitor';

interface GPUInfo {
    name: string;
    memorySize: number;
    computeCapability: string;
    isAvailable: boolean;
}

interface ComputeOptions {
    precision?: 'high' | 'medium' | 'low';
    batchSize?: number;
    useAsync?: boolean;
    timeout?: number;
}

export class GPUCompute {
    private static instance: GPUCompute;
    private readonly monitor: RealTimeMonitor;
    private readonly hardwareMonitor: HardwareMonitor;
    private gpuInfo: GPUInfo | null = null;
    private isInitialized: boolean = false;
    private defaultOptions: Required<ComputeOptions> = {
        precision: 'high',
        batchSize: 128,
        useAsync: true,
        timeout: 30000
    };

    private constructor() {
        this.monitor = RealTimeMonitor.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
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
                isAvailable: false
            };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
            name: debugInfo ? 
                gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 
                'Unknown GPU',
            memorySize: this.estimateGPUMemory(gl),
            computeCapability: this.getComputeCapability(gl),
            isAvailable: true
        };
    }

    private async getWebGLContext(): Promise<WebGLRenderingContext | null> {
        try {
            const canvas = new OffscreenCanvas(1, 1);
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

        // Convert input to tensors
        const stateTensors = initialStates.map(state => 
            tf.tensor2d(state, [1, state.length])
        );

        // Batch processing
        const results: Float32Array[] = [];
        for (let i = 0; i < stateTensors.length; i += batchSize) {
            const batch = stateTensors.slice(i, i + batchSize);
            const batchTensor = tf.concat(batch, 0);

            // Apply physics computations
            const computed = await this.computeBatch(batchTensor, opts);
            
            // Extract results
            const batchResults = await computed.array();
            results.push(...batchResults.map(r => new Float32Array(r)));

            // Cleanup
            tf.dispose([batchTensor, computed]);
            batch.forEach(t => tf.dispose(t));
        }

        // Cleanup input tensors
        stateTensors.forEach(t => tf.dispose(t));

        return results;
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
    } {
        return {
            isAvailable: this.isInitialized && this.gpuInfo?.isAvailable,
            info: this.gpuInfo,
            memoryUsage: undefined // WebGL doesn't provide memory usage info
        };
    }

    public async cleanup(): Promise<void> {
        // Cleanup TensorFlow.js resources
        tf.dispose();
        this.isInitialized = false;
    }
}
