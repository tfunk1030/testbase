import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';
import { KernelManager } from './kernel-manager';

interface MatrixConfig {
    blockSize?: number;
    precision?: tf.DataType;
    useStrassen?: boolean;
    strassenThreshold?: number;
}

export class MatrixCompute {
    private static instance: MatrixCompute;
    private readonly gpuCompute: GPUCompute;
    private readonly kernelManager: KernelManager;
    private readonly defaultConfig: Required<MatrixConfig> = {
        blockSize: 32,
        precision: 'float32',
        useStrassen: true,
        strassenThreshold: 512
    };

    private constructor() {
        this.gpuCompute = GPUCompute.getInstance();
        this.kernelManager = KernelManager.getInstance();
        this.registerMatrixKernels();
    }

    public static getInstance(): MatrixCompute {
        if (!MatrixCompute.instance) {
            MatrixCompute.instance = new MatrixCompute();
        }
        return MatrixCompute.instance;
    }

    private async registerMatrixKernels(): Promise<void> {
        // Block matrix multiplication kernel
        await this.kernelManager.registerKernel(
            {
                name: 'blockMatMul',
                inputShape: [2, -1, -1],
                outputShape: [-1, -1]
            },
            (x: tf.Tensor) => {
                const [a, b] = tf.split(x, 2);
                return this.blockMatrixMultiply(a, b);
            }
        );

        // Matrix transpose kernel
        await this.kernelManager.registerKernel(
            {
                name: 'matrixTranspose',
                inputShape: [-1, -1],
                outputShape: [-1, -1]
            },
            (x: tf.Tensor) => x.transpose()
        );
    }

    public async multiply(
        a: tf.Tensor2D,
        b: tf.Tensor2D,
        config: MatrixConfig = {}
    ): Promise<tf.Tensor2D> {
        const opts = { ...this.defaultConfig, ...config };

        if (opts.useStrassen && 
            a.shape[0] >= opts.strassenThreshold && 
            a.shape[1] >= opts.strassenThreshold) {
            return this.strassenMultiply(a, b);
        }

        return this.blockMatrixMultiply(a, b, opts.blockSize);
    }

    private async blockMatrixMultiply(
        a: tf.Tensor2D,
        b: tf.Tensor2D,
        blockSize: number = this.defaultConfig.blockSize
    ): Promise<tf.Tensor2D> {
        return tf.tidy(() => {
            const [m, k] = a.shape;
            const [_, n] = b.shape;

            // Pad matrices to be divisible by block size
            const paddedM = Math.ceil(m / blockSize) * blockSize;
            const paddedK = Math.ceil(k / blockSize) * blockSize;
            const paddedN = Math.ceil(n / blockSize) * blockSize;

            const paddedA = this.padMatrix(a, [paddedM, paddedK]);
            const paddedB = this.padMatrix(b, [paddedK, paddedN]);

            // Split into blocks
            const aBlocks = this.splitIntoBlocks(paddedA, blockSize);
            const bBlocks = this.splitIntoBlocks(paddedB, blockSize);

            // Multiply blocks
            const resultBlocks = tf.buffer([
                paddedM / blockSize,
                paddedN / blockSize,
                blockSize,
                blockSize
            ]);

            for (let i = 0; i < paddedM / blockSize; i++) {
                for (let j = 0; j < paddedN / blockSize; j++) {
                    let sum = tf.zeros([blockSize, blockSize]);
                    for (let k = 0; k < paddedK / blockSize; k++) {
                        const prod = tf.matMul(
                            aBlocks.slice([i, k, 0, 0], [1, 1, blockSize, blockSize]).reshape([blockSize, blockSize]),
                            bBlocks.slice([k, j, 0, 0], [1, 1, blockSize, blockSize]).reshape([blockSize, blockSize])
                        );
                        sum = sum.add(prod);
                    }
                    resultBlocks.set(sum.dataSync(), i, j);
                }
            }

            // Combine blocks
            const result = this.combineBlocks(resultBlocks.toTensor());

            // Remove padding
            return result.slice([0, 0], [m, n]);
        });
    }

    private async strassenMultiply(
        a: tf.Tensor2D,
        b: tf.Tensor2D
    ): Promise<tf.Tensor2D> {
        return tf.tidy(() => {
            const [m, k] = a.shape;
            const [_, n] = b.shape;

            // Pad to power of 2
            const maxDim = Math.max(m, k, n);
            const paddedSize = Math.pow(2, Math.ceil(Math.log2(maxDim)));

            const paddedA = this.padMatrix(a, [paddedSize, paddedSize]);
            const paddedB = this.padMatrix(b, [paddedSize, paddedSize]);

            // Recursive Strassen multiplication
            const result = this.strassenRecursive(paddedA, paddedB);

            // Remove padding
            return result.slice([0, 0], [m, n]);
        });
    }

    private strassenRecursive(
        a: tf.Tensor2D,
        b: tf.Tensor2D
    ): tf.Tensor2D {
        return tf.tidy(() => {
            const [n] = a.shape;
            if (n <= this.defaultConfig.strassenThreshold) {
                return tf.matMul(a, b);
            }

            const half = n / 2;

            // Split matrices
            const [a11, a12, a21, a22] = this.splitMatrix(a);
            const [b11, b12, b21, b22] = this.splitMatrix(b);

            // Compute the 7 products
            const m1 = this.strassenRecursive(
                a11.add(a22),
                b11.add(b22)
            );
            const m2 = this.strassenRecursive(
                a21.add(a22),
                b11
            );
            const m3 = this.strassenRecursive(
                a11,
                b12.sub(b22)
            );
            const m4 = this.strassenRecursive(
                a22,
                b21.sub(b11)
            );
            const m5 = this.strassenRecursive(
                a11.add(a12),
                b22
            );
            const m6 = this.strassenRecursive(
                a21.sub(a11),
                b11.add(b12)
            );
            const m7 = this.strassenRecursive(
                a12.sub(a22),
                b21.add(b22)
            );

            // Combine results
            const c11 = m1.add(m4).sub(m5).add(m7);
            const c12 = m3.add(m5);
            const c21 = m2.add(m4);
            const c22 = m1.sub(m2).add(m3).add(m6);

            // Combine blocks
            return tf.concat2d([
                tf.concat2d([c11, c12], 1),
                tf.concat2d([c21, c22], 1)
            ], 0);
        });
    }

    private splitMatrix(
        matrix: tf.Tensor2D
    ): [tf.Tensor2D, tf.Tensor2D, tf.Tensor2D, tf.Tensor2D] {
        const [n] = matrix.shape;
        const half = n / 2;

        return [
            matrix.slice([0, 0], [half, half]),
            matrix.slice([0, half], [half, half]),
            matrix.slice([half, 0], [half, half]),
            matrix.slice([half, half], [half, half])
        ];
    }

    private padMatrix(
        matrix: tf.Tensor2D,
        targetShape: [number, number]
    ): tf.Tensor2D {
        const [rows, cols] = matrix.shape;
        const [targetRows, targetCols] = targetShape;

        if (rows === targetRows && cols === targetCols) {
            return matrix;
        }

        return tf.pad(matrix, [
            [0, targetRows - rows],
            [0, targetCols - cols]
        ]);
    }

    private splitIntoBlocks(
        matrix: tf.Tensor2D,
        blockSize: number
    ): tf.Tensor4D {
        const [rows, cols] = matrix.shape;
        const blockRows = rows / blockSize;
        const blockCols = cols / blockSize;

        return tf.reshape(matrix, [
            blockRows,
            blockSize,
            blockCols,
            blockSize
        ]).transpose([0, 2, 1, 3]);
    }

    private combineBlocks(
        blocks: tf.Tensor4D
    ): tf.Tensor2D {
        return blocks.transpose([0, 2, 1, 3])
            .reshape([
                blocks.shape[0] * blocks.shape[2],
                blocks.shape[1] * blocks.shape[3]
            ]);
    }

    public async cleanup(): Promise<void> {
        tf.dispose();
    }
}
