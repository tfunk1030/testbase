import { PredictionEngine, AccessPrediction, PredictionConfidence, ResourceForecast, OptimizationRecommendation } from '../../core/cache/prediction-engine';
import { AccessPattern } from '../../core/cache/pattern-detection';

describe('PredictionEngine', () => {
    let engine: PredictionEngine;

    beforeEach(() => {
        engine = new PredictionEngine({
            predictionWindow: 1000,
            minConfidence: 0.6,
            forecastInterval: 100,
            maxPredictions: 100,
            learningRate: 0.1
        });
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Access Prediction', () => {
        it('should generate predictions from temporal patterns', () => {
            const patterns: AccessPattern[] = [{
                id: 'temporal:test1',
                type: 'temporal',
                confidence: 0.8,
                strength: 0.9,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 10,
                keys: new Set(['key1', 'key2']),
                metadata: {
                    temporalGap: 1000,
                    memoryImpact: 100,
                    hitRatio: 0.9
                }
            }];

            const predictions = engine.predictAccess(patterns);
            expect(predictions.length).toBeGreaterThan(0);
            expect(predictions[0].confidence).toBe(PredictionConfidence.HIGH);
            expect(predictions[0].probability).toBeGreaterThan(0.7);
        });

        it('should generate predictions from spatial patterns', () => {
            const patterns: AccessPattern[] = [{
                id: 'spatial:test1',
                type: 'spatial',
                confidence: 0.8,
                strength: 0.9,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 10,
                keys: new Set(['key1', 'key2', 'key3']),
                metadata: {
                    spatialDistance: 1,
                    memoryImpact: 100,
                    hitRatio: 0.9
                }
            }];

            const predictions = engine.predictAccess(patterns);
            expect(predictions.length).toBe(3); // One for each key
            predictions.forEach(prediction => {
                expect(prediction.confidence).toBe(PredictionConfidence.HIGH);
            });
        });

        it('should filter out low confidence predictions', () => {
            const patterns: AccessPattern[] = [{
                id: 'test1',
                type: 'temporal',
                confidence: 0.3, // Below minimum confidence
                strength: 0.4,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 5,
                keys: new Set(['key1']),
                metadata: {
                    temporalGap: 1000,
                    memoryImpact: 100,
                    hitRatio: 0.4
                }
            }];

            const predictions = engine.predictAccess(patterns);
            expect(predictions.length).toBe(0);
        });
    });

    describe('Resource Forecasting', () => {
        it('should generate resource forecasts', (done) => {
            let forecastReceived = false;
            engine.on('forecastUpdated', (forecast: ResourceForecast) => {
                forecastReceived = true;
                expect(forecast.memoryUsage).toBeDefined();
                expect(forecast.cpuLoad).toBeDefined();
                expect(forecast.cacheSize).toBeDefined();
                done();
            });

            engine.start();

            // Generate some predictions to base forecast on
            const patterns: AccessPattern[] = [{
                id: 'test1',
                type: 'temporal',
                confidence: 0.9,
                strength: 0.9,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 10,
                keys: new Set(['key1']),
                metadata: {
                    temporalGap: 1000,
                    memoryImpact: 100,
                    hitRatio: 0.9
                }
            }];

            engine.predictAccess(patterns);

            // Ensure forecast was generated
            setTimeout(() => {
                if (!forecastReceived) {
                    done(new Error('No forecast received'));
                }
            }, 1000);
        });
    });

    describe('Optimization Recommendations', () => {
        it('should generate recommendations based on forecasts', (done) => {
            let recommendationReceived = false;
            engine.on('recommendationGenerated', (recommendation: OptimizationRecommendation) => {
                recommendationReceived = true;
                expect(recommendation.type).toBeDefined();
                expect(recommendation.priority).toBeDefined();
                expect(recommendation.impact).toBeDefined();
                done();
            });

            engine.start();

            // Generate high-probability predictions to trigger recommendations
            const patterns: AccessPattern[] = [{
                id: 'test1',
                type: 'temporal',
                confidence: 0.95,
                strength: 0.95,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 20,
                keys: new Set(['key1', 'key2', 'key3']),
                metadata: {
                    temporalGap: 500,
                    memoryImpact: 1000, // High memory impact
                    hitRatio: 0.95
                }
            }];

            engine.predictAccess(patterns);

            // Ensure recommendation was generated
            setTimeout(() => {
                if (!recommendationReceived) {
                    done(new Error('No recommendation received'));
                }
            }, 1000);
        });
    });

    describe('Prediction Validation', () => {
        it('should validate predictions against actual access', () => {
            // Generate initial prediction
            const patterns: AccessPattern[] = [{
                id: 'test1',
                type: 'temporal',
                confidence: 0.9,
                strength: 0.9,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 10,
                keys: new Set(['key1']),
                metadata: {
                    temporalGap: 100,
                    memoryImpact: 100,
                    hitRatio: 0.9
                }
            }];

            engine.predictAccess(patterns);

            // Validate prediction
            engine.validatePrediction('key1');
            const predictions = engine.getPredictions();
            const validatedPrediction = predictions.find(p => p.key === 'key1');
            
            expect(validatedPrediction).toBeDefined();
            if (validatedPrediction) {
                expect(validatedPrediction.metadata.accuracy).toBeDefined();
            }
        });
    });

    describe('Performance and Resource Usage', () => {
        it('should handle rapid prediction updates', () => {
            const startTime = Date.now();

            // Generate many patterns
            const patterns: AccessPattern[] = Array.from({ length: 100 }, (_, i) => ({
                id: `test${i}`,
                type: 'temporal',
                confidence: 0.9,
                strength: 0.9,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 10,
                keys: new Set([`key${i}`]),
                metadata: {
                    temporalGap: 1000,
                    memoryImpact: 100,
                    hitRatio: 0.9
                }
            }));

            // Generate predictions rapidly
            for (let i = 0; i < 10; i++) {
                engine.predictAccess(patterns);
            }

            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(1000); // Should process quickly
        });

        it('should maintain prediction limit', () => {
            // Generate more patterns than maxPredictions
            const patterns: AccessPattern[] = Array.from({ length: 200 }, (_, i) => ({
                id: `test${i}`,
                type: 'temporal',
                confidence: 0.9,
                strength: 0.9,
                firstSeen: new Date(),
                lastSeen: new Date(),
                frequency: 10,
                keys: new Set([`key${i}`]),
                metadata: {
                    temporalGap: 1000,
                    memoryImpact: 100,
                    hitRatio: 0.9
                }
            }));

            engine.predictAccess(patterns);
            const predictions = engine.getPredictions();
            expect(predictions.length).toBeLessThanOrEqual(100); // maxPredictions
        });
    });
});
