import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
    executionTime: number;
    memoryUsage: {
        initial: number;
        final: number;
        peak: number;
        allocations: number[];
        collections: number;
    };
    cpu: {
        usage: number;
        kernelTime: number;
        userTime: number;
    };
    io: {
        reads: number;
        writes: number;
        bytesRead: number;
        bytesWritten: number;
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
        memoryAllocations: number[];
        gcCollections: number;
        cpuUsageStart: {
            user: number;
            system: number;
        };
        cpuUsageEnd?: {
            user: number;
            system: number;
        };
        ioCountersStart: {
            reads: number;
            writes: number;
            bytesRead: number;
            bytesWritten: number;
        };
        ioCountersEnd?: {
            reads: number;
            writes: number;
            bytesRead: number;
            bytesWritten: number;
        };
        trajectoryPoints: number;
        batchSize: number;
        stepSize: number;
        cacheHits: number;
        cacheMisses: number;
    }> = new Map();

    private resourceUsage: {
        timestamp: number;
        cpu: number;
        memory: number;
        io: {
            reads: number;
            writes: number;
        };
    }[] = [];

    private cacheHits: number = 0;
    private cacheMisses: number = 0;

    private constructor() {
        this.startResourceMonitoring();
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    private startResourceMonitoring() {
        setInterval(() => {
            const usage = process.cpuUsage();
            const memory = process.memoryUsage();
            const timestamp = Date.now();

            this.resourceUsage.push({
                timestamp,
                cpu: (usage.user + usage.system) / 1000000, // Convert to seconds
                memory: memory.heapUsed,
                io: {
                    reads: process.resourceUsage().fsRead,
                    writes: process.resourceUsage().fsWrite
                }
            });

            // Keep only last hour of data
            const oneHourAgo = timestamp - 3600000;
            this.resourceUsage = this.resourceUsage.filter(u => u.timestamp > oneHourAgo);
        }, 1000); // Sample every second
    }

    public getResourceUsage(start: number, end: number = Date.now()): typeof this.resourceUsage {
        return this.resourceUsage.filter(u => u.timestamp >= start && u.timestamp <= end);
    }

    public startOperation(operationId: string): void {
        const cpuUsage = process.cpuUsage();
        const resourceUsage = process.resourceUsage();
        
        this.operationMetrics.set(operationId, {
            startTime: Date.now(),
            memoryStart: process.memoryUsage().heapUsed,
            memoryPeak: process.memoryUsage().heapUsed,
            memoryAllocations: [],
            gcCollections: 0,
            cpuUsageStart: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            ioCountersStart: {
                reads: resourceUsage.fsRead,
                writes: resourceUsage.fsWrite,
                bytesRead: resourceUsage.fsRead,
                bytesWritten: resourceUsage.fsWrite
            },
            trajectoryPoints: 0,
            batchSize: 0,
            stepSize: 0,
            cacheHits: 0,
            cacheMisses: 0
        });
    }

    public endOperation(operationId: string): PerformanceMetrics | null {
        const metrics = this.operationMetrics.get(operationId);
        if (!metrics) return null;

        const cpuUsage = process.cpuUsage();
        const resourceUsage = process.resourceUsage();
        const memoryUsage = process.memoryUsage();

        metrics.endTime = Date.now();
        metrics.memoryEnd = memoryUsage.heapUsed;
        metrics.cpuUsageEnd = {
            user: cpuUsage.user,
            system: cpuUsage.system
        };
        metrics.ioCountersEnd = {
            reads: resourceUsage.fsRead,
            writes: resourceUsage.fsWrite,
            bytesRead: resourceUsage.fsRead,
            bytesWritten: resourceUsage.fsWrite
        };

        const result: PerformanceMetrics = {
            executionTime: metrics.endTime - metrics.startTime,
            memoryUsage: {
                initial: metrics.memoryStart,
                final: metrics.memoryEnd,
                peak: metrics.memoryPeak,
                allocations: metrics.memoryAllocations,
                collections: metrics.gcCollections
            },
            cpu: {
                usage: ((metrics.cpuUsageEnd.user + metrics.cpuUsageEnd.system) -
                       (metrics.cpuUsageStart.user + metrics.cpuUsageStart.system)) / 1000000,
                kernelTime: (metrics.cpuUsageEnd.system - metrics.cpuUsageStart.system) / 1000000,
                userTime: (metrics.cpuUsageEnd.user - metrics.cpuUsageStart.user) / 1000000
            },
            io: {
                reads: metrics.ioCountersEnd.reads - metrics.ioCountersStart.reads,
                writes: metrics.ioCountersEnd.writes - metrics.ioCountersStart.writes,
                bytesRead: metrics.ioCountersEnd.bytesRead - metrics.ioCountersStart.bytesRead,
                bytesWritten: metrics.ioCountersEnd.bytesWritten - metrics.ioCountersStart.bytesWritten
            },
            trajectoryPoints: metrics.trajectoryPoints,
            batchSize: metrics.batchSize,
            averageStepSize: metrics.stepSize,
            cacheHits: metrics.cacheHits,
            cacheMisses: metrics.cacheMisses
        };

        this.operationMetrics.delete(operationId);
        return result;
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

    public clearMetrics(): void {
        this.operationMetrics.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
}
