import { RealTimeMonitor } from '../../core/real-time-monitor';
import { PerformanceVisualizer } from '../../core/performance-visualizer';
import { FlightModel } from '../../core/flight-model';
import { CacheManager } from '../../core/cache-manager';
import { Environment, BallProperties, LaunchConditions } from '../../core/types';
import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
    name: string;
    environment: Environment;
    properties: BallProperties;
    conditions: LaunchConditions;
    iterations: number;
    expectedMetrics?: {
        maxResponseTime: number;
        minThroughput: number;
        maxMemoryUsage: number;
        minCacheHitRate: number;
    };
}

export class PerformanceTestSuite {
    private readonly monitor: RealTimeMonitor;
    private readonly visualizer: PerformanceVisualizer;
    private readonly model: FlightModel;
    private readonly cache: CacheManager;
    private readonly testCases: TestCase[];
    private readonly resultsDir: string;

    constructor() {
        this.monitor = RealTimeMonitor.getInstance();
        this.visualizer = PerformanceVisualizer.getInstance();
        this.model = new FlightModel();
        this.cache = CacheManager.getInstance();
        this.resultsDir = path.join(__dirname, '../../../reports/performance-tests');
        this.testCases = this.loadTestCases();

        // Ensure results directory exists
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    private loadTestCases(): TestCase[] {
        return [
            {
                name: 'Single Shot Performance',
                environment: {
                    temperature: 20,
                    humidity: 0.5,
                    pressure: 101325,
                    windSpeed: 0,
                    windDirection: 0,
                    altitude: 0
                },
                properties: {
                    mass: 0.0459,
                    diameter: 0.0428,
                    dragCoefficient: 0.25,
                    liftCoefficient: 0.15,
                    spinDecayRate: 0.95
                },
                conditions: {
                    ballSpeed: 70,
                    launchAngle: 12,
                    launchDirection: 0,
                    spinRate: 2500,
                    spinAxis: { x: 0, y: 1, z: 0 }
                },
                iterations: 1,
                expectedMetrics: {
                    maxResponseTime: 100,
                    minThroughput: 10,
                    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
                    minCacheHitRate: 0
                }
            },
            {
                name: 'Batch Processing Performance',
                environment: {
                    temperature: 20,
                    humidity: 0.5,
                    pressure: 101325,
                    windSpeed: 5,
                    windDirection: 45,
                    altitude: 100
                },
                properties: {
                    mass: 0.0459,
                    diameter: 0.0428,
                    dragCoefficient: 0.25,
                    liftCoefficient: 0.15,
                    spinDecayRate: 0.95
                },
                conditions: {
                    ballSpeed: 70,
                    launchAngle: 12,
                    launchDirection: 0,
                    spinRate: 2500,
                    spinAxis: { x: 0, y: 1, z: 0 }
                },
                iterations: 100,
                expectedMetrics: {
                    maxResponseTime: 50,
                    minThroughput: 100,
                    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
                    minCacheHitRate: 0.7
                }
            },
            {
                name: 'Cache Performance',
                environment: {
                    temperature: 20,
                    humidity: 0.5,
                    pressure: 101325,
                    windSpeed: 0,
                    windDirection: 0,
                    altitude: 0
                },
                properties: {
                    mass: 0.0459,
                    diameter: 0.0428,
                    dragCoefficient: 0.25,
                    liftCoefficient: 0.15,
                    spinDecayRate: 0.95
                },
                conditions: {
                    ballSpeed: 70,
                    launchAngle: 12,
                    launchDirection: 0,
                    spinRate: 2500,
                    spinAxis: { x: 0, y: 1, z: 0 }
                },
                iterations: 1000,
                expectedMetrics: {
                    maxResponseTime: 20,
                    minThroughput: 200,
                    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
                    minCacheHitRate: 0.9
                }
            }
        ];
    }

    public async runTests(): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const results: any[] = [];

        console.log('Starting Performance Test Suite...\n');

        for (const testCase of this.testCases) {
            console.log(`Running test case: ${testCase.name}`);
            const result = await this.runTestCase(testCase);
            results.push(result);

            // Generate report for this test case
            await this.generateTestReport(testCase, result, timestamp);

            console.log(`Completed test case: ${testCase.name}\n`);
        }

        // Generate summary report
        await this.generateSummaryReport(results, timestamp);

        console.log('Performance Test Suite completed.');
    }

    private async runTestCase(testCase: TestCase): Promise<any> {
        const startTime = Date.now();
        const operationId = this.monitor.recordOperationStart();

        try {
            // Clear cache before test
            this.cache.clear();

            // Run the test iterations
            const trajectories = [];
            for (let i = 0; i < testCase.iterations; i++) {
                const trajectory = await this.model.calculateTrajectory(
                    testCase.conditions,
                    testCase.environment,
                    testCase.properties
                );
                trajectories.push(trajectory);
            }

            // Get performance metrics
            const endTime = Date.now();
            const duration = endTime - startTime;
            const metrics = this.monitor.getAggregateMetrics(60);
            const cacheStats = this.cache.getStats();

            this.monitor.recordOperationEnd(operationId, duration);

            return {
                testCase: testCase.name,
                duration,
                trajectoryCount: trajectories.length,
                metrics,
                cacheStats,
                success: this.validateMetrics(metrics, cacheStats, testCase.expectedMetrics),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.monitor.recordOperationEnd(operationId, Date.now() - startTime, error as Error);
            throw error;
        }
    }

    private validateMetrics(
        metrics: any,
        cacheStats: any,
        expected?: TestCase['expectedMetrics']
    ): boolean {
        if (!expected) return true;

        return (
            metrics.avgResponseTime <= expected.maxResponseTime &&
            metrics.throughput >= expected.minThroughput &&
            metrics.avgMemoryUsage <= expected.maxMemoryUsage &&
            cacheStats.hitRate >= expected.minCacheHitRate
        );
    }

    private async generateTestReport(
        testCase: TestCase,
        result: any,
        timestamp: string
    ): Promise<void> {
        const reportPath = path.join(
            this.resultsDir,
            `test-${testCase.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`
        );

        // Generate performance visualization
        await this.visualizer.generatePerformanceReport(this.resultsDir);

        // Save detailed test results
        fs.writeFileSync(
            `${reportPath}.json`,
            JSON.stringify({
                testCase,
                result,
                systemInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    cpus: require('os').cpus(),
                    totalMemory: require('os').totalmem(),
                    freeMemory: require('os').freemem()
                }
            }, null, 2)
        );
    }

    private async generateSummaryReport(results: any[], timestamp: string): Promise<void> {
        const summaryPath = path.join(this.resultsDir, `summary-${timestamp}.md`);
        const summary = this.generateMarkdownSummary(results);
        fs.writeFileSync(summaryPath, summary);
    }

    private generateMarkdownSummary(results: any[]): string {
        return `# Performance Test Suite Summary
Generated: ${new Date().toISOString()}

## System Information
- Platform: ${process.platform}
- Architecture: ${process.arch}
- CPUs: ${require('os').cpus().length}
- Total Memory: ${this.formatBytes(require('os').totalmem())}

## Test Results

${results.map(result => `
### ${result.testCase}
- Duration: ${result.duration}ms
- Trajectories: ${result.trajectoryCount}
- Average Response Time: ${result.metrics.avgResponseTime.toFixed(2)}ms
- Throughput: ${result.metrics.throughput.toFixed(2)}/s
- Memory Usage: ${this.formatBytes(result.metrics.avgMemoryUsage)}
- Cache Hit Rate: ${(result.cacheStats.hitRate * 100).toFixed(1)}%
- Status: ${result.success ? '✅ PASS' : '❌ FAIL'}
`).join('\n')}

## Recommendations
${this.generateRecommendations(results)}
`;
    }

    private generateRecommendations(results: any[]): string {
        const recommendations: string[] = [];

        // Analyze response times
        const highResponseTimes = results.filter(r => r.metrics.avgResponseTime > 50);
        if (highResponseTimes.length > 0) {
            recommendations.push('- Consider optimizing computation for better response times');
        }

        // Analyze cache performance
        const lowCacheHits = results.filter(r => r.cacheStats.hitRate < 0.7);
        if (lowCacheHits.length > 0) {
            recommendations.push('- Cache hit rate could be improved:');
            recommendations.push('  - Consider adjusting cache size');
            recommendations.push('  - Review cache key generation');
            recommendations.push('  - Implement cache preloading for common scenarios');
        }

        // Analyze memory usage
        const highMemoryUsage = results.filter(r => 
            r.metrics.avgMemoryUsage > 0.8 * require('os').totalmem()
        );
        if (highMemoryUsage.length > 0) {
            recommendations.push('- High memory usage detected:');
            recommendations.push('  - Review memory allocation patterns');
            recommendations.push('  - Consider implementing memory limits');
            recommendations.push('  - Monitor for memory leaks');
        }

        return recommendations.join('\n');
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
