import { CacheAnalytics } from './cache-analytics';

export class CacheReportGenerator {
    private static instance: CacheReportGenerator;
    private readonly analytics: CacheAnalytics;

    private constructor() {
        this.analytics = CacheAnalytics.getInstance();
    }

    public static getInstance(): CacheReportGenerator {
        if (!CacheReportGenerator.instance) {
            CacheReportGenerator.instance = new CacheReportGenerator();
        }
        return CacheReportGenerator.instance;
    }

    public generateMarkdownReport(): string {
        const data = this.analytics.getAnalytics();
        const now = new Date().toISOString();

        return `# Cache Performance Report
Generated: ${now}

## Overall Statistics
- Total Entries: ${data.overallStats.entryCount}
- Memory Usage: ${this.formatSize(data.overallStats.memoryUsage)}
- Hit Rate: ${(data.overallStats.hitRate * 100).toFixed(1)}%
- Average Entry Age: ${(data.overallStats.averageAge / 1000).toFixed(1)}s

## Memory Usage
- Current Usage: ${this.formatSize(data.memoryStats.currentUsage)}
- Peak Usage: ${this.formatSize(data.memoryStats.peakUsage)}
- Average Entry Size: ${this.formatSize(data.memoryStats.averageEntrySize)}

### Size Distribution
${this.generateSizeDistributionTable(data.memoryStats.sizeDistribution)}

## Performance Metrics
- Average Access Time: ${data.performanceStats.averageAccessTime.toFixed(2)}ms
- 95th Percentile: ${data.performanceStats.p95AccessTime.toFixed(2)}ms
- 99th Percentile: ${data.performanceStats.p99AccessTime.toFixed(2)}ms
- Eviction Rate: ${(data.performanceStats.evictionRate * 100).toFixed(1)}%
- Last Cleanup Time: ${data.performanceStats.cleanupTime.toFixed(1)}ms

## Access Patterns
${this.generatePatternTable(data.patternStats)}

## Time Series Analysis
${this.generateTimeSeriesSection(data.timeSeriesStats)}

## Recommendations
${this.generateRecommendations(data)}`;
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1048576).toFixed(1)}MB`;
    }

    private generateSizeDistributionTable(distribution: Array<{
        range: string;
        count: number;
        totalSize: number;
    }>): string {
        return `| Size Range | Count | Total Size |
|------------|--------|------------|
${distribution.map(d => 
    `| ${d.range} | ${d.count} | ${this.formatSize(d.totalSize)} |`
).join('\n')}`;
    }

    private generatePatternTable(patterns: Array<{
        pattern: string;
        hitCount: number;
        missCount: number;
        hitRate: number;
        averageAccessTime: number;
    }>): string {
        const sortedPatterns = [...patterns].sort((a, b) => 
            (b.hitCount + b.missCount) - (a.hitCount + a.missCount)
        ).slice(0, 10);

        return `| Pattern | Hits | Misses | Hit Rate | Avg Time |
|----------|------|---------|-----------|-----------|
${sortedPatterns.map(p => 
    `| ${p.pattern} | ${p.hitCount} | ${p.missCount} | ${(p.hitRate * 100).toFixed(1)}% | ${p.averageAccessTime.toFixed(1)}ms |`
).join('\n')}`;
    }

    private generateTimeSeriesSection(timeSeries: Array<{
        timestamp: number;
        hitRate: number;
        memoryUsage: number;
        entryCount: number;
    }>): string {
        const hours = Array.from(new Set(
            timeSeries.map(t => new Date(t.timestamp).getHours())
        )).sort((a, b) => a - b);

        const hourlyStats = hours.map(hour => {
            const points = timeSeries.filter(t => 
                new Date(t.timestamp).getHours() === hour
            );
            return {
                hour,
                hitRate: points.reduce((sum, p) => sum + p.hitRate, 0) / points.length,
                memoryUsage: points.reduce((sum, p) => sum + p.memoryUsage, 0) / points.length,
                entryCount: points.reduce((sum, p) => sum + p.entryCount, 0) / points.length
            };
        });

        return `### Hourly Trends
| Hour | Hit Rate | Memory Usage | Entries |
|------|-----------|--------------|----------|
${hourlyStats.map(h => 
    `| ${h.hour}:00 | ${(h.hitRate * 100).toFixed(1)}% | ${this.formatSize(h.memoryUsage)} | ${Math.round(h.entryCount)} |`
).join('\n')}`;
    }

    private generateRecommendations(data: CacheAnalytics): string {
        const recommendations: string[] = [];

        // Memory usage recommendations
        const memoryUtilization = data.memoryStats.currentUsage / data.memoryStats.peakUsage;
        if (memoryUtilization > 0.9) {
            recommendations.push('- Consider increasing cache size or implementing more aggressive eviction');
        }
        if (memoryUtilization < 0.5) {
            recommendations.push('- Cache may be oversized, consider reducing max memory allocation');
        }

        // Hit rate recommendations
        if (data.overallStats.hitRate < 0.7) {
            recommendations.push('- Low hit rate detected. Consider:');
            recommendations.push('  - Adjusting cache key generation');
            recommendations.push('  - Increasing cache lifetime');
            recommendations.push('  - Implementing predictive preloading');
        }

        // Access pattern recommendations
        const hotPatterns = data.patternStats
            .filter(p => (p.hitCount + p.missCount) > 100)
            .sort((a, b) => b.hitRate - a.hitRate);
        
        if (hotPatterns.length > 0) {
            recommendations.push('- High-traffic patterns detected:');
            hotPatterns.slice(0, 3).forEach(p => {
                recommendations.push(`  - Consider preloading pattern: ${p.pattern}`);
            });
        }

        // Performance recommendations
        if (data.performanceStats.p99AccessTime > 50) {
            recommendations.push('- High p99 access times. Consider:');
            recommendations.push('  - Optimizing cache key computation');
            recommendations.push('  - Reducing entry sizes');
            recommendations.push('  - Implementing sharding');
        }

        return recommendations.join('\n');
    }

    public generateJsonReport(): string {
        return JSON.stringify(this.analytics.getAnalytics(), null, 2);
    }
}
