import { EventEmitter } from 'events';
import { MemoryUsage } from '../types';

/**
 * Represents a detected access pattern with temporal and spatial characteristics
 */
export interface AccessPattern {
    id: string;
    type: 'temporal' | 'spatial' | 'hybrid';
    confidence: number;
    strength: number;
    firstSeen: Date;
    lastSeen: Date;
    frequency: number;
    keys: Set<string>;
    metadata: {
        temporalGap?: number;      // Average time between accesses
        spatialDistance?: number;  // Average key space distance
        memoryImpact: number;     // Memory footprint
        hitRatio: number;         // Cache hit ratio for this pattern
    };
}

/**
 * Configuration for the pattern detection system
 */
export interface PatternDetectionConfig {
    temporalWindowSize: number;     // Time window for temporal analysis (ms)
    spatialWindowSize: number;      // Number of keys to consider for spatial analysis
    minConfidence: number;          // Minimum confidence threshold (0-1)
    minStrength: number;           // Minimum pattern strength threshold (0-1)
    samplingRate: number;          // Rate of pattern analysis (Hz)
    decayFactor: number;           // Rate at which pattern strength decays
}

/**
 * Advanced pattern detection system for cache access analysis
 */
export class PatternDetector extends EventEmitter {
    private patterns: Map<string, AccessPattern>;
    private accessHistory: Array<{ key: string; timestamp: Date; memoryImpact: number }>;
    private readonly config: PatternDetectionConfig;
    private analysisInterval: NodeJS.Timer | null;

    constructor(config: Partial<PatternDetectionConfig> = {}) {
        super();
        this.patterns = new Map();
        this.accessHistory = [];
        this.config = {
            temporalWindowSize: config.temporalWindowSize || 5000,    // 5 seconds
            spatialWindowSize: config.spatialWindowSize || 100,       // 100 keys
            minConfidence: config.minConfidence || 0.7,              // 70% confidence
            minStrength: config.minStrength || 0.5,                  // 50% strength
            samplingRate: config.samplingRate || 10,                 // 10Hz
            decayFactor: config.decayFactor || 0.95                  // 5% decay per period
        };
        this.analysisInterval = null;
    }

    /**
     * Start pattern detection
     */
    public start(): void {
        if (this.analysisInterval) return;
        
        const interval = 1000 / this.config.samplingRate;
        this.analysisInterval = setInterval(() => {
            this.analyzePatterns();
        }, interval);
    }

    /**
     * Stop pattern detection
     */
    public stop(): void {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    /**
     * Record a cache access for pattern analysis
     */
    public recordAccess(key: string, memoryImpact: number): void {
        const access = {
            key,
            timestamp: new Date(),
            memoryImpact
        };

        this.accessHistory.push(access);
        this.trimHistory();
        this.updatePatterns(access);
    }

    /**
     * Analyze temporal locality in the access history
     */
    private detectTemporalPatterns(): void {
        const now = new Date();
        const windowStart = new Date(now.getTime() - this.config.temporalWindowSize);
        
        const recentAccesses = this.accessHistory.filter(access => 
            access.timestamp >= windowStart
        );

        // Group by key and analyze access patterns
        const keyGroups = new Map<string, typeof recentAccesses>();
        recentAccesses.forEach(access => {
            const group = keyGroups.get(access.key) || [];
            group.push(access);
            keyGroups.set(access.key, group);
        });

        keyGroups.forEach((accesses, key) => {
            if (accesses.length < 2) return;

            // Calculate temporal metrics
            const gaps = [];
            for (let i = 1; i < accesses.length; i++) {
                gaps.push(accesses[i].timestamp.getTime() - accesses[i-1].timestamp.getTime());
            }

            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const stdDev = Math.sqrt(
                gaps.reduce((acc, gap) => acc + Math.pow(gap - avgGap, 2), 0) / gaps.length
            );

            // Calculate pattern strength based on consistency
            const strength = 1 / (1 + (stdDev / avgGap));
            const confidence = Math.min(1, accesses.length / 10); // Increases with more observations

            if (strength >= this.config.minStrength && confidence >= this.config.minConfidence) {
                this.updatePattern({
                    id: `temporal:${key}`,
                    type: 'temporal',
                    confidence,
                    strength,
                    firstSeen: accesses[0].timestamp,
                    lastSeen: accesses[accesses.length - 1].timestamp,
                    frequency: accesses.length,
                    keys: new Set([key]),
                    metadata: {
                        temporalGap: avgGap,
                        memoryImpact: accesses[0].memoryImpact,
                        hitRatio: 0 // To be updated with actual hit ratio
                    }
                });
            }
        });
    }

    /**
     * Analyze spatial locality in the access history
     */
    private detectSpatialPatterns(): void {
        const recentAccesses = this.accessHistory.slice(-this.config.spatialWindowSize);
        if (recentAccesses.length < 2) return;

        // Build access matrix for spatial analysis
        const keyPairs = new Map<string, number>();
        
        for (let i = 0; i < recentAccesses.length - 1; i++) {
            for (let j = i + 1; j < Math.min(i + 10, recentAccesses.length); j++) {
                const pair = `${recentAccesses[i].key}:${recentAccesses[j].key}`;
                keyPairs.set(pair, (keyPairs.get(pair) || 0) + 1);
            }
        }

        // Analyze key relationships
        keyPairs.forEach((frequency, pairKey) => {
            const [key1, key2] = pairKey.split(':');
            const strength = frequency / (recentAccesses.length / 2);
            const confidence = Math.min(1, frequency / 5);

            if (strength >= this.config.minStrength && confidence >= this.config.minConfidence) {
                this.updatePattern({
                    id: `spatial:${pairKey}`,
                    type: 'spatial',
                    confidence,
                    strength,
                    firstSeen: recentAccesses[0].timestamp,
                    lastSeen: recentAccesses[recentAccesses.length - 1].timestamp,
                    frequency,
                    keys: new Set([key1, key2]),
                    metadata: {
                        spatialDistance: 1, // Simple distance metric
                        memoryImpact: recentAccesses.reduce((sum, access) => 
                            sum + access.memoryImpact, 0) / recentAccesses.length,
                        hitRatio: 0 // To be updated with actual hit ratio
                    }
                });
            }
        });
    }

    /**
     * Update or create a pattern
     */
    private updatePattern(pattern: AccessPattern): void {
        const existing = this.patterns.get(pattern.id);
        if (existing) {
            // Update existing pattern
            existing.confidence = Math.max(existing.confidence, pattern.confidence);
            existing.strength = (existing.strength + pattern.strength) / 2;
            existing.lastSeen = pattern.lastSeen;
            existing.frequency += pattern.frequency;
            pattern.keys.forEach(key => existing.keys.add(key));
            existing.metadata = { ...existing.metadata, ...pattern.metadata };
            this.emit('patternUpdated', existing);
        } else {
            // Create new pattern
            this.patterns.set(pattern.id, pattern);
            this.emit('patternDetected', pattern);
        }
    }

    /**
     * Analyze all patterns
     */
    private analyzePatterns(): void {
        this.detectTemporalPatterns();
        this.detectSpatialPatterns();
        this.decayPatterns();
        this.cleanupPatterns();
    }

    /**
     * Apply decay to pattern strengths
     */
    private decayPatterns(): void {
        this.patterns.forEach(pattern => {
            pattern.strength *= this.config.decayFactor;
            if (pattern.strength < this.config.minStrength) {
                this.emit('patternDecayed', pattern);
            }
        });
    }

    /**
     * Remove weak or outdated patterns
     */
    private cleanupPatterns(): void {
        const now = new Date();
        this.patterns.forEach((pattern, id) => {
            const age = now.getTime() - pattern.lastSeen.getTime();
            if (pattern.strength < this.config.minStrength || 
                age > this.config.temporalWindowSize * 2) {
                this.patterns.delete(id);
                this.emit('patternExpired', pattern);
            }
        });
    }

    /**
     * Trim access history to window size
     */
    private trimHistory(): void {
        const now = new Date();
        const cutoff = new Date(now.getTime() - this.config.temporalWindowSize);
        this.accessHistory = this.accessHistory.filter(access => 
            access.timestamp >= cutoff
        );
    }

    /**
     * Get all current patterns
     */
    public getPatterns(): AccessPattern[] {
        return Array.from(this.patterns.values());
    }

    /**
     * Get patterns for a specific key
     */
    public getPatternsForKey(key: string): AccessPattern[] {
        return this.getPatterns().filter(pattern => 
            pattern.keys.has(key)
        );
    }

    /**
     * Update hit ratio for patterns
     */
    public updateHitRatio(key: string, hitRatio: number): void {
        this.getPatternsForKey(key).forEach(pattern => {
            pattern.metadata.hitRatio = hitRatio;
        });
    }
}
