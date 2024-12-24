import { PerformanceProfiler } from '../core/performance-profiler';
import { PerformanceMonitor } from '../core/performance-monitor';
import { BallState, Environment, BallProperties, LaunchConditions } from '../types';

describe('Performance Tests', () => {
    const profiler = new PerformanceProfiler();
    const monitor = PerformanceMonitor.getInstance();

    const initialState: BallState = {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 70, y: 0, z: 30 },
        spin: {
            rate: 2500,
            axis: { x: 0, y: 1, z: 0 }
        },
        mass: 0.0459
    };

    const environment: Environment = {
        temperature: 20,
        pressure: 101325,
        humidity: 0.5,
        altitude: 0,
        wind: { x: 5, y: 0, z: 0 }
    };

    const properties: BallProperties = {
        mass: 0.0459,
        radius: 0.02135,
        dragCoefficient: 0.47,
        liftCoefficient: 0.1,
        spinDecayRate: 50
    };

    const conditions: LaunchConditions = {
        ballSpeed: 70,
        launchAngle: 15,
        launchDirection: 0,
        spinRate: 2500,
        spinAxis: { x: 0, y: 1, z: 0 }
    };

    beforeEach(() => {
        monitor.clearMetrics();
    });

    describe('Flight Integration Performance', () => {
        it('should profile integration with default settings', async () => {
            monitor.startOperation('integration_0');
            const metrics = await profiler.profileIntegration(initialState, environment, properties, 10);
            
            expect(metrics.executionTime).toBeDefined();
            expect(metrics.memoryUsage).toBeDefined();
            expect(metrics.trajectoryPoints).toBeGreaterThan(0);
            expect(metrics.averageStepSize).toBeGreaterThan(0);
        }, 10000);

        it('should profile integration with high precision', async () => {
            monitor.startOperation('integration_1');
            const metrics = await profiler.profileIntegration(initialState, environment, properties, 5);
            
            expect(metrics.executionTime).toBeDefined();
            expect(metrics.memoryUsage).toBeDefined();
            expect(metrics.trajectoryPoints).toBeGreaterThan(0);
            expect(metrics.averageStepSize).toBeLessThan(0.01);
        }, 10000);
    });

    describe('Optimization Performance', () => {
        it('should profile optimization with default settings', async () => {
            monitor.startOperation('optimization_0');
            const metrics = await profiler.profileOptimization(conditions, environment, properties, 3);
            
            expect(metrics.executionTime).toBeDefined();
            expect(metrics.memoryUsage).toBeDefined();
            expect(metrics.cacheHits).toBeDefined();
            expect(metrics.cacheMisses).toBeDefined();
            expect(metrics.batchSize).toBeDefined();
        }, 20000);

        it('should profile optimization with high precision', async () => {
            monitor.startOperation('optimization_1');
            const metrics = await profiler.profileOptimization(conditions, environment, properties, 2);
            
            expect(metrics.executionTime).toBeDefined();
            expect(metrics.memoryUsage).toBeDefined();
            expect(metrics.cacheHits).toBeDefined();
            expect(metrics.cacheMisses).toBeDefined();
            expect(metrics.batchSize).toBeDefined();
        }, 20000);
    });

    describe('Memory Management', () => {
        it('should handle memory efficiently during long integration', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            monitor.startOperation('integration_2');
            const metrics = await profiler.profileIntegration(initialState, environment, properties, 20);
            const finalMemory = process.memoryUsage().heapUsed;
            
            expect(metrics.memoryUsage).toBeDefined();
            expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
        }, 30000);

        it('should monitor memory usage during execution', () => {
            const memorySnapshot = process.memoryUsage();
            
            expect(memorySnapshot.heapUsed).toBeDefined();
            expect(memorySnapshot.heapTotal).toBeDefined();
            expect(memorySnapshot.external).toBeDefined();
            expect(memorySnapshot.arrayBuffers).toBeDefined();
        });
    });

    describe('Cache Performance', () => {
        it('should track cache metrics', async () => {
            monitor.startOperation('optimization_2');
            const metrics = await profiler.profileOptimization(conditions, environment, properties, 2);
            
            expect(metrics.memoryUsage.peak).toBeDefined();
            expect(metrics.memoryUsage.average).toBeDefined();
            expect(metrics.cacheHits !== undefined && metrics.cacheMisses !== undefined).toBeTruthy();
            expect((metrics.cacheHits || 0) + (metrics.cacheMisses || 0)).toBeGreaterThan(0);
        });

        it('should maintain reasonable hit ratio', async () => {
            monitor.startOperation('optimization_3');
            const metrics = await profiler.profileOptimization(conditions, environment, properties, 5);
            
            const hits = metrics.cacheHits || 0;
            const misses = metrics.cacheMisses || 0;
            const hitRatio = hits / (hits + misses);
            expect(hitRatio).toBeGreaterThan(0.5); // At least 50% cache hit ratio
        });
    });

    describe('Parallel Processing Performance', () => {
        const batchSizes = [1, 2, 4, 8, 16];
        
        it('should scale efficiently with multiple threads', async () => {
            const results = await Promise.all(batchSizes.map(async (batchSize) => {
                monitor.startOperation(`parallel_${batchSize}`);
                const metrics = await profiler.profileIntegration(
                    initialState,
                    environment,
                    properties,
                    5,
                    { maxParallelTasks: batchSize }
                );
                return {
                    batchSize,
                    executionTime: metrics.executionTime,
                    throughput: metrics.trajectoryPoints / metrics.executionTime
                };
            }));

            // Verify scaling efficiency
            const singleThreadPerf = results[0].throughput;
            for (let i = 1; i < results.length; i++) {
                const scalingEfficiency = results[i].throughput / (singleThreadPerf * batchSizes[i]);
                expect(scalingEfficiency).toBeGreaterThan(0.7); // At least 70% scaling efficiency
            }
        }, 30000);

        it('should handle memory efficiently in parallel execution', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const metrics = await profiler.profileIntegration(
                initialState,
                environment,
                properties,
                10,
                { maxParallelTasks: 8 }
            );
            const finalMemory = process.memoryUsage().heapUsed;
            
            // Memory increase should be reasonable
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
            expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
            expect(metrics.memoryUsage.peak).toBeDefined();
            expect(metrics.memoryUsage.average).toBeDefined();
        }, 20000);
    });

    describe('Cache Optimization', () => {
        it('should maintain high cache hit rates under load', async () => {
            // Warm up cache
            await profiler.profileOptimization(conditions, environment, properties, 2);
            
            monitor.startOperation('cache_performance');
            const metrics = await profiler.profileOptimization(
                conditions,
                environment,
                properties,
                5,
                { maxParallelTasks: 4 }
            );
            
            const hits = metrics.cacheHits || 0;
            const misses = metrics.cacheMisses || 0;
            const hitRate = hits / (hits + misses);
            expect(hitRate).toBeGreaterThan(0.8); // At least 80% hit rate
            expect(metrics.cacheSize || 0).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
        }, 30000);

        it('should efficiently evict least valuable entries', async () => {
            monitor.startOperation('optimization_4');
            const initialMetrics = await profiler.profileOptimization(
                conditions,
                environment,
                properties,
                2
            );

            // Create pressure on cache
            const modifiedConditions = { ...conditions, ballSpeed: 75 };
            const finalMetrics = await profiler.profileOptimization(
                modifiedConditions,
                environment,
                properties,
                3
            );

            expect(finalMetrics.cacheEvictions || 0).toBeGreaterThan(0);
            expect((finalMetrics.cacheSize || 0)).toBeLessThan(initialMetrics.cacheSize || Infinity);
        }, 20000);
    });

    describe('Adaptive Batch Sizing', () => {
        it('should adjust batch size based on system load', async () => {
            monitor.startOperation('optimization_5');
            const metrics = await profiler.profileOptimization(
                conditions,
                environment,
                properties,
                10,
                { adaptiveBatching: true }
            );

            expect(metrics.batchSizeAdjustments || 0).toBeGreaterThan(0);
            expect(metrics.averageBatchSize || 0).toBeGreaterThan(0);
            expect(metrics.executionTime).toBeDefined();
        }, 20000);

        it('should maintain performance under varying loads', async () => {
            monitor.startOperation('optimization_6');
            const results = [];
            
            // Run multiple batches with increasing load
            for (let i = 0; i < 3; i++) {
                const metrics = await profiler.profileOptimization(
                    conditions,
                    environment,
                    properties,
                    5 + i * 5,
                    { adaptiveBatching: true }
                );
                results.push(metrics);
            }

            // Verify performance consistency
            const throughputs = results.map(m => m.trajectoryPoints / m.executionTime);
            const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;
            const maxDeviation = Math.max(...throughputs.map(t => Math.abs(t - avgThroughput) / avgThroughput));
            
            expect(maxDeviation).toBeLessThan(0.3); // Less than 30% deviation
        }, 30000);
    });
});
