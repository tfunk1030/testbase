import { BaselineMetrics, MetricSummary } from '../../core/telemetry/baseline-metrics';
import { ResourceUsage } from '../../core/telemetry-system';
import { PerformanceMetrics } from '../../core/performance-monitor';
import { SystemMetrics } from '../../core/real-time-monitor';

describe('BaselineMetrics', () => {
    let baselineMetrics: BaselineMetrics;

    beforeEach(() => {
        baselineMetrics = BaselineMetrics.getInstance({
            sampleSize: 100,
            sampleInterval: 100,
            warmupPeriod: 1000,
            outlierThreshold: 2
        });
    });

    describe('Statistical Calculations', () => {
        const testMetricSummary = (summary: MetricSummary) => {
            expect(summary.mean).toBeDefined();
            expect(summary.median).toBeDefined();
            expect(summary.stdDev).toBeDefined();
            expect(summary.min).toBeDefined();
            expect(summary.max).toBeDefined();
            expect(summary.p95).toBeDefined();
            expect(summary.p99).toBeDefined();
        };

        it('should calculate system baseline metrics correctly', async () => {
            const mockResourceUsage: ResourceUsage[] = Array(100).fill(null).map(() => ({
                timestamp: Date.now(),
                cpu: {
                    usage: Math.random() * 100,
                    loadAverage: [Math.random() * 4, Math.random() * 4, Math.random() * 4],
                    cores: Array(4).fill(null).map(() => ({
                        id: Math.floor(Math.random() * 4),
                        usage: Math.random() * 100
                    }))
                },
                memory: {
                    total: 16000000000,
                    used: Math.random() * 16000000000,
                    free: Math.random() * 16000000000,
                    heapTotal: 1000000000,
                    heapUsed: Math.random() * 1000000000,
                    external: Math.random() * 100000000,
                    gc: Array(3).fill(null).map(() => ({
                        collections: Math.floor(Math.random() * 100),
                        pauseTime: Math.random() * 100,
                        type: 'major'
                    }))
                },
                disk: {
                    reads: Math.floor(Math.random() * 1000),
                    writes: Math.floor(Math.random() * 1000),
                    readBytes: Math.floor(Math.random() * 10000000),
                    writeBytes: Math.floor(Math.random() * 10000000),
                    utilization: Math.random() * 100
                },
                network: {
                    rx: Math.floor(Math.random() * 1000000),
                    tx: Math.floor(Math.random() * 1000000),
                    connections: Math.floor(Math.random() * 100),
                    errors: Math.floor(Math.random() * 10)
                }
            }));

            const systemBaseline = await baselineMetrics.establishSystemBaseline(mockResourceUsage);
            
            expect(systemBaseline).toBeDefined();
            testMetricSummary(systemBaseline.cpu.usage);
            testMetricSummary(systemBaseline.cpu.loadAverage);
            systemBaseline.cpu.perCore.forEach(core => testMetricSummary(core));
            testMetricSummary(systemBaseline.memory.usage);
            testMetricSummary(systemBaseline.memory.heap);
            testMetricSummary(systemBaseline.memory.gc.frequency);
            testMetricSummary(systemBaseline.memory.gc.pauseTime);
            testMetricSummary(systemBaseline.disk.iops);
            testMetricSummary(systemBaseline.disk.throughput);
            testMetricSummary(systemBaseline.disk.latency);
            testMetricSummary(systemBaseline.network.throughput);
            testMetricSummary(systemBaseline.network.latency);
            testMetricSummary(systemBaseline.network.errorRate);
        });

        it('should calculate application baseline metrics correctly', async () => {
            const mockPerfMetrics: PerformanceMetrics[] = Array(100).fill(null).map(() => ({
                executionTime: Math.random() * 1000,
                memoryUsage: {
                    initial: Math.random() * 1000000,
                    final: Math.random() * 1000000,
                    peak: Math.random() * 1000000,
                    allocations: Array(10).fill(null).map(() => Math.random() * 100000),
                    collections: Math.floor(Math.random() * 10)
                },
                cpu: {
                    usage: Math.random() * 100,
                    kernelTime: Math.random() * 100,
                    userTime: Math.random() * 100
                },
                io: {
                    reads: Math.floor(Math.random() * 1000),
                    writes: Math.floor(Math.random() * 1000),
                    bytesRead: Math.floor(Math.random() * 10000000),
                    bytesWritten: Math.floor(Math.random() * 10000000)
                },
                trajectoryPoints: Math.floor(Math.random() * 1000),
                batchSize: Math.floor(Math.random() * 100),
                averageStepSize: Math.random() * 0.1,
                cacheHits: Math.floor(Math.random() * 1000),
                cacheMisses: Math.floor(Math.random() * 100)
            }));

            const mockSysMetrics: SystemMetrics[] = Array(100).fill(null).map(() => ({
                cpu: {
                    usage: Math.random() * 100,
                    loadAverage: [Math.random() * 4, Math.random() * 4, Math.random() * 4],
                    bottlenecks: {
                        highUsageThreads: Array(2).fill(null).map(() => Math.floor(Math.random() * 4)),
                        saturatedCores: Math.floor(Math.random() * 2),
                        throttlingEvents: Math.floor(Math.random() * 5)
                    }
                },
                memory: {
                    total: 16000000000,
                    used: Math.random() * 16000000000,
                    free: Math.random() * 16000000000,
                    processUsage: Math.random() * 1000000000,
                    bottlenecks: {
                        fragmentationLevel: Math.random() * 100,
                        swapUsage: Math.random() * 1000000000,
                        largeAllocs: Array(3).fill(null).map(() => Math.floor(Math.random() * 1000000))
                    }
                },
                gc: {
                    collections: Math.floor(Math.random() * 100),
                    totalPauseTime: Math.random() * 1000,
                    averagePauseTime: Math.random() * 10
                },
                threadPool: {
                    activeThreads: Math.floor(Math.random() * 20),
                    queueLength: Math.floor(Math.random() * 50),
                    completedTasks: Math.floor(Math.random() * 1000)
                }
            }));

            const appBaseline = await baselineMetrics.establishApplicationBaseline(
                mockPerfMetrics,
                mockSysMetrics
            );

            expect(appBaseline).toBeDefined();
            testMetricSummary(appBaseline.operations.throughput);
            testMetricSummary(appBaseline.operations.latency);
            testMetricSummary(appBaseline.operations.errorRate);
            testMetricSummary(appBaseline.cache.hitRate);
            testMetricSummary(appBaseline.cache.missRate);
            testMetricSummary(appBaseline.cache.evictionRate);
            testMetricSummary(appBaseline.resources.memoryUsage);
            testMetricSummary(appBaseline.resources.cpuUsage);
            testMetricSummary(appBaseline.resources.threadUsage);
        });
    });

    describe('Outlier Detection', () => {
        it('should detect and handle outliers correctly', async () => {
            const normalData = Array(90).fill(null).map(() => Math.random() * 100);
            const outliers = Array(10).fill(null).map(() => Math.random() * 1000 + 500);
            const mockData = [...normalData, ...outliers];

            const mockResourceUsage: ResourceUsage[] = mockData.map(value => ({
                timestamp: Date.now(),
                cpu: {
                    usage: value,
                    loadAverage: [1, 1, 1],
                    cores: [{id: 0, usage: value}]
                },
                memory: {
                    total: 1000,
                    used: value,
                    free: 1000 - value,
                    heapTotal: 1000,
                    heapUsed: value,
                    external: 0,
                    gc: [{collections: 1, pauseTime: 1, type: 'major'}]
                },
                disk: {
                    reads: 0,
                    writes: 0,
                    readBytes: 0,
                    writeBytes: 0,
                    utilization: 0
                },
                network: {
                    rx: 0,
                    tx: 0,
                    connections: 0,
                    errors: 0
                }
            }));

            const baselineWithOutliers = await baselineMetrics.establishSystemBaseline(mockResourceUsage, true);
            const baselineWithoutOutliers = await baselineMetrics.establishSystemBaseline(mockResourceUsage, false);

            expect(baselineWithOutliers.cpu.usage.max).toBeGreaterThan(baselineWithoutOutliers.cpu.usage.max);
            expect(baselineWithOutliers.cpu.usage.stdDev).toBeGreaterThan(baselineWithoutOutliers.cpu.usage.stdDev);
        });
    });

    describe('Baseline Validation', () => {
        it('should correctly identify metrics within baseline', async () => {
            const mockSummary: MetricSummary = {
                mean: 100,
                median: 100,
                stdDev: 10,
                min: 70,
                max: 130,
                p95: 120,
                p99: 125
            };

            expect(baselineMetrics.isWithinBaseline(105, mockSummary)).toBe(true);
            expect(baselineMetrics.isWithinBaseline(150, mockSummary)).toBe(false);
        });

        it('should calculate deviation correctly', async () => {
            const mockSummary: MetricSummary = {
                mean: 100,
                median: 100,
                stdDev: 10,
                min: 70,
                max: 130,
                p95: 120,
                p99: 125
            };

            expect(baselineMetrics.calculateDeviation(110, mockSummary)).toBe(1);
            expect(baselineMetrics.calculateDeviation(90, mockSummary)).toBe(-1);
        });
    });
});
