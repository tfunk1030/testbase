import * as tf from '@tensorflow/tfjs-node-gpu';
import { GPUCompute } from './gpu-compute';
import { MatrixCompute } from './matrix-compute';
import { TrajectoryCompute } from './trajectory-compute';
import { DeviceManager } from './device-manager';
import { HardwareMonitor } from '../hardware/hardware-monitor';

interface BenchmarkConfig {
    iterations?: number;
    warmupRuns?: number;
    timeout?: number;
    collectMemory?: boolean;
    collectPower?: boolean;
}

interface BenchmarkResult {
    name: string;
    executionTime: number;
    throughput: number;
    memoryUsage?: {
        peak: number;
        average: number;
    };
    powerUsage?: {
        peak: number;
        average: number;
    };
    device: string;
    timestamp: number;
}

export class PerformanceBenchmark {
    private static instance: PerformanceBenchmark;
    private readonly gpuCompute: GPUCompute;
    private readonly matrixCompute: MatrixCompute;
    private readonly trajectoryCompute: TrajectoryCompute;
    private readonly deviceManager: DeviceManager;
    private readonly hardwareMonitor: HardwareMonitor;
    private readonly results: Map<string, BenchmarkResult[]> = new Map();

    private constructor() {
        this.gpuCompute = GPUCompute.getInstance();
        this.matrixCompute = MatrixCompute.getInstance();
        this.trajectoryCompute = TrajectoryCompute.getInstance();
        this.deviceManager = DeviceManager.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
    }

    public static getInstance(): PerformanceBenchmark {
        if (!PerformanceBenchmark.instance) {
            PerformanceBenchmark.instance = new PerformanceBenchmark();
        }
        return PerformanceBenchmark.instance;
    }

    public async runBenchmark(
        name: string,
        testFn: () => Promise<void>,
        config: BenchmarkConfig = {}
    ): Promise<BenchmarkResult> {
        const opts = {
            iterations: config.iterations || 100,
            warmupRuns: config.warmupRuns || 5,
            timeout: config.timeout || 30000,
            collectMemory: config.collectMemory || true,
            collectPower: config.collectPower || false
        };

        // Warmup
        console.log(`Warming up benchmark: ${name}`);
        for (let i = 0; i < opts.warmupRuns; i++) {
            await testFn();
        }

        // Collect metrics
        const metrics = {
            times: [] as number[],
            memory: [] as number[],
            power: [] as number[]
        };

        const device = this.deviceManager.getActiveDevice();
        if (!device) throw new Error('No active device');

        console.log(`Running benchmark: ${name}`);
        const startTime = performance.now();

        for (let i = 0; i < opts.iterations; i++) {
            const iterStart = performance.now();

            // Run test
            await testFn();

            // Collect metrics
            const iterTime = performance.now() - iterStart;
            metrics.times.push(iterTime);

            if (opts.collectMemory) {
                const memoryInfo = await this.getMemoryUsage();
                metrics.memory.push(memoryInfo);
            }

            if (opts.collectPower) {
                const powerInfo = await this.getPowerUsage();
                if (powerInfo) metrics.power.push(powerInfo);
            }

            // Check timeout
            if (performance.now() - startTime > opts.timeout) {
                console.warn(`Benchmark ${name} timed out after ${i + 1} iterations`);
                break;
            }
        }

        // Calculate results
        const result: BenchmarkResult = {
            name,
            executionTime: this.calculateAverage(metrics.times),
            throughput: opts.iterations / (performance.now() - startTime) * 1000,
            device: device.name,
            timestamp: Date.now()
        };

        if (opts.collectMemory) {
            result.memoryUsage = {
                peak: Math.max(...metrics.memory),
                average: this.calculateAverage(metrics.memory)
            };
        }

        if (opts.collectPower && metrics.power.length > 0) {
            result.powerUsage = {
                peak: Math.max(...metrics.power),
                average: this.calculateAverage(metrics.power)
            };
        }

        // Store result
        this.storeResult(name, result);

        return result;
    }

    public async runStandardBenchmarks(): Promise<Map<string, BenchmarkResult>> {
        const results = new Map<string, BenchmarkResult>();

        // Matrix multiplication benchmark
        results.set('matMul', await this.runBenchmark(
            'Matrix Multiplication',
            async () => {
                const a = tf.randomNormal([1000, 1000]);
                const b = tf.randomNormal([1000, 1000]);
                await this.matrixCompute.multiply(a, b);
                tf.dispose([a, b]);
            }
        ));

        // Trajectory computation benchmark
        results.set('trajectory', await this.runBenchmark(
            'Trajectory Computation',
            async () => {
                const states = Array(1000).fill(null).map(() => ({
                    position: tf.randomNormal([1, 3]) as any,
                    velocity: tf.randomNormal([1, 3]) as any,
                    acceleration: tf.randomNormal([1, 3]) as any,
                    time: 0
                }));
                await this.trajectoryCompute.computeTrajectories(states);
                states.forEach(s => {
                    tf.dispose([s.position, s.velocity, s.acceleration]);
                });
            }
        ));

        // Memory transfer benchmark
        results.set('memoryTransfer', await this.runBenchmark(
            'Memory Transfer',
            async () => {
                const data = new Float32Array(1000000);
                const tensor = await this.gpuCompute.computeTrajectories([data]);
                await tensor[0].data();
            }
        ));

        return results;
    }

    public async compareDevices(): Promise<Map<string, BenchmarkResult[]>> {
        const results = new Map<string, BenchmarkResult[]>();
        const devices = this.deviceManager.listDevices();

        for (const device of devices) {
            if (device.status !== 'available') continue;

            // Switch to device
            await this.deviceManager.selectDevice({ preferGPU: device.type === 'gpu' });

            // Run benchmarks
            console.log(`Running benchmarks on ${device.name}`);
            const deviceResults = await this.runStandardBenchmarks();

            // Store results
            results.set(device.name, Array.from(deviceResults.values()));
        }

        return results;
    }

    private async getMemoryUsage(): Promise<number> {
        const device = this.deviceManager.getActiveDevice();
        if (!device) return 0;

        if (device.type === 'gpu') {
            const gpuInfo = await this.gpuCompute.getGPUStatus();
            return gpuInfo.memoryUsage || 0;
        } else {
            const stats = await this.hardwareMonitor.getResourceSnapshot();
            return stats.memory.used;
        }
    }

    private async getPowerUsage(): Promise<number | undefined> {
        // This would need platform-specific implementation
        return undefined;
    }

    private calculateAverage(numbers: number[]): number {
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    private storeResult(name: string, result: BenchmarkResult): void {
        if (!this.results.has(name)) {
            this.results.set(name, []);
        }
        this.results.get(name)!.push(result);
    }

    public getResults(name?: string): BenchmarkResult[] {
        if (name) {
            return this.results.get(name) || [];
        }
        return Array.from(this.results.values()).flat();
    }

    public generateReport(): string {
        let report = '# Performance Benchmark Report\n\n';
        
        // Add system info
        const device = this.deviceManager.getActiveDevice();
        report += '## System Information\n';
        report += `- Device: ${device?.name || 'Unknown'}\n`;
        report += `- Type: ${device?.type || 'Unknown'}\n`;
        report += `- Status: ${device?.status || 'Unknown'}\n\n`;

        // Add benchmark results
        report += '## Benchmark Results\n\n';
        for (const [name, results] of this.results) {
            report += `### ${name}\n`;
            for (const result of results) {
                report += `- Execution Time: ${result.executionTime.toFixed(2)}ms\n`;
                report += `- Throughput: ${result.throughput.toFixed(2)} ops/s\n`;
                if (result.memoryUsage) {
                    report += `- Peak Memory: ${(result.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB\n`;
                }
                if (result.powerUsage) {
                    report += `- Average Power: ${result.powerUsage.average.toFixed(2)}W\n`;
                }
                report += '\n';
            }
        }

        return report;
    }

    public async cleanup(): Promise<void> {
        this.results.clear();
        tf.dispose();
    }
}
