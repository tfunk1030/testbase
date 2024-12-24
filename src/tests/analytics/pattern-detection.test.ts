import { CacheAnalytics } from '../../core/cache/cache-analytics';
import { MemoryUsage } from '../../core/types';
import { PatternDetector, AccessPattern, PatternDetectionConfig } from '../../core/cache/pattern-detection';

describe('Pattern Detection Analytics', () => {
    let analytics: CacheAnalytics;

    beforeEach(() => {
        analytics = new CacheAnalytics(1000, 100); // maxEvents = 1000, maxSnapshots = 100
    });

    describe('Access Pattern Detection', () => {
        it('should detect sequential access patterns', () => {
            // Create sequential access pattern
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess('key1', true, 1000, 5);
                analytics.recordAccess('key2', true, 1000, 4);
                analytics.recordAccess('key3', true, 1000, 3);
            }

            const recommendations = analytics.getRecommendations();
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations[0].type).toBe('preload');
            expect(recommendations[0].keys).toContain('key1');
            expect(recommendations[0].keys).toContain('key2');
            expect(recommendations[0].keys).toContain('key3');
        });

        it('should detect temporal patterns', () => {
            // Create temporal access pattern
            for (let i = 0; i < 3; i++) {
                analytics.recordAccess('tempKey1', true, 1000, 5);
                setTimeout(() => {
                    analytics.recordAccess('tempKey2', true, 1000, 4);
                }, 100);
                setTimeout(() => {
                    analytics.recordAccess('tempKey3', true, 1000, 3);
                }, 200);
            }

            const recommendations = analytics.getRecommendations();
            const temporalPattern = recommendations.find(r => 
                r.reason.includes('temporal') ||
                (r.keys && r.keys.some(k => k.includes('tempKey')))
            );
            expect(temporalPattern).toBeDefined();
        });

        it('should identify high-frequency access patterns', () => {
            // Create high-frequency pattern
            const frequentKeys = ['freq1', 'freq2', 'freq3'];
            const rareKeys = ['rare1', 'rare2'];

            // Access frequent keys multiple times
            for (let i = 0; i < 10; i++) {
                for (const key of frequentKeys) {
                    analytics.recordAccess(key, true, 1000, 5);
                }
            }

            // Access rare keys fewer times
            for (let i = 0; i < 2; i++) {
                for (const key of rareKeys) {
                    analytics.recordAccess(key, true, 1000, 5);
                }
            }

            const recommendations = analytics.getRecommendations();
            const frequentAccess = recommendations.find(r =>
                r.reason.includes('Frequently accessed')
            );

            expect(frequentAccess).toBeDefined();
            expect(frequentAccess?.keys).toContain('freq1');
            expect(frequentAccess?.keys).not.toContain('rare1');
        });

        it('should detect sequential dependencies', () => {
            // Create sequential dependency pattern
            const sequence = ['seq1', 'seq2', 'seq3'];
            
            // Access in sequence multiple times
            for (let i = 0; i < 5; i++) {
                for (const key of sequence) {
                    analytics.recordAccess(key, true, 1000, 5);
                }
            }

            const recommendations = analytics.getRecommendations();
            const sequentialPattern = recommendations.find(r =>
                r.keys && r.keys.includes('seq1') &&
                r.keys.includes('seq2')
            );
            expect(sequentialPattern).toBeDefined();
        });

        it('should adapt to changing patterns', () => {
            // Establish initial pattern
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess('pattern1', true, 1000, 5);
                analytics.recordAccess('pattern2', true, 1000, 5);
            }

            // Change the pattern
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess('pattern2', true, 1000, 5);
                analytics.recordAccess('pattern3', true, 1000, 5);
            }

            const recommendations = analytics.getRecommendations();
            expect(recommendations.some(r => r.keys && r.keys.includes('pattern3'))).toBe(true);
            expect(recommendations[0].keys).not.toContain('pattern1');
        });

        it('should consider entry sizes in patterns', () => {
            // Create patterns with different entry sizes
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess('heavy1', true, 5000, 5);
                analytics.recordAccess('light1', true, 1000, 5);
                analytics.recordAccess('heavy2', true, 4000, 5);
                analytics.recordAccess('light2', true, 800, 5);
            }

            const recommendations = analytics.getRecommendations();
            const sizeBasedPattern = recommendations.find(r => 
                r.reason.includes('size') || r.reason.includes('memory')
            );
            expect(sizeBasedPattern).toBeDefined();
        });
    });

    describe('Pattern Prediction', () => {
        it('predicts future access needs', () => {
            // Simulate a predictable sequence
            const sequence = ['seq1', 'seq2', 'seq3'];
            
            // Repeat sequence multiple times
            for (let i = 0; i < 4; i++) {
                sequence.forEach(key => {
                    analytics.recordAccess(key, true, 1000, 5);
                });
            }

            const recommendations = analytics.getRecommendations();
            const sequencePattern = recommendations.find(r => 
                r.keys && r.keys.includes('seq1') && 
                r.keys.includes('seq2')
            );
            expect(sequencePattern).toBeDefined();
            expect(sequencePattern?.type).toBe('preload');
        });

        it('adapts predictions to changing patterns', () => {
            // Initial pattern
            for (let i = 0; i < 3; i++) {
                analytics.recordAccess('pattern1', true, 1000, 5);
                analytics.recordAccess('pattern2', true, 1000, 5);
            }

            // Changed pattern
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess('pattern2', true, 1000, 5);
                analytics.recordAccess('pattern3', true, 1000, 5);
            }

            const recommendations = analytics.getRecommendations();
            expect(recommendations.some(r => r.keys && r.keys.includes('pattern3'))).toBe(true);
            expect(recommendations[0].keys).not.toContain('pattern1');
        });
    });

    describe('Preloading Optimization', () => {
        it('optimizes preloading strategies', () => {
            // Simulate access patterns with memory impact
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess('heavy1', true, 5000, 5);
                analytics.recordAccess('light1', true, 1000, 5);
                analytics.recordAccess('heavy2', true, 4000, 5);
                analytics.recordAccess('light2', true, 800, 5);
            }

            const recommendations = analytics.getRecommendations();
            const preloadRecs = recommendations.filter(r => r.type === 'preload');
            
            // Verify memory-aware preloading
            expect(preloadRecs.length).toBeGreaterThan(0);
            preloadRecs.forEach(rec => {
                expect(rec.impact.memory).toBeDefined();
                expect(rec.priority).toBeDefined();
            });
        });

        it('balances memory usage with access frequency', () => {
            // Record memory usage
            const memoryUsage: MemoryUsage = {
                total: 100000,
                used: 90000,
                free: 10000,
                heapTotal: 80000,
                heapUsed: 40000,
                external: 1000,
                gc: [{
                    collections: 1,
                    pauseTime: 10,
                    type: 'major'
                }]
            };
            analytics.recordMemoryUsage(memoryUsage);

            // Simulate high-frequency but memory-intensive access
            for (let i = 0; i < 10; i++) {
                analytics.recordAccess('large_frequent', true, 10000, 5);
            }

            // Simulate low-frequency but memory-light access
            for (let i = 0; i < 3; i++) {
                analytics.recordAccess('small_rare', true, 1000, 5);
            }

            const recommendations = analytics.getRecommendations();
            const memoryAware = recommendations.find(r => 
                r.impact.memory > 0 && r.type === 'preload'
            );
            expect(memoryAware).toBeDefined();
            expect(memoryAware?.priority).toBeLessThan(5); // Lower priority due to memory impact
        });

        it('considers eviction in preloading decisions', () => {
            // Fill up memory
            for (let i = 0; i < 5; i++) {
                analytics.recordMemoryUsage({
                    total: 100000,
                    used: 90000 + i * 1000,
                    free: 10000 - i * 1000
                });
            }

            // Record some evictions
            analytics.recordEviction('evicted1');
            analytics.recordEviction('evicted2');

            // Try to establish new patterns
            for (let i = 0; i < 5; i++) {
                analytics.recordAccess('new_pattern1', true, 2000, 5);
                analytics.recordAccess('new_pattern2', true, 2000, 5);
            }

            const recommendations = analytics.getRecommendations();
            expect(recommendations.some(r => r.type === 'evict')).toBe(true);
            
            const preloadRecs = recommendations.filter(r => r.type === 'preload');
            expect(preloadRecs.every(r => r.impact.memory < 5000)).toBe(true);
        });
    });
});

describe('PatternDetector', () => {
    let detector: PatternDetector;
    const defaultConfig: PatternDetectionConfig = {
        temporalWindowSize: 1000,
        spatialWindowSize: 50,
        minConfidence: 0.7,
        minStrength: 0.5,
        samplingRate: 10,
        decayFactor: 0.95
    };

    beforeEach(() => {
        detector = new PatternDetector(defaultConfig);
    });

    afterEach(() => {
        detector.stop();
    });

    describe('Temporal Pattern Detection', () => {
        it('should detect regular access patterns', async () => {
            const detectedPatterns: AccessPattern[] = [];
            detector.on('patternDetected', (pattern) => {
                if (pattern.type === 'temporal') {
                    detectedPatterns.push(pattern);
                }
            });

            detector.start();

            // Simulate regular access pattern
            for (let i = 0; i < 10; i++) {
                detector.recordAccess('key1', 100);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            expect(detectedPatterns.length).toBeGreaterThan(0);
            const pattern = detectedPatterns[0];
            expect(pattern.type).toBe('temporal');
            expect(pattern.confidence).toBeGreaterThanOrEqual(defaultConfig.minConfidence);
            expect(pattern.strength).toBeGreaterThanOrEqual(defaultConfig.minStrength);
        });

        it('should detect irregular access patterns with lower confidence', async () => {
            const detectedPatterns: AccessPattern[] = [];
            detector.on('patternDetected', (pattern) => {
                if (pattern.type === 'temporal') {
                    detectedPatterns.push(pattern);
                }
            });

            detector.start();

            // Simulate irregular access pattern
            for (let i = 0; i < 10; i++) {
                detector.recordAccess('key2', 100);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
            }

            const irregularPatterns = detectedPatterns.filter(p => p.confidence < 0.9);
            expect(irregularPatterns.length).toBeGreaterThan(0);
        });
    });

    describe('Spatial Pattern Detection', () => {
        it('should detect related key access patterns', async () => {
            const detectedPatterns: AccessPattern[] = [];
            detector.on('patternDetected', (pattern) => {
                if (pattern.type === 'spatial') {
                    detectedPatterns.push(pattern);
                }
            });

            detector.start();

            // Simulate related key access pattern
            for (let i = 0; i < 10; i++) {
                detector.recordAccess(`group1_key${i}`, 100);
                detector.recordAccess(`group1_key${i + 1}`, 100);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            expect(detectedPatterns.length).toBeGreaterThan(0);
            const pattern = detectedPatterns[0];
            expect(pattern.type).toBe('spatial');
            expect(pattern.keys.size).toBeGreaterThan(1);
        });

        it('should detect key clusters', async () => {
            const detectedPatterns: AccessPattern[] = [];
            detector.on('patternDetected', (pattern) => {
                if (pattern.type === 'spatial') {
                    detectedPatterns.push(pattern);
                }
            });

            detector.start();

            // Simulate cluster access pattern
            for (let i = 0; i < 5; i++) {
                // Cluster 1
                detector.recordAccess('cluster1_key1', 100);
                detector.recordAccess('cluster1_key2', 100);
                detector.recordAccess('cluster1_key3', 100);
                await new Promise(resolve => setTimeout(resolve, 50));

                // Random access
                detector.recordAccess(`random_key${Math.random()}`, 100);
                await new Promise(resolve => setTimeout(resolve, 50));

                // Cluster 2
                detector.recordAccess('cluster2_key1', 100);
                detector.recordAccess('cluster2_key2', 100);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            const clusters = detectedPatterns.filter(p => p.keys.size > 2);
            expect(clusters.length).toBeGreaterThan(0);
        });
    });

    describe('Pattern Lifecycle', () => {
        it('should decay patterns over time', async () => {
            let decayedPattern: AccessPattern | null = null;
            detector.on('patternDecayed', (pattern) => {
                decayedPattern = pattern;
            });

            detector.start();

            // Create a strong pattern
            for (let i = 0; i < 10; i++) {
                detector.recordAccess('decay_test_key', 100);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Wait for decay
            await new Promise(resolve => setTimeout(resolve, 2000));

            expect(decayedPattern).not.toBeNull();
            if (decayedPattern) {
                expect(decayedPattern.strength).toBeLessThan(defaultConfig.minStrength);
            }
        });

        it('should update existing patterns', async () => {
            const updates: AccessPattern[] = [];
            detector.on('patternUpdated', (pattern) => {
                updates.push(pattern);
            });

            detector.start();

            // Initial pattern
            for (let i = 0; i < 5; i++) {
                detector.recordAccess('update_test_key', 100);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Update pattern
            for (let i = 0; i < 5; i++) {
                detector.recordAccess('update_test_key', 100);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            expect(updates.length).toBeGreaterThan(0);
            const lastUpdate = updates[updates.length - 1];
            expect(lastUpdate.frequency).toBeGreaterThan(5);
        });
    });

    describe('Performance and Resource Usage', () => {
        it('should maintain reasonable memory usage', async () => {
            detector.start();

            // Generate lots of access patterns
            for (let i = 0; i < 1000; i++) {
                detector.recordAccess(`perf_test_key_${i % 100}`, 100);
            }

            const patterns = detector.getPatterns();
            expect(patterns.length).toBeLessThan(200); // Should clean up old patterns
        });

        it('should handle rapid access records', async () => {
            detector.start();
            const startTime = Date.now();

            // Rapid fire access records
            for (let i = 0; i < 1000; i++) {
                detector.recordAccess(`rapid_test_key_${i % 10}`, 100);
            }

            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(1000); // Should process quickly
        });
    });
});
