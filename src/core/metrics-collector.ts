import { PerformanceMonitor } from './performance-monitor';
import { RealTimeMonitor } from './real-time-monitor';
import { PerformanceProfiler } from './performance-profiler';
import { CacheAnalytics } from './cache-analytics';
import { CacheManager } from './cache-manager';
import { EventEmitter } from 'events';
import { TelemetrySystem } from './telemetry-system';

interface ResourceMetrics {
    cpu: {
        usage: number;
        temperature?: number;
        loadAverage: number[];
        threadUtilization: number;
    };
    memory: {
        total: number;
        used: number;
        free: number;
        heapUsage: number;
        gcMetrics: {
            collections: number;
            pauseTime: number;
        };
    };
    io: {
        reads: number;
        writes: number;
        throughput: number;
    };
    network: {
        bytesIn: number;
        bytesOut: number;
        activeConnections: number;
    };
}

interface PerformanceAnalysis {
    patterns: {
        type: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        metrics: any;
    }[];
    anomalies: {
        type: string;
        description: string;
        impact: string;
        timestamp: number;
    }[];
    trends: {
        metric: string;
        direction: 'increasing' | 'decreasing' | 'stable';
        rate: number;
        prediction: number;
    }[];
}

interface OptimizationInsight {
    target: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    potentialImpact: {
        metric: string;
        improvement: number;
        confidence: number;
    };
    implementation: {
        difficulty: 'easy' | 'medium' | 'hard';
        steps: string[];
        risks: string[];
    };
}

export class MetricsCollector extends EventEmitter {
    private static instance: MetricsCollector;
    private readonly monitor: PerformanceMonitor;
    private readonly realTimeMonitor: RealTimeMonitor;
    private readonly profiler: PerformanceProfiler;
    private readonly cacheAnalytics: CacheAnalytics;
    private readonly cache: CacheManager;
    private readonly telemetry: TelemetrySystem;
    private collectionInterval: NodeJS.Timer | null = null;
    private readonly metricsHistory: Map<string, { timestamp: number; value: any }[]> = new Map();
    private readonly anomalyThresholds = new Map<string, { min: number; max: number }>();

    private constructor() {
        super();
        this.monitor = PerformanceMonitor.getInstance();
        this.realTimeMonitor = RealTimeMonitor.getInstance();
        this.profiler = new PerformanceProfiler();
        this.cacheAnalytics = CacheAnalytics.getInstance();
        this.cache = CacheManager.getInstance();
        this.telemetry = TelemetrySystem.getInstance();
        this.initializeThresholds();
        this.startCollection();
    }

    public static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    private initializeThresholds() {
        this.anomalyThresholds.set('cpu_usage', { min: 0, max: 90 });
        this.anomalyThresholds.set('memory_usage', { min: 0, max: 85 });
        this.anomalyThresholds.set('gc_pause', { min: 0, max: 100 });
        this.anomalyThresholds.set('cache_hit_rate', { min: 0.7, max: 1 });
    }

    private startCollection() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }

        this.collectionInterval = setInterval(() => {
            const metrics = this.collectResourceMetrics();
            this.updateHistory('resource_metrics', metrics);
            this.emit('metrics_collected', metrics);

            const analysis = this.analyzePerformancePatterns();
            this.emit('analysis_complete', analysis);

            const insights = this.generateOptimizationInsights();
            this.emit('insights_generated', insights);
        }, 5000); // Collect every 5 seconds
    }

    private updateHistory(key: string, value: any) {
        if (!this.metricsHistory.has(key)) {
            this.metricsHistory.set(key, []);
        }

        const history = this.metricsHistory.get(key)!;
        history.push({
            timestamp: Date.now(),
            value
        });

        // Keep last hour of data
        const oneHourAgo = Date.now() - 3600000;
        while (history.length > 0 && history[0].timestamp < oneHourAgo) {
            history.shift();
        }
    }

    public collectResourceMetrics(): ResourceMetrics {
        const telemetryData = this.telemetry.getTelemetryData();
        const latestMetrics = telemetryData.resourceMetrics[telemetryData.resourceMetrics.length - 1];
        const snapshot = this.realTimeMonitor.getLatestSnapshot();
        
        return {
            cpu: {
                usage: latestMetrics.cpu.usage,
                temperature: latestMetrics.cpu.temperature,
                loadAverage: latestMetrics.cpu.loadAverage,
                threadUtilization: snapshot.system.threadPool.activeThreads / os.cpus().length
            },
            memory: {
                total: latestMetrics.memory.total,
                used: latestMetrics.memory.used,
                free: latestMetrics.memory.free,
                heapUsage: latestMetrics.memory.heapUsed,
                gcMetrics: {
                    collections: latestMetrics.memory.gc[0].collections,
                    pauseTime: latestMetrics.memory.gc[0].pauseTime
                }
            },
            io: {
                reads: latestMetrics.disk.reads,
                writes: latestMetrics.disk.writes,
                throughput: this.calculateIOThroughput([latestMetrics])
            },
            network: {
                bytesIn: latestMetrics.network.rx,
                bytesOut: latestMetrics.network.tx,
                activeConnections: latestMetrics.network.connections
            }
        };
    }

    private calculateIOThroughput(resourceUsage: any[]): number {
        if (resourceUsage.length < 2) return 0;
        const latest = resourceUsage[resourceUsage.length - 1];
        const previous = resourceUsage[resourceUsage.length - 2];
        const timeDiff = latest.timestamp - previous.timestamp;
        const readDiff = latest.disk.reads - previous.disk.reads;
        const writeDiff = latest.disk.writes - previous.disk.writes;
        return (readDiff + writeDiff) / (timeDiff / 1000); // operations per second
    }

    public analyzePerformancePatterns(): PerformanceAnalysis {
        const telemetryData = this.telemetry.getTelemetryData();
        const bottlenecks = telemetryData.bottleneckIndicators;
        const timelines = telemetryData.performanceTimelines;

        return {
            patterns: bottlenecks.map(b => ({
                type: b.type,
                description: this.describePattern(b),
                severity: b.severity,
                metrics: b.impact
            })),
            anomalies: bottlenecks.map(b => ({
                type: b.type,
                description: `${b.metric} exceeded threshold of ${b.threshold}`,
                impact: b.severity,
                timestamp: b.timestamp
            })),
            trends: timelines.map(t => ({
                metric: t.metric,
                direction: this.getTrendDirection(t.statistics.trend),
                rate: t.statistics.trend,
                prediction: this.calculatePrediction(t)
            }))
        };
    }

    private describePattern(pattern: any): string {
        switch (pattern.pattern) {
            case 'high_variance':
                return `High variability detected in ${pattern.type} metrics`;
            case 'increasing_trend':
                return `${pattern.type} usage is trending upward`;
            case 'decreasing_trend':
                return `${pattern.type} usage is trending downward`;
            case 'low_hit_rate':
                return 'Cache hit rate is below optimal threshold';
            default:
                return `Unknown pattern detected in ${pattern.type} metrics`;
        }
    }

    private getTrendDirection(trend: number): 'increasing' | 'decreasing' | 'stable' {
        if (trend > 0.001) return 'increasing';
        if (trend < -0.001) return 'decreasing';
        return 'stable';
    }

    private calculatePrediction(timeline: any): number {
        const lastValue = timeline.dataPoints[timeline.dataPoints.length - 1].value;
        return lastValue + (timeline.statistics.trend * 3600000); // Predict 1 hour ahead
    }

    public generateOptimizationInsights(): OptimizationInsight[] {
        const insights: OptimizationInsight[] = [];
        const analysis = this.analyzePerformancePatterns();
        const cacheStats = this.cache.getStats();

        // Memory optimization insights
        const memoryPattern = analysis.patterns.find(p => p.type === 'memory');
        if (memoryPattern && memoryPattern.severity === 'high') {
            insights.push({
                target: 'memory',
                description: 'High memory usage detected',
                priority: 'high',
                potentialImpact: {
                    metric: 'memory_usage',
                    improvement: 20,
                    confidence: 0.8
                },
                implementation: {
                    difficulty: 'medium',
                    steps: [
                        'Review memory allocation patterns',
                        'Implement memory pooling',
                        'Optimize object lifecycle'
                    ],
                    risks: ['Temporary performance impact during implementation']
                }
            });
        }

        // Cache optimization insights
        if (cacheStats.hitRate < 0.8) {
            insights.push({
                target: 'cache',
                description: 'Suboptimal cache hit rate',
                priority: 'medium',
                potentialImpact: {
                    metric: 'cache_hit_rate',
                    improvement: 15,
                    confidence: 0.85
                },
                implementation: {
                    difficulty: 'easy',
                    steps: [
                        'Adjust cache size',
                        'Review eviction policy',
                        'Implement predictive preloading'
                    ],
                    risks: ['Increased memory usage']
                }
            });
        }

        // Thread pool optimization insights
        const threadPattern = analysis.patterns.find(p => p.type === 'threadPool');
        if (threadPattern && threadPattern.severity !== 'low') {
            insights.push({
                target: 'thread_pool',
                description: 'Thread pool saturation detected',
                priority: 'high',
                potentialImpact: {
                    metric: 'response_time',
                    improvement: 30,
                    confidence: 0.75
                },
                implementation: {
                    difficulty: 'hard',
                    steps: [
                        'Scale thread pool size',
                        'Optimize task distribution',
                        'Implement backpressure mechanisms'
                    ],
                    risks: [
                        'Increased resource consumption',
                        'Potential deadlock scenarios'
                    ]
                }
            });
        }

        return insights;
    }

    public stop() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
    }
}
