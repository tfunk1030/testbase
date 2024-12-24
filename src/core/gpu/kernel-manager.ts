import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';

interface KernelConfig {
    name: string;
    inputShape: number[];
    outputShape: number[];
    precision?: tf.DataType;
    optimization?: 'speed' | 'memory' | 'balanced';
}

interface CompiledKernel {
    kernel: tf.CustomGradientFunc;
    config: KernelConfig;
    timestamp: number;
}

export class KernelManager {
    private static instance: KernelManager;
    private readonly gpuCompute: GPUCompute;
    private readonly kernels: Map<string, CompiledKernel> = new Map();
    private readonly maxKernels: number = 100;

    private constructor() {
        this.gpuCompute = GPUCompute.getInstance();
    }

    public static getInstance(): KernelManager {
        if (!KernelManager.instance) {
            KernelManager.instance = new KernelManager();
        }
        return KernelManager.instance;
    }

    public async registerKernel(
        config: KernelConfig,
        computeFunc: (x: tf.Tensor) => tf.Tensor | tf.Tensor[]
    ): Promise<void> {
        // Check if we need to clean up old kernels
        if (this.kernels.size >= this.maxKernels) {
            this.cleanupOldKernels();
        }

        // Create the custom gradient function
        const gradientFunc = tf.customGrad((x: tf.Tensor, save: boolean) => {
            // Forward pass
            const result = tf.tidy(() => computeFunc(x));

            // Return forward pass result and gradient function
            return {
                value: Array.isArray(result) ? result[0] : result,
                gradFunc: (dy: tf.Tensor) => {
                    return tf.tidy(() => {
                        // Simple gradient computation
                        // In a real implementation, this would be more sophisticated
                        return dy.mul(x);
                    });
                }
            };
        });

        // Store the compiled kernel
        this.kernels.set(config.name, {
            kernel: gradientFunc,
            config,
            timestamp: Date.now()
        });
    }

    public async executeKernel(
        name: string,
        inputs: tf.Tensor | tf.Tensor[]
    ): Promise<tf.Tensor | tf.Tensor[]> {
        const compiledKernel = this.kernels.get(name);
        if (!compiledKernel) {
            throw new Error(`Kernel ${name} not found`);
        }

        // Update timestamp
        compiledKernel.timestamp = Date.now();

        // Execute the kernel
        return tf.tidy(() => {
            const inputTensor = Array.isArray(inputs) ? inputs[0] : inputs;
            return compiledKernel.kernel(inputTensor, true);
        });
    }

    private cleanupOldKernels(): void {
        // Sort kernels by timestamp
        const sortedKernels = Array.from(this.kernels.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove oldest kernels until we're under the limit
        while (sortedKernels.length > this.maxKernels * 0.8) {
            const [name] = sortedKernels.shift()!;
            this.kernels.delete(name);
        }
    }

    public hasKernel(name: string): boolean {
        return this.kernels.has(name);
    }

    public getKernelInfo(name: string): KernelConfig | null {
        const kernel = this.kernels.get(name);
        return kernel ? kernel.config : null;
    }

    public listKernels(): string[] {
        return Array.from(this.kernels.keys());
    }

    // Predefined kernels for common operations
    public async registerCommonKernels(): Promise<void> {
        // Vector operations
        await this.registerKernel(
            {
                name: 'vectorAdd',
                inputShape: [2, 3],
                outputShape: [1, 3]
            },
            (x: tf.Tensor) => {
                const [a, b] = tf.split(x, 2);
                return a.add(b);
            }
        );

        await this.registerKernel(
            {
                name: 'vectorDot',
                inputShape: [2, 3],
                outputShape: [1]
            },
            (x: tf.Tensor) => {
                const [a, b] = tf.split(x, 2);
                return a.mul(b).sum();
            }
        );

        // Matrix operations
        await this.registerKernel(
            {
                name: 'matrixMultiply',
                inputShape: [2, 3, 3],
                outputShape: [1, 3, 3]
            },
            (x: tf.Tensor) => {
                const [a, b] = tf.split(x, 2);
                return tf.matMul(a, b);
            }
        );

        // Physics computations
        await this.registerKernel(
            {
                name: 'trajectoryStep',
                inputShape: [1, 6], // [position, velocity]
                outputShape: [1, 6]
            },
            (x: tf.Tensor) => {
                const dt = 1/60; // 60 fps
                const gravity = tf.tensor2d([[0, -9.81, 0]]);
                
                const [pos, vel] = tf.split(x, [3, 3], 1);
                
                const newVel = vel.add(gravity.mul(dt));
                const newPos = pos.add(
                    vel.mul(dt).add(gravity.mul(0.5 * dt * dt))
                );
                
                return tf.concat([newPos, newVel], 1);
            }
        );
    }

    public async cleanup(): Promise<void> {
        // Dispose all kernels
        for (const [name] of this.kernels) {
            this.kernels.delete(name);
        }
    }
}
