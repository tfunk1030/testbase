import { PerformanceMonitor } from './performance-monitor';
import { CacheAnalytics } from './cache-analytics';
import { EventEmitter } from 'events';
import * as os from 'os';

// System metrics interface
export interface SystemMetrics {
    timestamp: number;
    cpu: {
        usage: number;
        temperature?: number;
        loadAverage: number[];
        threadCount: number;
        processUptime: number;
    };
    memory: {
        total: number;
        used: number;
        free: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
        gc: {
            collections: number;
            pauseTime: number;
            type: string;
        }[];
    };
    io: {
        reads: number;
        writes: number;
        throughput: number;
    };
}

interface PerformanceSnapshot {
    timestamp: number;
    system: SystemMetrics;
    application: {
        activeOperations: number;
        completedOperations: number;
        averageResponseTime: number;
        errorRate: number;
        throughput: number;
        bottlenecks?: {
            slowOperations: string[];
            resourceHogs: string[];
            errorHotspots: string[];
        };
    };
    cache: {
        hitRate: number;
        memoryUsage: number;
        entryCount: number;
        evictionRate: number;
        bottlenecks?: {
            highEvictionAreas: string[];
            memoryPressure: boolean;
            fragmentedRegions: string[];
        };
    };
}

interface BottleneckIndicator {
    type: 'cpu' | 'memory' | 'gc' | 'threadPool' | 'application' | 'cache';
    severity: 'low' | 'medium' | 'high';
    metric: string;
    value: number;
    threshold: number;
    timestamp: number;
    context: any;
}

interface MemoryUsage {
    total: number;
    used: number;
    free: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    gc: {
        collections: number;
        pauseTime: number;
        type: string;
    }[];
}

interface ResourceMetrics {
    cpu: {
        usage: number;
        kernelTime: number;
        userTime: number;
    };
    memory: MemoryUsage;
    io: {
        reads: number;
        writes: number;
        bytesRead: number;
        bytesWritten: number;
    };
}

export class RealTimeMonitor extends EventEmitter {
    private static instance: RealTimeMonitor;
    private readonly monitor: PerformanceMonitor;
    private readonly cache: CacheAnalytics;
    private readonly snapshots: PerformanceSnapshot[] = [];
    private readonly snapshotInterval: number = 1000; // 1 second
    private readonly maxSnapshots: number = 3600; // 1 hour of data
    private lastGCStats = {
        collections: 0,
        totalPauseTime: 0,
        timestamp: Date.now()
    };
    private operationStats = {
        active: 0,
        completed: 0,
        errors: 0,
        totalResponseTime: 0
    };
    private bottlenecks: BottleneckIndicator[] = [];
    private readonly thresholds = {
        cpu: {
            usage: 80,
            temperature: 80,
            loadAverage: 0.8
        },
        memory: {
            usage: 85,
            fragmentation: 50,
            swapUsage: 20
        },
        gc: {
            pauseTime: 100,
            frequency: 10
        },
        threadPool: {
            queueSaturation: 0.8,
            taskDuration: 1000
        }
    };

    public constructor() {
        super();
        this.monitor = PerformanceMonitor.getInstance();
        this.cache = CacheAnalytics.getInstance();
        this.startMonitoring();
    }

    public static getInstance(): RealTimeMonitor {
        if (!RealTimeMonitor.instance) {
            RealTimeMonitor.instance = new RealTimeMonitor();
        }
        return RealTimeMonitor.instance;
    }

    private startMonitoring(): void {
        setInterval(() => {
            this.collectSnapshot();
        }, this.snapshotInterval);
    }

    private async collectSnapshot(): Promise<void> {
        const snapshot = await this.createSnapshot();
        this.snapshots.push(snapshot);

        // Keep only the last hour of data
        while (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        this.emit('snapshot', snapshot);

        // Emit alerts if necessary
        this.checkAlerts(snapshot);

        // Detect bottlenecks
        this.detectBottlenecks(snapshot);
    }

    private async createSnapshot(): Promise<PerformanceSnapshot> {
        const cpuUsage = await this.getCPUUsage();
        const memInfo = this.getMemoryInfo();
        const gcStats = this.getGCStats();
        const threadStats = this.getThreadPoolStats();
        const cacheStats = this.cache.getAnalytics();

        // Calculate application metrics
        const now = Date.now();
        const recentSnapshots = this.snapshots.filter(s => 
            now - s.timestamp < 60000 // Last minute
        );
        const throughput = recentSnapshots.length > 0 ?
            recentSnapshots.reduce((sum, s) => sum + s.application.completedOperations, 0) / 60 :
            0;

        return {
            timestamp: now,
            system: {
                cpu: {
                    usage: cpuUsage,
                    loadAverage: os.loadavg(),
                    temperature: await this.getCPUTemperature()
                },
                memory: memInfo,
                gc: gcStats,
                threadPool: threadStats
            },
            application: {
                activeOperations: this.operationStats.active,
                completedOperations: this.operationStats.completed,
                averageResponseTime: this.operationStats.completed > 0 ?
                    this.operationStats.totalResponseTime / this.operationStats.completed :
                    0,
                errorRate: this.operationStats.completed > 0 ?
                    this.operationStats.errors / this.operationStats.completed :
                    0,
                throughput
            },
            cache: {
                hitRate: cacheStats.overallStats.hitRate,
                memoryUsage: cacheStats.memoryStats.currentUsage,
                entryCount: cacheStats.overallStats.entryCount,
                evictionRate: cacheStats.performanceStats.evictionRate
            }
        };
    }

    private async getCPUUsage(): Promise<number> {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
                resolve(totalUsage * 100); // Convert to percentage
            }, 100);
        });
    }

    private async getCPUTemperature(): Promise<number | undefined> {
        // This is platform-specific and may not be available
        try {
            // On Windows, you might need to use external tools or WMI
            return undefined;
        } catch {
            return undefined;
        }
    }

    private getMemoryInfo(): {
        total: number;
        used: number;
        free: number;
        processUsage: number;
    } {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const processUsage = process.memoryUsage();

        return {
            total: totalMem,
            used: totalMem - freeMem,
            free: freeMem,
            processUsage: processUsage.heapUsed + processUsage.external
        };
    }

    private getGCStats(): {
        collections: number;
        totalPauseTime: number;
        averagePauseTime: number;
    } {
        // Note: This requires --expose-gc flag
        const collections = this.lastGCStats.collections;
        const totalPauseTime = this.lastGCStats.totalPauseTime;

        return {
            collections,
            totalPauseTime,
            averagePauseTime: collections > 0 ? totalPauseTime / collections : 0
        };
    }

    private getThreadPoolStats(): {
        activeThreads: number;
        queueLength: number;
        completedTasks: number;
    } {
        // This would need to be integrated with your actual thread pool implementation
        return {
            activeThreads: 0,
            queueLength: 0,
            completedTasks: 0
        };
    }

    private checkAlerts(snapshot: PerformanceSnapshot): void {
        // CPU alerts
        if (snapshot.system.cpu.usage > 80) {
            this.emit('alert', {
                type: 'cpu',
                level: 'warning',
                message: `High CPU usage: ${snapshot.system.cpu.usage.toFixed(1)}%`
            });
        }

        // Memory alerts
        const memoryUsagePercent = (snapshot.system.memory.used / snapshot.system.memory.total) * 100;
        if (memoryUsagePercent > 90) {
            this.emit('alert', {
                type: 'memory',
                level: 'warning',
                message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`
            });
        }

        // Cache alerts
        if (snapshot.cache.hitRate < 0.5) {
            this.emit('alert', {
                type: 'cache',
                level: 'warning',
                message: `Low cache hit rate: ${(snapshot.cache.hitRate * 100).toFixed(1)}%`
            });
        }

        // Performance alerts
        if (snapshot.application.errorRate > 0.05) {
            this.emit('alert', {
                type: 'error',
                level: 'error',
                message: `High error rate: ${(snapshot.application.errorRate * 100).toFixed(1)}%`
            });
        }
    }

    private detectBottlenecks(snapshot: PerformanceSnapshot): BottleneckIndicator[] {
        const indicators: BottleneckIndicator[] = [];
        const timestamp = Date.now();

        // CPU bottlenecks
        if (snapshot.system.cpu.usage > this.thresholds.cpu.usage) {
            indicators.push({
                type: 'cpu',
                severity: 'high',
                metric: 'usage',
                value: snapshot.system.cpu.usage,
                threshold: this.thresholds.cpu.usage,
                timestamp,
                context: {
                    loadAverage: snapshot.system.cpu.loadAverage,
                    temperature: snapshot.system.cpu.temperature
                }
            });
        }

        // Memory bottlenecks
        const memoryUsagePercent = (snapshot.system.memory.used / snapshot.system.memory.total) * 100;
        if (memoryUsagePercent > this.thresholds.memory.usage) {
            indicators.push({
                type: 'memory',
                severity: memoryUsagePercent > 95 ? 'high' : 'medium',
                metric: 'usage',
                value: memoryUsagePercent,
                threshold: this.thresholds.memory.usage,
                timestamp,
                context: {
                    free: snapshot.system.memory.free,
                    processUsage: snapshot.system.memory.processUsage
                }
            });
        }

        // GC bottlenecks
        if (snapshot.system.gc.averagePauseTime > this.thresholds.gc.pauseTime) {
            indicators.push({
                type: 'gc',
                severity: 'medium',
                metric: 'pauseTime',
                value: snapshot.system.gc.averagePauseTime,
                threshold: this.thresholds.gc.pauseTime,
                timestamp,
                context: {
                    collections: snapshot.system.gc.collections,
                    totalPauseTime: snapshot.system.gc.totalPauseTime
                }
            });
        }

        // Thread pool bottlenecks
        const queueSaturation = snapshot.system.threadPool.queueLength / 
            (snapshot.system.threadPool.activeThreads * 2);
        if (queueSaturation > this.thresholds.threadPool.queueSaturation) {
            indicators.push({
                type: 'threadPool',
                severity: queueSaturation > 0.9 ? 'high' : 'medium',
                metric: 'queueSaturation',
                value: queueSaturation,
                threshold: this.thresholds.threadPool.queueSaturation,
                timestamp,
                context: {
                    activeThreads: snapshot.system.threadPool.activeThreads,
                    queueLength: snapshot.system.threadPool.queueLength
                }
            });
        }

        // Cache bottlenecks
        if (snapshot.cache.evictionRate > 0.2) {
            indicators.push({
                type: 'cache',
                severity: snapshot.cache.evictionRate > 0.5 ? 'high' : 'medium',
                metric: 'evictionRate',
                value: snapshot.cache.evictionRate,
                threshold: 0.2,
                timestamp,
                context: {
                    hitRate: snapshot.cache.hitRate,
                    memoryUsage: snapshot.cache.memoryUsage
                }
            });
        }

        this.bottlenecks = indicators;
        return indicators;
    }

    public getBottlenecks(): BottleneckIndicator[] {
        return [...this.bottlenecks];
    }

    public getTimeline(start: number, end: number = Date.now()): PerformanceSnapshot[] {
        return this.snapshots.filter(s => s.timestamp >= start && s.timestamp <= end);
    }

    public recordOperationStart(): string {
        const operationId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        this.operationStats.active++;
        return operationId;
    }

    public recordOperationEnd(operationId: string, duration: number, error?: Error): void {
        this.operationStats.active--;
        this.operationStats.completed++;
        this.operationStats.totalResponseTime += duration;
        if (error) {
            this.operationStats.errors++;
        }
    }

    public getRecentSnapshots(seconds: number = 60): PerformanceSnapshot[] {
        const cutoff = Date.now() - (seconds * 1000);
        return this.snapshots.filter(s => s.timestamp >= cutoff);
    }

    public getAggregateMetrics(seconds: number = 60): {
        avgCpuUsage: number;
        avgMemoryUsage: number;
        avgResponseTime: number;
        throughput: number;
        errorRate: number;
        cacheHitRate: number;
    } {
        const snapshots = this.getRecentSnapshots(seconds);
        if (snapshots.length === 0) {
            return {
                avgCpuUsage: 0,
                avgMemoryUsage: 0,
                avgResponseTime: 0,
                throughput: 0,
                errorRate: 0,
                cacheHitRate: 0
            };
        }

        const sum = snapshots.reduce((acc, s) => ({
            cpuUsage: acc.cpuUsage + s.system.cpu.usage,
            memoryUsage: acc.memoryUsage + s.system.memory.used,
            responseTime: acc.responseTime + s.application.averageResponseTime,
            cacheHitRate: acc.cacheHitRate + s.cache.hitRate
        }), {
            cpuUsage: 0,
            memoryUsage: 0,
            responseTime: 0,
            cacheHitRate: 0
        });

        const latest = snapshots[snapshots.length - 1];

        return {
            avgCpuUsage: sum.cpuUsage / snapshots.length,
            avgMemoryUsage: sum.memoryUsage / snapshots.length,
            avgResponseTime: sum.responseTime / snapshots.length,
            throughput: latest.application.throughput,
            errorRate: latest.application.errorRate,
            cacheHitRate: sum.cacheHitRate / snapshots.length
        };
    }

    public async getResourceMetrics(): Promise<ResourceMetrics> {
        const cpuUsage = await this.getCPUUsage();
        const memoryUsage = await this.getMemoryUsage();
        const ioStats = await this.getIOStats();

        return {
            cpu: {
                usage: cpuUsage,
                kernelTime: 0,
                userTime: 0
            },
            memory: memoryUsage,
            io: ioStats
        };
    }

    private async getMemoryUsage(): Promise<MemoryUsage> {
        const memUsage = process.memoryUsage();
        return {
            total: os.totalmem(),
            used: memUsage.heapTotal + memUsage.external,
            free: os.freemem(),
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            gc: []  // GC metrics would be populated here
        };
    }

    private async getIOStats(): Promise<{ reads: number; writes: number; bytesRead: number; bytesWritten: number; }> {
        // Mock IO stats for now
        return {
            reads: 0,
            writes: 0,
            bytesRead: 0,
            bytesWritten: 0
        };
    }
}
