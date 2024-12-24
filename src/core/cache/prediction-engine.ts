import { EventEmitter } from 'events';
import { AccessPattern } from './pattern-detection';
import { MemoryUsage, ResourceMetrics } from '../types';

/**
 * Prediction confidence levels
 */
export enum PredictionConfidence {
    LOW = 'low',      // < 50% confidence
    MEDIUM = 'medium', // 50-80% confidence
    HIGH = 'high'     // > 80% confidence
}

/**
 * Represents a predicted future access
 */
export interface AccessPrediction {
    key: string;
    probability: number;
    confidence: PredictionConfidence;
    expectedTimestamp: Date;
    metadata: {
        patternId: string;
        memoryImpact: number;
        accuracy?: number;  // Updated after validation
    };
}

/**
 * Resource demand forecast
 */
export interface ResourceForecast {
    timestamp: Date;
    memoryUsage: {
        expected: number;
        upperBound: number;
        lowerBound: number;
    };
    cpuLoad: {
        expected: number;
        upperBound: number;
        lowerBound: number;
    };
    cacheSize: {
        expected: number;
        upperBound: number;
        lowerBound: number;
    };
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
    type: 'preload' | 'evict' | 'resize' | 'restructure';
    priority: number;
    confidence: PredictionConfidence;
    impact: {
        memory: number;
        performance: number;
        reliability: number;
    };
    description: string;
    suggestedAction: string;
    metadata: {
        patterns: string[];
        predictions: string[];
        resourceImpact: ResourceForecast;
    };
}

/**
 * Configuration for the prediction engine
 */
export interface PredictionConfig {
    predictionWindow: number;     // Time window for predictions (ms)
    minConfidence: number;        // Minimum confidence for predictions
    forecastInterval: number;     // Interval between forecasts (ms)
    maxPredictions: number;       // Maximum number of predictions to maintain
    learningRate: number;         // Rate of model adaptation
}

/**
 * Advanced prediction engine for cache behavior forecasting
 */
export class PredictionEngine extends EventEmitter {
    private predictions: Map<string, AccessPrediction>;
    private forecasts: ResourceForecast[];
    private recommendations: Map<string, OptimizationRecommendation>;
    private readonly config: PredictionConfig;
    private accuracyHistory: Map<string, number[]>;
    private forecastInterval?: NodeJS.Timeout;

    constructor(config: Partial<PredictionConfig> = {}) {
        super();
        this.predictions = new Map();
        this.forecasts = [];
        this.recommendations = new Map();
        this.accuracyHistory = new Map();
        this.config = {
            predictionWindow: config.predictionWindow || 60000,    // 1 minute
            minConfidence: config.minConfidence || 0.6,           // 60% confidence
            forecastInterval: config.forecastInterval || 5000,    // 5 seconds
            maxPredictions: config.maxPredictions || 1000,        // 1000 predictions
            learningRate: config.learningRate || 0.1              // 10% learning rate
        };
    }

    /**
     * Start prediction engine
     */
    public start(): void {
        this.startForecasting();
    }

    /**
     * Stop prediction engine
     */
    public stop(): void {
        this.stopForecasting();
    }

    /**
     * Start forecasting
     */
    public startForecasting(): void {
        if (this.forecastInterval) {
            clearInterval(this.forecastInterval);
        }
        this.forecastInterval = setInterval(() => this.updateForecasts(), this.config.forecastInterval);
    }

    /**
     * Stop forecasting
     */
    public stopForecasting(): void {
        if (this.forecastInterval) {
            clearInterval(this.forecastInterval);
            this.forecastInterval = undefined;
        }
    }

    /**
     * Generate access predictions based on patterns
     */
    public predictAccess(patterns: AccessPattern[]): AccessPrediction[] {
        const now = new Date();
        const predictions: AccessPrediction[] = [];

        patterns.forEach(pattern => {
            if (pattern.confidence < this.config.minConfidence) return;

            // Calculate prediction probability based on pattern strength and history
            const accuracy = this.getHistoricalAccuracy(pattern.id);
            const probability = pattern.strength * (accuracy ?? 1.0);

            if (probability < this.config.minConfidence) return;

            // Generate predictions for temporal patterns
            if (pattern.type === 'temporal' && pattern.metadata.temporalGap) {
                const nextAccess = new Date(now.getTime() + pattern.metadata.temporalGap);
                
                pattern.keys.forEach(key => {
                    const prediction: AccessPrediction = {
                        key,
                        probability,
                        confidence: this.getConfidenceLevel(probability),
                        expectedTimestamp: nextAccess,
                        metadata: {
                            patternId: pattern.id,
                            memoryImpact: pattern.metadata.memoryImpact
                        }
                    };
                    predictions.push(prediction);
                    this.predictions.set(`${key}:${nextAccess.getTime()}`, prediction);
                });
            }

            // Generate predictions for spatial patterns
            if (pattern.type === 'spatial') {
                pattern.keys.forEach(key => {
                    const prediction: AccessPrediction = {
                        key,
                        probability: probability * 0.8, // Slightly lower confidence for spatial
                        confidence: this.getConfidenceLevel(probability * 0.8),
                        expectedTimestamp: new Date(now.getTime() + 1000), // Near-term prediction
                        metadata: {
                            patternId: pattern.id,
                            memoryImpact: pattern.metadata.memoryImpact
                        }
                    };
                    predictions.push(prediction);
                    this.predictions.set(`${key}:${now.getTime()}`, prediction);
                });
            }
        });

        this.trimPredictions();
        return predictions;
    }

    /**
     * Generate resource demand forecast
     */
    private updateForecasts(): void {
        const now = new Date();
        const forecast: ResourceForecast = {
            timestamp: now,
            memoryUsage: this.calculateResourceMetrics('memory'),
            cpuLoad: this.calculateResourceMetrics('cpu'),
            cacheSize: this.calculateResourceMetrics('cache')
        };

        this.forecasts.push(forecast);
        this.emit('forecastUpdated', forecast);

        // Trim old forecasts
        const cutoff = new Date(now.getTime() - this.config.predictionWindow);
        this.forecasts = this.forecasts.filter(f => f.timestamp >= cutoff);
    }

    /**
     * Generate optimization recommendations
     */
    private generateRecommendations(): void {
        const predictions = Array.from(this.predictions.values());
        const forecast = this.forecasts[this.forecasts.length - 1];

        if (!forecast) return;

        // Analyze memory pressure
        if (forecast.memoryUsage.expected > forecast.memoryUsage.upperBound) {
            this.addRecommendation({
                type: 'evict',
                priority: 1,
                confidence: PredictionConfidence.HIGH,
                impact: {
                    memory: -20,
                    performance: -5,
                    reliability: 0
                },
                description: 'High memory pressure detected',
                suggestedAction: 'Evict least likely to be accessed items',
                metadata: {
                    patterns: [],
                    predictions: predictions.map(p => p.key),
                    resourceImpact: forecast
                }
            });
        }

        // Analyze cache efficiency
        const highProbabilityAccesses = predictions.filter(p => p.probability > 0.8);
        if (highProbabilityAccesses.length > 0) {
            this.addRecommendation({
                type: 'preload',
                priority: 2,
                confidence: PredictionConfidence.MEDIUM,
                impact: {
                    memory: 10,
                    performance: 15,
                    reliability: 5
                },
                description: 'High probability access patterns detected',
                suggestedAction: 'Preload likely to be accessed items',
                metadata: {
                    patterns: highProbabilityAccesses.map(p => p.metadata.patternId),
                    predictions: highProbabilityAccesses.map(p => p.key),
                    resourceImpact: forecast
                }
            });
        }

        // Analyze cache size
        if (forecast.cacheSize.expected < forecast.cacheSize.lowerBound) {
            this.addRecommendation({
                type: 'resize',
                priority: 3,
                confidence: PredictionConfidence.MEDIUM,
                impact: {
                    memory: 15,
                    performance: 10,
                    reliability: 0
                },
                description: 'Cache size below optimal threshold',
                suggestedAction: 'Increase cache size by 20%',
                metadata: {
                    patterns: [],
                    predictions: [],
                    resourceImpact: forecast
                }
            });
        }
    }

    /**
     * Validate predictions against actual access
     */
    public validatePrediction(key: string): void {
        const now = new Date();
        const recentPredictions = Array.from(this.predictions.values())
            .filter(p => p.key === key && 
                    Math.abs(p.expectedTimestamp.getTime() - now.getTime()) < 5000);

        recentPredictions.forEach(prediction => {
            const accuracy = prediction.probability;
            const history = this.accuracyHistory.get(prediction.metadata.patternId) || [];
            history.push(accuracy);
            this.accuracyHistory.set(prediction.metadata.patternId, history.slice(-100));

            prediction.metadata.accuracy = accuracy;
            this.emit('predictionValidated', prediction);
        });
    }

    /**
     * Get historical accuracy for a pattern
     */
    private getHistoricalAccuracy(patternId: string): number {
        const history = this.accuracyHistory.get(patternId);
        if (!history || history.length === 0) return 1.0;
        return history.reduce((a, b) => a + b, 0) / history.length;
    }

    /**
     * Calculate resource metrics for forecasting
     */
    private calculateResourceMetrics(type: 'memory' | 'cpu' | 'cache'): {
        expected: number;
        upperBound: number;
        lowerBound: number;
    } {
        const predictions = Array.from(this.predictions.values());
        const impacts = predictions.map(p => p.metadata.memoryImpact * p.probability);
        const total = impacts.reduce((a, b) => a + b, 0);
        const variance = impacts.reduce((a, b) => a + Math.pow(b - total/impacts.length, 2), 0) / impacts.length;
        const stdDev = Math.sqrt(variance);

        return {
            expected: total,
            upperBound: total + stdDev * 2,
            lowerBound: total - stdDev * 2
        };
    }

    /**
     * Add or update recommendation
     */
    private addRecommendation(recommendation: OptimizationRecommendation): void {
        const id = `${recommendation.type}:${recommendation.priority}`;
        this.recommendations.set(id, recommendation);
        this.emit('recommendationGenerated', recommendation);
    }

    /**
     * Get confidence level based on probability
     */
    private getConfidenceLevel(probability: number): PredictionConfidence {
        if (probability > 0.8) return PredictionConfidence.HIGH;
        if (probability > 0.5) return PredictionConfidence.MEDIUM;
        return PredictionConfidence.LOW;
    }

    /**
     * Trim old predictions
     */
    private trimPredictions(): void {
        const now = new Date();
        const cutoff = new Date(now.getTime() - this.config.predictionWindow);

        // Remove old predictions
        for (const [key, prediction] of this.predictions.entries()) {
            if (prediction.expectedTimestamp < cutoff) {
                this.predictions.delete(key);
            }
        }

        // Limit total number of predictions
        if (this.predictions.size > this.config.maxPredictions) {
            const sorted = Array.from(this.predictions.entries())
                .sort(([, a], [, b]) => b.probability - a.probability);
            this.predictions = new Map(sorted.slice(0, this.config.maxPredictions));
        }
    }

    /**
     * Get current predictions
     */
    public getPredictions(): AccessPrediction[] {
        return Array.from(this.predictions.values());
    }

    /**
     * Get current recommendations
     */
    public getRecommendations(): OptimizationRecommendation[] {
        return Array.from(this.recommendations.values())
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get resource forecasts
     */
    public getForecasts(): ResourceForecast[] {
        return this.forecasts;
    }
}
