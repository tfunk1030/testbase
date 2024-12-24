import { CacheAnalytics } from '../../core/cache/cache-analytics';
import { MemorySnapshot } from '../../core/cache/types';

describe('Resource Usage Analysis', () => {
    let analytics: CacheAnalytics;

    beforeEach(() => {
        analytics = new CacheAnalytics(1000, 100); // maxEvents = 1000, maxSnapshots = 100
    });

    describe('Memory Usage Tracking', () => {
        it('should detect high memory pressure', () => {
            // Record normal memory usage
            const usage: MemorySnapshot = {
                timestamp: Date.now(),
                used: 5000000,
                free: 5000000,
                total: 10000000,
                heapUsage: 4000000,
                gcMetrics: {
                    collections: 10,
                    pauseTime: 100
                }
            };

            analytics.recordMemoryUsage(usage);

            // Record high memory usage
            const highUsage: MemorySnapshot = {
                timestamp: Date.now() + 1000,
                used: 8000000,
                free: 2000000,
                total: 10000000,
                heapUsage: 7000000,
                gcMetrics: {
                    collections: 15,
                    pauseTime: 150
                }
            };

            analytics.recordMemoryUsage(highUsage);

            const recommendations = analytics.getRecommendations();
            const pressureRec = recommendations.find(r => 
                r.type === 'evict' && r.reason.includes('memory')
            );

            expect(pressureRec).toBeDefined();
            expect(pressureRec?.impact.memory).toBeLessThan(0); // Negative impact indicates savings
        });

        it('should track memory growth rate', () => {
            // Record initial memory state
            analytics.recordMemoryUsage({
                timestamp: Date.now(),
                used: 4000000,
                free: 6000000,
                total: 10000000,
                heapUsage: 3500000,
                gcMetrics: {
                    collections: 5,
                    pauseTime: 50
                }
            });

            // Simulate memory growth
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess(`key${i}`, true, 1000, 5);
            }

            const recommendations = analytics.getRecommendations();
            const growthRec = recommendations.find(r => 
                r.reason.includes('growth') || r.type === 'evict'
            );

            expect(growthRec).toBeDefined();
        });

        it('should analyze hit rates with memory impact', () => {
            // Record memory baseline
            analytics.recordMemoryUsage({
                timestamp: Date.now(),
                used: 5000000,
                free: 5000000,
                total: 10000000,
                heapUsage: 4500000,
                gcMetrics: {
                    collections: 8,
                    pauseTime: 80
                }
            });

            // Simulate mixed hit/miss pattern
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess(`hit_key${i}`, true, 1000, 5);
                analytics.recordAccess(`miss_key${i}`, false, 1000, 10);
            }

            const recommendations = analytics.getRecommendations();
            expect(recommendations.some(r => r.type === 'resize')).toBe(true);
        });

        it('should detect cache thrashing', () => {
            // Record baseline memory
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess(`thrash_key${i}`, true, 1000, 5);
                analytics.recordEviction(`thrash_key${i-3}`, 1000);
            }

            const recommendations = analytics.getRecommendations();
            const thrashingRec = recommendations.find(r => 
                r.reason.includes('eviction') || r.type === 'resize'
            );

            expect(thrashingRec).toBeDefined();
        });

        it('should recommend optimal cache size', () => {
            // Record stable memory usage
            analytics.recordMemoryUsage({
                timestamp: Date.now(),
                used: 6000000,
                free: 4000000,
                total: 10000000,
                heapUsage: 5500000,
                gcMetrics: {
                    collections: 12,
                    pauseTime: 120
                }
            });

            // Simulate stable access pattern
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess(`stable_key${i}`, true, 1000, 5);
            }

            // Record increased memory pressure
            analytics.recordMemoryUsage({
                timestamp: Date.now() + 1000,
                used: 8000000,
                free: 2000000,
                total: 10000000,
                heapUsage: 7500000,
                gcMetrics: {
                    collections: 18,
                    pauseTime: 180
                }
            });

            // Simulate growing access pattern
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess(`growth_key${i}`, true, 1000, 5);
            }

            const recommendations = analytics.getRecommendations();
            const sizeRec = recommendations.find(r => r.type === 'resize');
            expect(sizeRec?.impact.performance).toBeDefined();
        });

        it('should balance performance vs memory usage', () => {
            // Simulate high-performance, high-memory scenario
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess(`perf_key${i}`, true, 500, 2);
            }

            // Record high memory usage
            analytics.recordMemoryUsage({
                timestamp: Date.now(),
                used: 9000000,
                free: 1000000,
                total: 10000000,
                heapUsage: 8500000,
                gcMetrics: {
                    collections: 25,
                    pauseTime: 250
                }
            });

            const recommendations = analytics.getRecommendations();
            const hasPerformanceRec = recommendations.some(r => r.impact.performance > 0);
            const hasMemoryRec = recommendations.some(r => r.impact.memory < 0);

            expect(hasPerformanceRec && hasMemoryRec).toBe(true);
        });

        it('should handle concurrent access patterns', () => {
            // Simulate concurrent access patterns
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess(`group1_key${i}`, true, 1000, 5);
                analytics.recordAccess(`group2_key${i}`, true, 1000, 5);
            }

            // Simulate evictions
            analytics.recordEviction('group1_key0', 1000);
            analytics.recordEviction('group2_key0', 1000);

            const recommendations = analytics.getRecommendations();
            expect(recommendations.length).toBeGreaterThan(0);
        });

        it('should adapt to changing workloads', () => {
            // Record initial state
            analytics.recordMemoryUsage({
                timestamp: Date.now(),
                used: 5000000,
                free: 5000000,
                total: 10000000,
                heapUsage: 4500000,
                gcMetrics: {
                    collections: 10,
                    pauseTime: 100
                }
            });

            // Simulate changing workload
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess(`adaptive_key${i}`, true, 1000, 5);
            }

            const recommendations = analytics.getRecommendations();
            expect(recommendations.some(r => r.type === 'resize')).toBe(true);
        });
    });
});
