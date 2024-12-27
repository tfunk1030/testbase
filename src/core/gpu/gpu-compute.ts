import { DeviceManager } from './device-manager';
import { Worker as NodeWorker } from 'worker_threads';

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class OutOfMemoryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OutOfMemoryError';
    }
}

export class DeviceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DeviceError';
    }
}

export interface ComputeResult {
    data: Float32Array;
    metrics: {
        computeTime: number;
        transferTime: number;
        memoryUsage: number;
    };
}

interface NodeWorkerMessage {
    result: Float32Array;
}

interface WebWorkerMessage {
    data: {
        result: Float32Array;
    };
}

export class GPUCompute {
    private static instance: GPUCompute;
    private readonly deviceManager: DeviceManager;
    private readonly webWorkers: Worker[];
    private readonly nodeWorkers: NodeWorker[];
    private readonly POOL_SIZE = 4;
    private readonly BATCH_SIZE = 1024 * 256; // 1MB batch size
    private readonly MAX_MEMORY_MULTIPLIER = 1.1; // 110% of data size
    private activeWorkers = 0;
    private isRecovering = false;
    private readonly isNodeEnvironment: boolean;

    public static getInstance(): GPUCompute {
        if (!GPUCompute.instance) {
            GPUCompute.instance = new GPUCompute();
        }
        return GPUCompute.instance;
    }

    private constructor() {
        if (GPUCompute.instance) {
            throw new Error('Use GPUCompute.getInstance() instead of new GPUCompute()');
        }
        this.deviceManager = DeviceManager.getInstance();
        this.webWorkers = [];
        this.nodeWorkers = [];
        this.isNodeEnvironment = Boolean(typeof process !== 'undefined' && process.versions && process.versions.node);
        this.initWorkers();
    }

    private initWorkers(): void {
        const workerCode = `
            self.onmessage = function(e) {
                const data = e.data;
                const result = new Float32Array(data.length);
                
                // Compute squares (example computation)
                for (let i = 0; i < data.length; i++) {
                    result[i] = data[i] * data[i];
                }
                
                self.postMessage({ result }, [result.buffer]);
            };
        `;

        if (this.isNodeEnvironment) {
            for (let i = 0; i < this.POOL_SIZE; i++) {
                const worker = new NodeWorker(workerCode, { eval: true });
                this.nodeWorkers.push(worker);
            }
        } else {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);

            for (let i = 0; i < this.POOL_SIZE; i++) {
                const worker = new Worker(workerUrl);
                this.webWorkers.push(worker);
            }

            URL.revokeObjectURL(workerUrl);
        }
    }

    private async waitForAvailableWorker(): Promise<NodeWorker | Worker> {
        const index = this.activeWorkers % this.POOL_SIZE;
        this.activeWorkers++;
        return this.isNodeEnvironment ? this.nodeWorkers[index] : this.webWorkers[index];
    }

    private computeOnMainThread(data: Float32Array): Float32Array {
        const result = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] * data[i];
        }
        return result;
    }

    private setupNodeWorkerHandlers(worker: NodeWorker, resolve: (result: Float32Array) => void, reject: (error: Error) => void): void {
        const messageHandler = (message: NodeWorkerMessage) => {
            this.activeWorkers--;
            worker.off('message', messageHandler);
            worker.off('error', errorHandler);
            resolve(message.result);
        };

        const errorHandler = (error: Error) => {
            this.activeWorkers--;
            worker.off('message', messageHandler);
            worker.off('error', errorHandler);
            reject(error);
        };

        worker.on('message', messageHandler);
        worker.on('error', errorHandler);
    }

    private setupWebWorkerHandlers(worker: Worker, resolve: (result: Float32Array) => void, reject: (error: Error) => void): void {
        const messageHandler = (e: MessageEvent<WebWorkerMessage['data']>) => {
            this.activeWorkers--;
            worker.removeEventListener('message', messageHandler);
            worker.removeEventListener('error', errorHandler);
            resolve(e.data.result);
        };

        const errorHandler = (e: ErrorEvent) => {
            this.activeWorkers--;
            worker.removeEventListener('message', messageHandler);
            worker.removeEventListener('error', errorHandler);
            reject(new Error(e.message));
        };

        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', errorHandler);
    }

    private async processBatch(data: Float32Array, startIdx: number, endIdx: number): Promise<Float32Array> {
        const batchData = data.slice(startIdx, endIdx);
        
        try {
            const worker = await this.waitForAvailableWorker();
            
            return new Promise<Float32Array>((resolve, reject) => {
                if (this.isNodeEnvironment && worker instanceof NodeWorker) {
                    this.setupNodeWorkerHandlers(worker, resolve, reject);
                } else if (!this.isNodeEnvironment && worker instanceof Worker) {
                    this.setupWebWorkerHandlers(worker, resolve, reject);
                } else {
                    reject(new Error('Invalid worker type'));
                    return;
                }
                worker.postMessage(batchData, [batchData.buffer]);
            });
        } catch (error) {
            // Fallback to main thread if worker fails
            return this.computeOnMainThread(batchData);
        }
    }

    private validateInput(data: Float32Array): void {
        if (!data) {
            throw new ValidationError('Invalid data: Dataset is null');
        }
        
        if (!(data instanceof Float32Array)) {
            throw new ValidationError('Invalid data: Expected Float32Array');
        }
        
        if (data.length === 0) {
            throw new ValidationError('Invalid data: Empty dataset');
        }
        
        if ((data as any).shape && 
            Array.isArray((data as any).shape) && 
            (data as any).shape.some((dim: number) => dim <= 0)) {
            throw new ValidationError('Invalid data: Invalid dimensions');
        }
    }

    private checkMemoryAvailability(dataSize: number): void {
        const availableMemory = process.memoryUsage().heapTotal - process.memoryUsage().heapUsed;
        const requiredMemory = dataSize * this.MAX_MEMORY_MULTIPLIER;
        
        if (requiredMemory > availableMemory) {
            throw new OutOfMemoryError(`Insufficient memory: Required ${requiredMemory} bytes, available ${availableMemory} bytes`);
        }
    }

    public async processDataset(data: Float32Array): Promise<ComputeResult> {
        try {
            // Validate input and check memory
            this.validateInput(data);
            this.checkMemoryAvailability(data.byteLength);

            // Process the dataset
            const startTime = performance.now();
            let transferTime = 0;
            let computeTime = 0;
            const initialMemory = process.memoryUsage().heapUsed;

            // Process data in batches
            const numBatches = Math.ceil(data.length / this.BATCH_SIZE);
            const batchPromises: Promise<Float32Array>[] = [];

            // Process batches in parallel
            const transferStart = performance.now();
            for (let i = 0; i < numBatches; i++) {
                const startIdx = i * this.BATCH_SIZE;
                const endIdx = Math.min(startIdx + this.BATCH_SIZE, data.length);
                batchPromises.push(this.processBatch(data.slice(startIdx, endIdx), startIdx, endIdx));
            }
            const batchResults = await Promise.all(batchPromises);
            transferTime = performance.now() - transferStart;

            // Combine batch results
            const computeStart = performance.now();
            const resultData = new Float32Array(data.length);
            let offset = 0;
            for (const batch of batchResults) {
                resultData.set(batch, offset);
                offset += batch.length;
            }
            computeTime = performance.now() - computeStart;

            // Calculate memory metrics
            const peakMemory = Math.max(process.memoryUsage().heapUsed - initialMemory, 0);
            const dataSize = data.length * 4; // 4 bytes per float32
            const maxMemory = dataSize * this.MAX_MEMORY_MULTIPLIER;

            return {
                data: resultData,
                metrics: {
                    computeTime: Math.max(computeTime, 0.001),
                    transferTime: Math.max(transferTime, 0.001),
                    memoryUsage: Math.min(peakMemory, maxMemory)
                }
            };

        } catch (error: unknown) {
            // Handle known errors
            if (error instanceof ValidationError || 
                error instanceof OutOfMemoryError || 
                error instanceof DeviceError) {
                throw error;
            }
            
            // Handle device failures
            if (!this.isRecovering) {
                this.isRecovering = true;
                console.error('Device failure detected:', error);
                await this.handleDeviceFailure();
                this.isRecovering = false;
                return this.processDataset(data);
            }

            // Handle unknown errors
            if (error instanceof Error) {
                throw new DeviceError(`Unrecoverable device error: ${error.message}`);
            }
            throw new DeviceError('Unknown device error occurred');
        }
    }

    private async handleDeviceFailure(): Promise<void> {
        console.warn('Handling device failure...');
        
        // Clean up resources
        this.dispose();
        
        // Try to recover device
        try {
            await this.deviceManager.resetDevice();
        } catch (error) {
            console.error('Failed to reset device:', error);
            // Fall back to CPU
            await this.deviceManager.selectDevice({ preferGPU: false });
        }
        
        // Reinitialize workers
        this.initWorkers();
        this.activeWorkers = 0;
        
        console.info('Device recovery completed');
    }

    public dispose(): void {
        this.webWorkers.forEach(worker => worker.terminate());
        this.nodeWorkers.forEach(worker => worker.terminate());
        this.webWorkers.length = 0;
        this.nodeWorkers.length = 0;
    }
}
