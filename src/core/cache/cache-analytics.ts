import { EventEmitter } from 'events';
import { CacheRecommendation, MemorySnapshot, ResourceUsage } from './types';

export class CacheAnalytics extends EventEmitter {
    private memorySnapshots: MemorySnapshot[] = [];
    private accessEvents: { key: string; hit: boolean; size: number; time: number }[] = [];
    private readonly maxEvents: number;
    private readonly maxSnapshots: number;

    constructor(maxEvents: number = 1000, maxSnapshots: number = 100) {
        super();
        this.maxEvents = maxEvents;
        this.maxSnapshots = maxSnapshots;
    }

    public recordMemoryUsage(snapshot: Omit<MemorySnapshot, 'timestamp'>): void {
        const fullSnapshot: MemorySnapshot = {
            ...snapshot,
            timestamp: Date.now()
        };

        this.memorySnapshots.push(fullSnapshot);
        if (this.memorySnapshots.length > this.maxSnapshots) {
            this.memorySnapshots.shift();
        }

        this.emit('memory', fullSnapshot);
    }

    public recordAccess(key: string, hit: boolean, size: number, time: number): void {
        const event = { key, hit, size, time };
        this.accessEvents.push(event);
        
        if (this.accessEvents.length > this.maxEvents) {
            this.accessEvents.shift();
        }

        this.emit('access', event);
    }

    public getRecommendations(): CacheRecommendation[] {
        const recommendations: CacheRecommendation[] = [];
        
        // Analyze memory pressure
        const memoryPressure = this.analyzeMemoryPressure();
        if (memoryPressure > 0.8) {
            recommendations.push({
                type: 'evict',
                reason: 'High memory pressure detected',
                priority: Math.round(memoryPressure * 10),
                impact: {
                    memory: -Math.round(memoryPressure * 100),
                    performance: -10
                }
            });
        }

        // Analyze access patterns
        const { hotKeys, coldKeys } = this.analyzeAccessPatterns();
        
        if (hotKeys.length > 0) {
            recommendations.push({
                type: 'preload',
                keys: hotKeys,
                reason: 'Frequently accessed items',
                priority: 8,
                impact: {
                    memory: 20,
                    performance: 30
                }
            });
        }

        if (coldKeys.length > 0) {
            recommendations.push({
                type: 'evict',
                keys: coldKeys,
                reason: 'Rarely accessed items',
                priority: 5,
                impact: {
                    memory: -30,
                    performance: -5
                }
            });
        }

        // Analyze cache size
        const sizeRecommendation = this.analyzeCacheSize();
        if (sizeRecommendation) {
            recommendations.push(sizeRecommendation);
        }

        return recommendations.sort((a, b) => b.priority - a.priority);
    }

    private analyzeMemoryPressure(): number {
        if (this.memorySnapshots.length === 0) return 0;

        const recent = this.memorySnapshots.slice(-5);
        const avgUsed = recent.reduce((sum, snap) => sum + snap.used / snap.total, 0) / recent.length;
        const avgHeap = recent.reduce((sum, snap) => sum + snap.heapUsage / snap.total, 0) / recent.length;
        
        return Math.max(avgUsed, avgHeap);
    }

    private analyzeAccessPatterns(): { hotKeys: string[]; coldKeys: string[] } {
        const keyStats = new Map<string, { hits: number; lastAccess: number }>();
        
        this.accessEvents.forEach(event => {
            const stats = keyStats.get(event.key) || { hits: 0, lastAccess: 0 };
            stats.hits += event.hit ? 1 : 0;
            stats.lastAccess = Math.max(stats.lastAccess, event.time);
            keyStats.set(event.key, stats);
        });

        const now = Date.now();
        const hotKeys: string[] = [];
        const coldKeys: string[] = [];

        keyStats.forEach((stats, key) => {
            const age = now - stats.lastAccess;
            const hitRate = stats.hits / this.accessEvents.filter(e => e.key === key).length;

            if (hitRate > 0.8 && age < 300000) { // 5 minutes
                hotKeys.push(key);
            } else if (hitRate < 0.2 && age > 3600000) { // 1 hour
                coldKeys.push(key);
            }
        });

        return { hotKeys, coldKeys };
    }

    private analyzeCacheSize(): CacheRecommendation | null {
        if (this.memorySnapshots.length < 2) return null;

        const memoryTrend = this.memorySnapshots.slice(-10);
        const growthRate = (memoryTrend[memoryTrend.length - 1].used - memoryTrend[0].used) / 
                          (memoryTrend[memoryTrend.length - 1].timestamp - memoryTrend[0].timestamp);

        if (growthRate > 0.1) { // More than 10% growth rate
            return {
                type: 'resize',
                reason: 'Rapid memory growth detected',
                priority: 7,
                impact: {
                    memory: -20,
                    performance: -10
                }
            };
        }

        return null;
    }
}
