import { PerformanceTestSuite } from './performance-test-suite';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
    console.log('Starting performance test suite...');
    const testSuite = new PerformanceTestSuite();
    
    try {
        console.log('Running tests...');
        const results = await testSuite.runPerformanceTests();
        
        // Create reports directory if it doesn't exist
        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // Save detailed JSON report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonReport = path.join(reportsDir, `performance-report-${timestamp}.json`);
        fs.writeFileSync(jsonReport, JSON.stringify(results, null, 2));

        // Generate human-readable markdown report
        const mdReport = generateMarkdownReport(results);
        const mdFile = path.join(reportsDir, `performance-report-${timestamp}.md`);
        fs.writeFileSync(mdFile, mdReport);

        console.log(`\nPerformance tests completed successfully!`);
        console.log(`Reports saved to:\n- ${jsonReport}\n- ${mdFile}`);

        // Print summary
        console.log('\nKey Findings:');
        console.log(`- Optimal batch size: ${results.batchTests.optimalBatchSize}`);
        console.log(`- Memory leak test: ${results.memoryTests.leakTest ? 'PASSED' : 'FAILED'}`);
        console.log(`- Cache hit rate at optimal size: ${(results.cacheTests.hitRates.reduce((max, curr) => curr.rate > max ? curr.rate : max, 0) * 100).toFixed(1)}%`);
        console.log(`- Parallel processing efficiency: ${(results.parallelTests.scalingEfficiency.reduce((max, curr) => curr.efficiency > max ? curr.efficiency : max, 0) * 100).toFixed(1)}%`);

    } catch (error) {
        console.error('Error running performance tests:', error);
        process.exit(1);
    }
}

function generateMarkdownReport(results: any): string {
    const timestamp = new Date().toISOString();
    let report = `# Performance Test Report
Generated: ${timestamp}

## Hardware Configuration
- CPUs: ${results.hardwareInfo.cpuCount}x ${results.hardwareInfo.cpus[0].model}
- Total Memory: ${(results.hardwareInfo.totalMemory / (1024 * 1024 * 1024)).toFixed(2)} GB
- Platform: ${results.hardwareInfo.platform}
- Architecture: ${results.hardwareInfo.arch}

## Memory Usage Analysis
- Baseline Memory Usage: ${(results.memoryTests.baselineMemory.heapUsed / (1024 * 1024)).toFixed(2)} MB
- Average Single Trajectory Memory: ${(average(results.memoryTests.trajectoryMemory) / 1024).toFixed(2)} KB
- Memory Leak Test: ${results.memoryTests.leakTest ? 'PASSED' : 'FAILED'}

### Batch Memory Usage
| Batch Size | Memory Used (MB) |
|------------|-----------------|
${results.memoryTests.batchMemory.map(b => 
    `| ${b.batchSize} | ${(b.memoryUsed / (1024 * 1024)).toFixed(2)} |`
).join('\n')}

## Parallel Processing Performance
- Optimal Batch Size: ${results.parallelTests.optimalBatchSize}
- Maximum Scaling Efficiency: ${(Math.max(...results.parallelTests.scalingEfficiency.map(s => s.efficiency)) * 100).toFixed(1)}%

### Scaling Efficiency
| Batch Size | Efficiency (%) |
|------------|---------------|
${results.parallelTests.scalingEfficiency.map(s => 
    `| ${s.batchSize} | ${(s.efficiency * 100).toFixed(1)} |`
).join('\n')}

## Cache Performance
- Optimal Cache Size: ${results.cacheTests.optimalSettings.maxSize} MB
- Best Hit Rate: ${(Math.max(...results.cacheTests.hitRates.map(h => h.rate)) * 100).toFixed(1)}%

### Cache Size vs Hit Rate
| Cache Size (MB) | Hit Rate (%) |
|----------------|-------------|
${results.cacheTests.hitRates.map(h => 
    `| ${h.size} | ${(h.rate * 100).toFixed(1)} |`
).join('\n')}

## Batch Processing Performance
- Optimal Batch Size: ${results.batchTests.optimalBatchSize}
- Peak Throughput: ${Math.max(...results.batchTests.throughput.map(t => t.itemsPerSecond)).toFixed(1)} items/sec

### Batch Size vs Throughput
| Batch Size | Items/sec | Avg Latency (ms) |
|------------|-----------|-----------------|
${results.batchTests.throughput.map((t, i) => 
    `| ${t.batchSize} | ${t.itemsPerSecond.toFixed(1)} | ${results.batchTests.latency[i].averageLatency.toFixed(1)} |`
).join('\n')}

## Recommendations
1. Use batch size of ${results.batchTests.optimalBatchSize} for optimal throughput/resource balance
2. Configure cache size to ${results.cacheTests.optimalSettings.maxSize} MB
3. Set cache cleanup interval to ${results.cacheTests.optimalSettings.cleanupInterval} seconds
4. Set cache entry max age to ${results.cacheTests.optimalSettings.maxAge} seconds
`;

    return report;
}

function average(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

// Run the tests
runTests().catch(console.error);
