import { CacheAnalytics } from '../../core/cache/cache-analytics';
import { MemoryUsage } from '../../types';

describe('CacheAnalytics', () => {
    let analytics: CacheAnalytics;

    beforeEach(() => {
        analytics = new CacheAnalytics();
    });

    describe('access tracking', () => {
        it('should track cache hits and misses', () => {
            // Record some accesses with duration
            analytics.recordAccess('key1', true, 100, 5);
            analytics.recordAccess('key2', false, 100, 8);
            analytics.recordAccess('key1', true, 100, 3);

            const period = analytics.getCurrentPeriod();
            expect(period.stats.hits).toBe(2);
            expect(period.stats.misses).toBe(1);
        });

        it('should identify access patterns', () => {
            // Create a pattern by accessing keys in sequence
            analytics.recordAccess('key1', true, 100, 5);
            analytics.recordAccess('key2', true, 100, 4);
            analytics.recordAccess('key1', true, 100, 3);
            analytics.recordAccess('key2', true, 100, 4);
            analytics.recordAccess('key1', true, 100, 5);

            const period = analytics.getCurrentPeriod();
            expect(period.patterns.some(p => p.associatedKeys.length > 1)).toBe(true);
        });

        it('should calculate hit rate correctly', () => {
            analytics.recordAccess('key1', true, 100, 5);   // hit
            analytics.recordAccess('key2', false, 100, 8);  // miss
            analytics.recordAccess('key1', true, 100, 3);   // hit

            const period = analytics.getCurrentPeriod();
            expect(period.stats.hits / (period.stats.hits + period.stats.misses)).toBe(2/3);
        });
    });

    describe('memory monitoring', () => {
        it('should recommend eviction under memory pressure', () => {
            // Simulate high memory usage
            analytics.updateMemoryUsage({
                used: 8000000,
                free: 2000000,
                total: 10000000,
                heapUsage: 0.8,
                gcMetrics: {
                    collections: 0,
                    pauseTime: 0
                }
            });

            const recommendations = analytics.getRecommendations();
            expect(recommendations.some(r => r.type === 'evict')).toBe(true);
        });
    });

    describe('eviction tracking', () => {
        it('should track evicted entries', () => {
            analytics.recordAccess('key1', true, 100, 5);
            analytics.recordEviction('key1', 100);

            const period = analytics.getCurrentPeriod();
            expect(period.stats.entryCount).toBe(0);
        });
    });

    describe('period rotation', () => {
        it('should maintain historical data', () => {
            analytics.recordAccess('key1', true, 100, 5);
            analytics.updateMemoryUsage({
                used: 8000000,
                free: 2000000,
                total: 10000000,
                heapUsage: 0.8,
                gcMetrics: {
                    collections: 0,
                    pauseTime: 0
                }
            });

            // Rotate the period
            const completedPeriod = analytics.rotatePeriod();
            expect(completedPeriod.endTime).toBeTruthy();
            expect(completedPeriod.stats.hits).toBe(1);

            // Check new period is initialized
            const newPeriod = analytics.getCurrentPeriod();
            expect(newPeriod.stats.hits).toBe(0);
        });

        it('should maintain multiple historical periods', () => {
            // Create multiple periods
            for (let i = 0; i < 3; i++) {
                analytics.recordAccess('key1', true, 100, 5);
                analytics.rotatePeriod();
            }

            const history = analytics.getHistoricalData();
            expect(history.length).toBe(3);
        });
    });
});
