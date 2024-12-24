import { RealTimeMonitor } from './real-time-monitor';
import { CacheAnalytics } from './cache-analytics';
import { TelemetrySystem } from './telemetry-system';
import { MetricsCollector } from './metrics-collector';
import * as fs from 'fs';
import * as path from 'path';

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        borderColor: string;
        fill: boolean;
    }[];
}

interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    scales: {
        x: {
            type: string;
            time: {
                unit: string;
            };
            title: {
                display: boolean;
                text: string;
            };
        };
        y: {
            beginAtZero: boolean;
            title: {
                display: boolean;
                text: string;
            };
        };
    };
    plugins: {
        title: {
            display: boolean;
            text: string;
        };
        legend: {
            position: string;
        };
    };
}

export class PerformanceVisualizer {
    private static instance: PerformanceVisualizer;
    private readonly monitor: RealTimeMonitor;
    private readonly analytics: CacheAnalytics;
    private readonly telemetry: TelemetrySystem;
    private readonly metricsCollector: MetricsCollector;
    private readonly chartColors = {
        cpu: 'rgb(255, 99, 132)',
        memory: 'rgb(54, 162, 235)',
        cache: 'rgb(75, 192, 192)',
        response: 'rgb(153, 102, 255)',
        throughput: 'rgb(255, 159, 64)',
        errors: 'rgb(255, 99, 132)'
    };

    private constructor() {
        this.monitor = RealTimeMonitor.getInstance();
        this.analytics = CacheAnalytics.getInstance();
        this.telemetry = TelemetrySystem.getInstance();
        this.metricsCollector = MetricsCollector.getInstance();
    }

    public static getInstance(): PerformanceVisualizer {
        if (!PerformanceVisualizer.instance) {
            PerformanceVisualizer.instance = new PerformanceVisualizer();
        }
        return PerformanceVisualizer.instance;
    }

    public async generatePerformanceReport(reportDir: string): Promise<void> {
        const telemetryData = this.telemetry.getTelemetryData();
        const resourceMetrics = this.metricsCollector.collectResourceMetrics();
        const patterns = this.metricsCollector.analyzePerformancePatterns();
        const insights = this.metricsCollector.generateOptimizationInsights();

        const reportData = {
            timestamp: Date.now(),
            system: {
                cpu: resourceMetrics.cpu,
                memory: resourceMetrics.memory,
                io: resourceMetrics.io,
                network: resourceMetrics.network
            },
            patterns: patterns.patterns,
            bottlenecks: patterns.anomalies,
            trends: patterns.trends,
            insights: insights,
            timelines: telemetryData.performanceTimelines
        };

        const html = this.generateHtmlReport(reportData);
        const reportPath = path.join(reportDir, `performance_report_${Date.now()}.html`);
        await fs.promises.writeFile(reportPath, html);
    }

    private generateHtmlReport(data: any): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Performance Report</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .section { margin-bottom: 30px; }
                    .chart-container { width: 100%; max-width: 800px; margin: 20px 0; }
                    .metric { margin: 10px 0; }
                    .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
                    .alert.high { background-color: #ffebee; }
                    .alert.medium { background-color: #fff3e0; }
                    .alert.low { background-color: #e8f5e9; }
                </style>
            </head>
            <body>
                <h1>Performance Report</h1>
                <div class="section">
                    <h2>System Metrics</h2>
                    ${this.generateMetricsHtml(data.system)}
                </div>
                <div class="section">
                    <h2>Performance Charts</h2>
                    ${this.generateCharts(data)}
                </div>
                <div class="section">
                    <h2>Bottlenecks and Alerts</h2>
                    ${this.generateAlertsHtml(data)}
                </div>
                <div class="section">
                    <h2>Optimization Insights</h2>
                    <ul>
                        ${data.insights.map((insight: any) => `
                            <li>
                                <strong>${insight.target}:</strong> ${insight.description}
                                <br>Priority: ${insight.priority}
                                <br>Impact: ${insight.potentialImpact.improvement}% improvement (${insight.potentialImpact.confidence * 100}% confidence)
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <script>
                    ${this.generateChartScripts(data)}
                </script>
            </body>
            </html>
        `;
    }

    private generateMetricsHtml(data: any): string {
        return `
            <div class="metrics">
                <div class="metric">
                    <strong>CPU Usage:</strong> ${data.cpu.usage.toFixed(2)}%
                    <br>Load Average: ${data.cpu.loadAverage.map((v: number) => v.toFixed(2)).join(', ')}
                </div>
                <div class="metric">
                    <strong>Memory:</strong>
                    <br>Used: ${this.formatBytes(data.memory.used)}
                    <br>Free: ${this.formatBytes(data.memory.free)}
                    <br>Heap: ${this.formatBytes(data.memory.heapUsage)}
                </div>
                <div class="metric">
                    <strong>I/O Operations:</strong>
                    <br>Reads: ${data.io.reads}
                    <br>Writes: ${data.io.writes}
                    <br>Throughput: ${data.io.throughput.toFixed(2)} ops/sec
                </div>
            </div>
        `;
    }

    private generateAlertsHtml(data: any): string {
        return data.bottlenecks.map((alert: any) => `
            <div class="alert ${alert.severity}">
                <strong>${alert.type}:</strong> ${alert.description}
                <br>Impact: ${alert.impact}
                <br>Time: ${new Date(alert.timestamp).toLocaleString()}
            </div>
        `).join('');
    }

    private generateCharts(data: any): string {
        const charts = [
            this.createSystemMetricsChart(data),
            this.createApplicationMetricsChart(data),
            this.createCacheMetricsChart(data)
        ];

        return charts.map(chart => `
            <div class="chart-container">
                <canvas id="${chart.id}"></canvas>
            </div>
        `).join('');
    }

    private generateChartScripts(data: any): string {
        const charts = [
            this.createSystemMetricsChart(data),
            this.createApplicationMetricsChart(data),
            this.createCacheMetricsChart(data)
        ];

        return charts.map(chart => `
            new Chart(document.getElementById('${chart.id}'), {
                type: 'line',
                data: ${JSON.stringify(chart.data)},
                options: ${JSON.stringify(chart.options)}
            });
        `).join('\n');
    }

    private createSystemMetricsChart(data: any): { id: string; data: ChartData; options: ChartOptions } {
        const cpuData = data.timelines.find((t: any) => t.metric === 'cpu_usage');
        const memoryData = data.timelines.find((t: any) => t.metric === 'memory_used');

        return {
            id: 'systemMetricsChart',
            data: {
                labels: cpuData.dataPoints.map((p: any) => new Date(p.timestamp).toLocaleTimeString()),
                datasets: [
                    {
                        label: 'CPU Usage (%)',
                        data: cpuData.dataPoints.map((p: any) => p.value),
                        borderColor: this.chartColors.cpu,
                        fill: false
                    },
                    {
                        label: 'Memory Usage (MB)',
                        data: memoryData.dataPoints.map((p: any) => p.value / 1024 / 1024),
                        borderColor: this.chartColors.memory,
                        fill: false
                    }
                ]
            },
            options: this.getChartOptions('System Metrics', 'Time', 'Value')
        };
    }

    private createApplicationMetricsChart(data: any): { id: string; data: ChartData; options: ChartOptions } {
        const throughputData = data.timelines.find((t: any) => t.metric === 'disk_utilization');
        const responseData = data.timelines.find((t: any) => t.metric === 'gc_collections');

        return {
            id: 'applicationMetricsChart',
            data: {
                labels: throughputData.dataPoints.map((p: any) => new Date(p.timestamp).toLocaleTimeString()),
                datasets: [
                    {
                        label: 'Disk Utilization (%)',
                        data: throughputData.dataPoints.map((p: any) => p.value),
                        borderColor: this.chartColors.throughput,
                        fill: false
                    },
                    {
                        label: 'GC Collections',
                        data: responseData.dataPoints.map((p: any) => p.value),
                        borderColor: this.chartColors.response,
                        fill: false
                    }
                ]
            },
            options: this.getChartOptions('Application Metrics', 'Time', 'Value')
        };
    }

    private createCacheMetricsChart(data: any): { id: string; data: ChartData; options: ChartOptions } {
        const cacheData = this.analytics.getMetrics();
        const timestamps = Object.keys(cacheData.hitRateHistory);

        return {
            id: 'cacheMetricsChart',
            data: {
                labels: timestamps.map(t => new Date(parseInt(t)).toLocaleTimeString()),
                datasets: [
                    {
                        label: 'Cache Hit Rate (%)',
                        data: Object.values(cacheData.hitRateHistory),
                        borderColor: this.chartColors.cache,
                        fill: false
                    }
                ]
            },
            options: this.getChartOptions('Cache Performance', 'Time', 'Hit Rate (%)')
        };
    }

    private getChartOptions(title: string, xLabel: string, yLabel: string): ChartOptions {
        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    },
                    title: {
                        display: true,
                        text: xLabel
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: yLabel
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                legend: {
                    position: 'top'
                }
            }
        };
    }

    private formatBytes(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        return `${value.toFixed(1)} ${units[unitIndex]}`;
    }
}
