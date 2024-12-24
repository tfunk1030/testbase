import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
    executionTime: number;
    memoryUsage: {
        initial: number;
        final: number;
        peak: number;
    };
    trajectoryPoints: number;
    batchSize: number;
    averageStepSize: number;
    cacheHits: number;
    cacheMisses: number;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private operationMetrics: Map<string, {
        startTime: number;
        endTime?: number;
        memoryStart: number;
        memoryEnd?: number;
        memoryPeak: number;
        trajectoryPoints: number;
        batchSize: number;
        stepSize: number;
        cacheHits: number;
        cacheMisses: number;
    }> = new Map();

    private cacheHits: number = 0;
    private cacheMisses: number = 0;

    private constructor() {}

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    public startOperation(operationId: string): void {
        this.operationMetrics.set(operationId, {
            startTime: Date.now(),
            memoryStart: process.memoryUsage().heapUsed,
            memoryPeak: process.memoryUsage().heapUsed,
            trajectoryPoints: 0,
            batchSize: 0,
            stepSize: 0,
            cacheHits: 0,
            cacheMisses: 0
        });
    }

    public endOperation(
        operationId: string,
        trajectoryPoints: number,
        batchSize: number,
        stepSize: number
    ): void {
        const metrics = this.operationMetrics.get(operationId);
        if (!metrics) return;

        const currentMemory = process.memoryUsage().heapUsed;
        metrics.endTime = Date.now();
        metrics.memoryEnd = currentMemory;
        metrics.memoryPeak = Math.max(metrics.memoryPeak, currentMemory);
        metrics.trajectoryPoints = trajectoryPoints;
        metrics.batchSize = batchSize;
        metrics.stepSize = stepSize;
        metrics.cacheHits = this.cacheHits;
        metrics.cacheMisses = this.cacheMisses;
    }

    public recordCacheHit(operationId: string): void {
        this.cacheHits++;
        const metrics = this.operationMetrics.get(operationId);
        if (metrics) {
            metrics.cacheHits++;
        }
    }

    public recordCacheMiss(operationId: string): void {
        this.cacheMisses++;
        const metrics = this.operationMetrics.get(operationId);
        if (metrics) {
            metrics.cacheMisses++;
        }
    }

    public getCacheHits(): number {
        return this.cacheHits;
    }

    public getCacheMisses(): number {
        return this.cacheMisses;
    }

    public getMetrics(operationId: string): PerformanceMetrics | null {
        const metrics = this.operationMetrics.get(operationId);
        if (!metrics || !metrics.endTime || !metrics.memoryEnd) return null;

        return {
            executionTime: metrics.endTime - metrics.startTime,
            memoryUsage: {
                initial: metrics.memoryStart,
                final: metrics.memoryEnd,
                peak: metrics.memoryPeak
            },
            trajectoryPoints: metrics.trajectoryPoints,
            batchSize: metrics.batchSize,
            averageStepSize: metrics.stepSize,
            cacheHits: metrics.cacheHits,
            cacheMisses: metrics.cacheMisses
        };
    }

    public clearMetrics(): void {
        this.operationMetrics.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
}
