import { ResourceUsage } from '../telemetry-system';
import { PerformanceMetrics } from '../performance-monitor';
import { SystemMetrics } from '../real-time-monitor';

/**
 * Baseline metrics configuration
 */
export interface BaselineConfig {
    sampleSize: number;        // Number of samples to collect
    sampleInterval: number;    // Interval between samples (ms)
    warmupPeriod: number;     // Initial warmup period to ignore (ms)
    outlierThreshold: number; // Standard deviations for outlier detection
}

/**
 * Statistical summary of a metric
 */
export interface MetricSummary {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
}

/**
 * System baseline metrics
 */
export interface SystemBaseline {
    timestamp: number;
    cpu: {
        usage: MetricSummary;
        loadAverage: MetricSummary;
        perCore: MetricSummary[];
    };
    memory: {
        usage: MetricSummary;
        heap: MetricSummary;
        gc: {
            frequency: MetricSummary;
            pauseTime: MetricSummary;
        };
    };
    disk: {
        iops: MetricSummary;
        throughput: MetricSummary;
        latency: MetricSummary;
    };
    network: {
        throughput: MetricSummary;
        latency: MetricSummary;
        errorRate: MetricSummary;
    };
}

/**
 * Application baseline metrics
 */
export interface ApplicationBaseline {
    timestamp: number;
    operations: {
        throughput: MetricSummary;
        latency: MetricSummary;
        errorRate: MetricSummary;
    };
    cache: {
        hitRate: MetricSummary;
        missRate: MetricSummary;
        evictionRate: MetricSummary;
    };
    resources: {
        memoryUsage: MetricSummary;
        cpuUsage: MetricSummary;
        threadUsage: MetricSummary;
    };
}

/**
 * Baseline metrics manager
 */
export class BaselineMetrics {
    private static instance: BaselineMetrics;
    private systemBaseline: SystemBaseline | null = null;
    private applicationBaseline: ApplicationBaseline | null = null;
    private readonly config: BaselineConfig;

    private constructor(config: Partial<BaselineConfig> = {}) {
        this.config = {
            sampleSize: config.sampleSize || 1000,
            sampleInterval: config.sampleInterval || 1000,
            warmupPeriod: config.warmupPeriod || 30000,
            outlierThreshold: config.outlierThreshold || 2.5
        };
    }

    public static getInstance(config?: Partial<BaselineConfig>): BaselineMetrics {
        if (!BaselineMetrics.instance) {
            BaselineMetrics.instance = new BaselineMetrics(config);
        }
        return BaselineMetrics.instance;
    }

    /**
     * Calculate statistical summary for a series of values
     */
    private calculateMetricSummary(values: number[]): MetricSummary {
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        
        // Calculate standard deviation
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        // Calculate percentiles
        const p95Index = Math.floor(values.length * 0.95);
        const p99Index = Math.floor(values.length * 0.99);

        return {
            mean,
            median: sorted[Math.floor(sorted.length / 2)],
            stdDev,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[p95Index],
            p99: sorted[p99Index]
        };
    }

    /**
     * Remove outliers from a dataset
     */
    private removeOutliers(values: number[]): number[] {
        const summary = this.calculateMetricSummary(values);
        const threshold = summary.stdDev * this.config.outlierThreshold;
        return values.filter(value => 
            Math.abs(value - summary.mean) <= threshold
        );
    }

    /**
     * Establish system baseline metrics
     */
    public async establishSystemBaseline(
        metrics: ResourceUsage[],
        includeOutliers: boolean = false
    ): Promise<SystemBaseline> {
        // Extract metric series
        const cpuUsage = metrics.map(m => m.cpu.usage);
        const loadAvg = metrics.map(m => m.cpu.loadAverage[0]);
        const perCore = metrics[0].cpu.cores.map((_, i) => 
            metrics.map(m => m.cpu.cores[i].usage)
        );

        // Process metrics with optional outlier removal
        const processedCpuUsage = includeOutliers ? cpuUsage : this.removeOutliers(cpuUsage);
        const processedLoadAvg = includeOutliers ? loadAvg : this.removeOutliers(loadAvg);
        const processedPerCore = perCore.map(core => 
            includeOutliers ? core : this.removeOutliers(core)
        );

        this.systemBaseline = {
            timestamp: Date.now(),
            cpu: {
                usage: this.calculateMetricSummary(processedCpuUsage),
                loadAverage: this.calculateMetricSummary(processedLoadAvg),
                perCore: processedPerCore.map(core => this.calculateMetricSummary(core))
            },
            memory: {
                usage: this.calculateMetricSummary(
                    metrics.map(m => (m.memory.used / m.memory.total) * 100)
                ),
                heap: this.calculateMetricSummary(
                    metrics.map(m => (m.memory.heapUsed / m.memory.heapTotal) * 100)
                ),
                gc: {
                    frequency: this.calculateMetricSummary(
                        metrics.map(m => m.memory.gc.length)
                    ),
                    pauseTime: this.calculateMetricSummary(
                        metrics.flatMap(m => m.memory.gc.map(gc => gc.pauseTime))
                    )
                }
            },
            disk: {
                iops: this.calculateMetricSummary(
                    metrics.map(m => m.disk.reads + m.disk.writes)
                ),
                throughput: this.calculateMetricSummary(
                    metrics.map(m => m.disk.readBytes + m.disk.writeBytes)
                ),
                latency: this.calculateMetricSummary(
                    metrics.map(m => m.disk.utilization)
                )
            },
            network: {
                throughput: this.calculateMetricSummary(
                    metrics.map(m => m.network.rx + m.network.tx)
                ),
                latency: this.calculateMetricSummary(
                    metrics.map(m => m.network.connections)
                ),
                errorRate: this.calculateMetricSummary(
                    metrics.map(m => m.network.errors)
                )
            }
        };

        return this.systemBaseline;
    }

    /**
     * Establish application baseline metrics
     */
    public async establishApplicationBaseline(
        perfMetrics: PerformanceMetrics[],
        sysMetrics: SystemMetrics[],
        includeOutliers: boolean = false
    ): Promise<ApplicationBaseline> {
        // Process operation metrics
        const throughput = perfMetrics.map(m => m.trajectoryPoints / (m.executionTime / 1000));
        const latency = perfMetrics.map(m => m.executionTime);
        const errorRate = sysMetrics.map(m => m.cpu.bottlenecks?.throttlingEvents || 0);

        // Process cache metrics
        const hitRate = perfMetrics.map(m => m.cacheHits / (m.cacheHits + m.cacheMisses) * 100);
        const missRate = perfMetrics.map(m => m.cacheMisses / (m.cacheHits + m.cacheMisses) * 100);

        // Remove outliers if requested
        const processedMetrics = {
            throughput: includeOutliers ? throughput : this.removeOutliers(throughput),
            latency: includeOutliers ? latency : this.removeOutliers(latency),
            errorRate: includeOutliers ? errorRate : this.removeOutliers(errorRate),
            hitRate: includeOutliers ? hitRate : this.removeOutliers(hitRate),
            missRate: includeOutliers ? missRate : this.removeOutliers(missRate)
        };

        this.applicationBaseline = {
            timestamp: Date.now(),
            operations: {
                throughput: this.calculateMetricSummary(processedMetrics.throughput),
                latency: this.calculateMetricSummary(processedMetrics.latency),
                errorRate: this.calculateMetricSummary(processedMetrics.errorRate)
            },
            cache: {
                hitRate: this.calculateMetricSummary(processedMetrics.hitRate),
                missRate: this.calculateMetricSummary(processedMetrics.missRate),
                evictionRate: this.calculateMetricSummary(
                    perfMetrics.map(m => m.memoryUsage.collections)
                )
            },
            resources: {
                memoryUsage: this.calculateMetricSummary(
                    perfMetrics.map(m => m.memoryUsage.peak)
                ),
                cpuUsage: this.calculateMetricSummary(
                    perfMetrics.map(m => m.cpu.usage)
                ),
                threadUsage: this.calculateMetricSummary(
                    sysMetrics.map(m => m.threadPool?.activeThreads || 0)
                )
            }
        };

        return this.applicationBaseline;
    }

    /**
     * Get current system baseline
     */
    public getSystemBaseline(): SystemBaseline | null {
        return this.systemBaseline;
    }

    /**
     * Get current application baseline
     */
    public getApplicationBaseline(): ApplicationBaseline | null {
        return this.applicationBaseline;
    }

    /**
     * Check if a metric is within baseline
     */
    public isWithinBaseline(
        metric: number,
        baseline: MetricSummary,
        threshold: number = 2
    ): boolean {
        return Math.abs(metric - baseline.mean) <= baseline.stdDev * threshold;
    }

    /**
     * Calculate deviation from baseline
     */
    public calculateDeviation(
        metric: number,
        baseline: MetricSummary
    ): number {
        return (metric - baseline.mean) / baseline.stdDev;
    }
}
