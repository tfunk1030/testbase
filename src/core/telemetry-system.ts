import { PerformanceMonitor } from './performance-monitor';
import { RealTimeMonitor } from './real-time-monitor';
import { EventEmitter } from 'events';
import * as os from 'os';

// Resource usage interface
export interface ResourceUsage {
    cpu: {
        usage: number;
        temperature?: number;
        loadAverage: number[];
        threadUtilization: number;
    };
    memory: {
        used: number;
        free: number;
        total: number;
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
}

interface Timeline {
    metric: string;
    dataPoints: {
        timestamp: number;
        value: number;
        metadata?: Record<string, any>;
    }[];
    statistics: {
        min: number;
        max: number;
        mean: number;
        stdDev: number;
        trend: number;
    };
}

interface Bottleneck {
    id: string;
    type: 'cpu' | 'memory' | 'disk' | 'network' | 'thread' | 'cache';
    severity: 'low' | 'medium' | 'high';
    metric: string;
    value: number;
    threshold: number;
    timestamp: number;
    duration: number;
    impact: {
        performance: number;
        reliability: number;
        resource: string;
    };
    context: Record<string, any>;
}

interface TelemetryData {
    resourceMetrics: ResourceUsage[];
    performanceTimelines: Timeline[];
    bottleneckIndicators: Bottleneck[];
}

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'critical';
    components: {
        name: string;
        status: 'healthy' | 'degraded' | 'critical';
        metrics: Record<string, number>;
        lastCheck: number;
    }[];
    bottlenecks: Bottleneck[];
    recommendations: string[];
}

export class TelemetrySystem extends EventEmitter {
    private static instance: TelemetrySystem;
    private readonly monitor: PerformanceMonitor;
    private readonly realTimeMonitor: RealTimeMonitor;
    private readonly timelines: Map<string, Timeline> = new Map();
    private readonly bottlenecks: Bottleneck[] = [];
    private readonly resourceHistory: ResourceUsage[] = [];
    private collectionInterval: NodeJS.Timer | null = null;
    private readonly maxHistorySize = 3600; // 1 hour at 1 sample/second
    private readonly cpuThresholds = {
        warning: 70,
        critical: 85
    };
    private readonly memoryThresholds = {
        warning: 80,
        critical: 90
    };

    private constructor() {
        super();
        this.monitor = PerformanceMonitor.getInstance();
        this.realTimeMonitor = RealTimeMonitor.getInstance();
        this.initializeTimelines();
        this.startCollection();
        this.setupEventListeners();
    }

    public static getInstance(): TelemetrySystem {
        if (!TelemetrySystem.instance) {
            TelemetrySystem.instance = new TelemetrySystem();
        }
        return TelemetrySystem.instance;
    }

    private initializeTimelines() {
        // CPU timelines
        this.createTimeline('cpu_usage');
        this.createTimeline('cpu_temperature');
        this.createTimeline('load_average');

        // Memory timelines
        this.createTimeline('memory_used');
        this.createTimeline('heap_used');
        this.createTimeline('gc_collections');

        // Disk timelines
        this.createTimeline('disk_reads');
        this.createTimeline('disk_writes');
        this.createTimeline('disk_utilization');

        // Network timelines
        this.createTimeline('network_rx');
        this.createTimeline('network_tx');
        this.createTimeline('network_connections');
    }

    private createTimeline(metric: string): void {
        this.timelines.set(metric, {
            metric,
            dataPoints: [],
            statistics: {
                min: Infinity,
                max: -Infinity,
                mean: 0,
                stdDev: 0,
                trend: 0
            }
        });
    }

    private startCollection(): void {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }

        this.collectionInterval = setInterval(() => {
            this.collectMetrics();
        }, 1000); // Collect every second
    }

    private setupEventListeners(): void {
        this.realTimeMonitor.on('bottleneck', (bottleneck) => {
            this.handleBottleneck(bottleneck);
        });

        this.monitor.on('resource_alert', (alert) => {
            this.handleResourceAlert(alert);
        });
    }

    private async collectMetrics(): Promise<void> {
        const timestamp = Date.now();
        const usage = await this.collectResourceUsage();
        
        this.resourceHistory.push(usage);
        if (this.resourceHistory.length > this.maxHistorySize) {
            this.resourceHistory.shift();
        }

        this.updateTimelines(usage);
        this.detectBottlenecks(usage);
        this.checkSystemHealth(usage);

        this.emit('metrics_collected', usage);
    }

    private async collectResourceUsage(): Promise<ResourceUsage> {
        const cpuUsage = process.cpuUsage();
        const memUsage = process.memoryUsage();
        const loadAvg = os.loadavg();

        // Collect per-core CPU metrics
        const cores = os.cpus().map((cpu, id) => ({
            id,
            usage: this.calculateCoreUsage(cpu),
            temperature: undefined // Would require platform-specific implementation
        }));

        return {
            timestamp: Date.now(),
            cpu: {
                usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                loadAverage: loadAvg,
                cores
            },
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                gc: await this.getGCMetrics()
            },
            disk: await this.getDiskMetrics(),
            network: await this.getNetworkMetrics()
        };
    }

    private calculateCoreUsage(cpu: os.CpuInfo): number {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
        const idle = cpu.times.idle;
        return ((total - idle) / total) * 100;
    }

    private async getGCMetrics() {
        // This would require integration with node --trace-gc
        // For now, return placeholder data
        return [{
            collections: 0,
            pauseTime: 0,
            type: 'unknown'
        }];
    }

    private async getDiskMetrics() {
        // This would require platform-specific implementation
        // For now, return placeholder data
        return {
            reads: 0,
            writes: 0,
            readBytes: 0,
            writeBytes: 0,
            utilization: 0
        };
    }

    private async getNetworkMetrics() {
        // This would require platform-specific implementation
        // For now, return placeholder data
        return {
            rx: 0,
            tx: 0,
            connections: 0,
            errors: 0
        };
    }

    private updateTimelines(usage: ResourceUsage): void {
        const timestamp = usage.timestamp;

        // Update CPU timelines
        this.updateTimelinePoint('cpu_usage', timestamp, usage.cpu.usage);
        if (usage.cpu.temperature !== undefined) {
            this.updateTimelinePoint('cpu_temperature', timestamp, usage.cpu.temperature);
        }
        this.updateTimelinePoint('load_average', timestamp, usage.cpu.loadAverage[0]);

        // Update Memory timelines
        this.updateTimelinePoint('memory_used', timestamp, usage.memory.used);
        this.updateTimelinePoint('heap_used', timestamp, usage.memory.heapUsed);
        this.updateTimelinePoint('gc_collections', timestamp, 
            usage.memory.gc.reduce((acc, gc) => acc + gc.collections, 0));

        // Update statistics for each timeline
        for (const timeline of this.timelines.values()) {
            this.updateStatistics(timeline);
        }
    }

    private updateTimelinePoint(metric: string, timestamp: number, value: number, metadata?: Record<string, any>): void {
        const timeline = this.timelines.get(metric);
        if (!timeline) return;

        timeline.dataPoints.push({ timestamp, value, metadata });
        if (timeline.dataPoints.length > this.maxHistorySize) {
            timeline.dataPoints.shift();
        }
    }

    private updateStatistics(timeline: Timeline): void {
        const values = timeline.dataPoints.map(p => p.value);
        if (values.length === 0) return;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(
            values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
        );

        // Calculate trend using simple linear regression
        const xValues = timeline.dataPoints.map(p => p.timestamp);
        const yValues = values;
        const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
        const yMean = mean;
        const numerator = xValues.reduce((acc, x, i) => 
            acc + (x - xMean) * (yValues[i] - yMean), 0);
        const denominator = xValues.reduce((acc, x) => 
            acc + Math.pow(x - xMean, 2), 0);
        const trend = numerator / denominator;

        timeline.statistics = { min, max, mean, stdDev, trend };
    }

    private detectBottlenecks(usage: ResourceUsage): void {
        const timestamp = usage.timestamp;

        // Check CPU bottlenecks
        if (usage.cpu.usage > this.cpuThresholds.critical) {
            this.addBottleneck({
                id: `cpu_${timestamp}`,
                type: 'cpu',
                severity: 'high',
                metric: 'usage',
                value: usage.cpu.usage,
                threshold: this.cpuThresholds.critical,
                timestamp,
                duration: 0,
                impact: {
                    performance: 0.8,
                    reliability: 0.6,
                    resource: 'cpu'
                },
                context: {
                    loadAverage: usage.cpu.loadAverage,
                    cores: usage.cpu.cores
                }
            });
        }

        // Check Memory bottlenecks
        const memoryUsagePercent = (usage.memory.used / usage.memory.total) * 100;
        if (memoryUsagePercent > this.memoryThresholds.critical) {
            this.addBottleneck({
                id: `memory_${timestamp}`,
                type: 'memory',
                severity: 'high',
                metric: 'usage',
                value: memoryUsagePercent,
                threshold: this.memoryThresholds.critical,
                timestamp,
                duration: 0,
                impact: {
                    performance: 0.7,
                    reliability: 0.8,
                    resource: 'memory'
                },
                context: {
                    free: usage.memory.free,
                    heapUsed: usage.memory.heapUsed,
                    gc: usage.memory.gc
                }
            });
        }
    }

    private addBottleneck(bottleneck: Bottleneck): void {
        this.bottlenecks.push(bottleneck);
        this.emit('bottleneck_detected', bottleneck);

        // Keep only recent bottlenecks
        const fiveMinutesAgo = Date.now() - 300000;
        this.bottlenecks.filter(b => b.timestamp >= fiveMinutesAgo);
    }

    private checkSystemHealth(usage: ResourceUsage): void {
        const components = [
            this.checkComponentHealth('CPU', usage.cpu),
            this.checkComponentHealth('Memory', usage.memory),
            this.checkComponentHealth('Disk', usage.disk),
            this.checkComponentHealth('Network', usage.network)
        ];

        const status = components.some(c => c.status === 'critical') ? 'critical' :
                      components.some(c => c.status === 'degraded') ? 'degraded' : 'healthy';

        const healthStatus: HealthStatus = {
            status,
            components,
            bottlenecks: [...this.bottlenecks],
            recommendations: this.generateRecommendations(components)
        };

        this.emit('health_status', healthStatus);
    }

    private checkComponentHealth(
        name: string, 
        metrics: Record<string, any>
    ): HealthStatus['components'][0] {
        let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
        const componentMetrics: Record<string, number> = {};

        switch (name) {
            case 'CPU':
                componentMetrics.usage = metrics.usage;
                if (metrics.usage > this.cpuThresholds.critical) {
                    status = 'critical';
                } else if (metrics.usage > this.cpuThresholds.warning) {
                    status = 'degraded';
                }
                break;

            case 'Memory':
                const usagePercent = (metrics.used / metrics.total) * 100;
                componentMetrics.usagePercent = usagePercent;
                if (usagePercent > this.memoryThresholds.critical) {
                    status = 'critical';
                } else if (usagePercent > this.memoryThresholds.warning) {
                    status = 'degraded';
                }
                break;

            // Add other component checks as needed
        }

        return {
            name,
            status,
            metrics: componentMetrics,
            lastCheck: Date.now()
        };
    }

    private generateRecommendations(
        components: HealthStatus['components']
    ): string[] {
        const recommendations: string[] = [];

        for (const component of components) {
            if (component.status === 'critical') {
                switch (component.name) {
                    case 'CPU':
                        recommendations.push(
                            'Consider scaling CPU resources or optimizing CPU-intensive operations'
                        );
                        break;
                    case 'Memory':
                        recommendations.push(
                            'Review memory usage patterns and consider implementing memory optimization strategies'
                        );
                        break;
                    // Add other component recommendations
                }
            }
        }

        return recommendations;
    }

    public getTelemetryData(): TelemetryData {
        return {
            resourceMetrics: [...this.resourceHistory],
            performanceTimelines: Array.from(this.timelines.values()),
            bottleneckIndicators: [...this.bottlenecks]
        };
    }

    public getTimeline(metric: string): Timeline | null {
        return this.timelines.get(metric) || null;
    }

    public getBottlenecks(): Bottleneck[] {
        return [...this.bottlenecks];
    }

    public stop(): void {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
    }
}
