import { PerformanceMetrics } from './performance-monitor';

export class PerformanceLogger {
    private static instance: PerformanceLogger;
    private metrics: PerformanceMetrics[] = [];
    
    public static getInstance(): PerformanceLogger {
        if (!PerformanceLogger.instance) {
            PerformanceLogger.instance = new PerformanceLogger();
        }
        return PerformanceLogger.instance;
    }

    private constructor() {
        if (PerformanceLogger.instance) {
            throw new Error('Use PerformanceLogger.getInstance() instead');
        }
    }

    logMetrics(metrics: PerformanceMetrics): void {
        this.metrics.push(metrics);
        if (this.metrics.length > 1000) {
            this.metrics.shift();
        }
    }
    
    getAverages(): PerformanceMetrics {
        if (this.metrics.length === 0) {
            throw new Error('No metrics available for averaging');
        }

        return {
            memoryUsage: this.calculateMemoryAverages(),
            computeTime: this.calculateTimeAverage('computeTime'),
            transferTime: this.calculateTimeAverage('transferTime'),
            gpuUtilization: this.calculateUtilizationAverage()
        };
    }

    private calculateMemoryAverages(): PerformanceMetrics['memoryUsage'] {
        const total = this.metrics.reduce((acc, metric) => ({
            numTensors: acc.numTensors + metric.memoryUsage.numTensors,
            numBytes: acc.numBytes + metric.memoryUsage.numBytes,
            unreliable: acc.unreliable || metric.memoryUsage.unreliable
        }), { numTensors: 0, numBytes: 0, unreliable: false });

        return {
            numTensors: Math.round(total.numTensors / this.metrics.length),
            numBytes: Math.round(total.numBytes / this.metrics.length),
            unreliable: total.unreliable
        };
    }

    private calculateTimeAverage(metric: 'computeTime' | 'transferTime'): number {
        const sum = this.metrics.reduce((acc, m) => acc + m[metric], 0);
        return sum / this.metrics.length;
    }

    private calculateUtilizationAverage(): number {
        const sum = this.metrics.reduce((acc, m) => acc + m.gpuUtilization, 0);
        return sum / this.metrics.length;
    }

    clearMetrics(): void {
        this.metrics = [];
    }

    getMetricsCount(): number {
        return this.metrics.length;
    }

    getRecentMetrics(count: number): PerformanceMetrics[] {
        return this.metrics.slice(-count);
    }
}
