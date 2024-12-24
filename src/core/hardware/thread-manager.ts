import * as os from 'os';
import { EventEmitter } from 'events';
import { ThreadPool } from './thread-pool';
import { RealTimeMonitor } from '../real-time-monitor';
import { HardwareMonitor } from './hardware-monitor';

interface ThreadConfig {
    minThreads: number;
    maxThreads: number;
    threadIdleTimeout: number;
    queueSize: number;
    priorityLevels: number;
    cpuTarget: number;
}

interface WorkloadStrategy {
    taskDistribution: 'round-robin' | 'least-loaded' | 'priority-based';
    loadBalancingInterval: number;
    taskPrioritization: boolean;
    affinityRules: {
        cpuIntensive: boolean;
        ioIntensive: boolean;
        priority: number;
    };
}

interface WorkerMetrics {
    cpuUsage: number;
    memoryUsage: number;
    taskCount: number;
    averageLatency: number;
    errorRate: number;
    lastActive: number;
}

export class ThreadManager extends EventEmitter {
    private static instance: ThreadManager;
    private readonly monitor: RealTimeMonitor;
    private readonly hardwareMonitor: HardwareMonitor;
    private readonly threadPool: ThreadPool;
    
    private workerMetrics: Map<number, WorkerMetrics> = new Map();
    private currentStrategy: WorkloadStrategy;
    private metricsHistory: {
        timestamp: number;
        metrics: Map<number, WorkerMetrics>;
    }[] = [];

    private readonly config = {
        metricsRetentionPeriod: 3600000, // 1 hour
        metricsCollectionInterval: 1000, // 1 second
        loadBalancingInterval: 5000, // 5 seconds
        workerHealthCheckInterval: 10000, // 10 seconds
        cpuUsageThreshold: 80, // 80%
        memoryUsageThreshold: 80, // 80%
        errorRateThreshold: 0.1, // 10%
        latencyThreshold: 1000, // 1 second
    };

    private constructor() {
        super();
        this.monitor = RealTimeMonitor.getInstance();
        this.hardwareMonitor = HardwareMonitor.getInstance();
        this.threadPool = ThreadPool.getInstance();
        
        this.currentStrategy = this.initializeWorkloadStrategy();
        this.startMetricsCollection();
        this.startWorkerHealthCheck();
    }

    public static getInstance(): ThreadManager {
        if (!ThreadManager.instance) {
            ThreadManager.instance = new ThreadManager();
        }
        return ThreadManager.instance;
    }

    private initializeWorkloadStrategy(): WorkloadStrategy {
        const cpuCount = os.cpus().length;
        return {
            taskDistribution: cpuCount >= 8 ? 'priority-based' : 'least-loaded',
            loadBalancingInterval: this.config.loadBalancingInterval,
            taskPrioritization: true,
            affinityRules: {
                cpuIntensive: true,
                ioIntensive: true,
                priority: 2
            }
        };
    }

    public optimizeThreadAllocation(): ThreadConfig {
        const hardwareProfile = this.hardwareMonitor.getHardwareProfile();
        const systemLoad = this.monitor.getSystemLoad();
        const poolStats = this.threadPool.getStats();

        // Calculate optimal thread count based on hardware and load
        const cpuCount = os.cpus().length;
        const systemMemory = hardwareProfile.memory.total;
        const memoryPerThread = hardwareProfile.memory.free / poolStats.activeWorkers;

        let optimalThreads = Math.floor(cpuCount * 0.75); // Start with 75% of CPU cores

        // Adjust based on system load
        if (systemLoad.cpu > 80) {
            optimalThreads = Math.max(2, optimalThreads - 1);
        } else if (systemLoad.cpu < 40) {
            optimalThreads = Math.min(cpuCount, optimalThreads + 1);
        }

        // Adjust based on memory constraints
        const maxThreadsByMemory = Math.floor(systemMemory / (memoryPerThread * 1.2)); // 20% buffer
        optimalThreads = Math.min(optimalThreads, maxThreadsByMemory);

        // Consider current workload
        const queueSize = Math.max(1000, poolStats.queueLength * 2);
        const idleTimeout = poolStats.averageExecutionTime * 5;

        return {
            minThreads: Math.max(2, Math.floor(optimalThreads * 0.5)),
            maxThreads: Math.min(cpuCount, Math.ceil(optimalThreads * 1.5)),
            threadIdleTimeout: idleTimeout,
            queueSize,
            priorityLevels: 5,
            cpuTarget: 70
        };
    }

    public balanceWorkload(): WorkloadStrategy {
        const metrics = this.getAggregatedMetrics();
        const poolStats = this.threadPool.getStats();

        // Determine best distribution strategy
        let taskDistribution: WorkloadStrategy['taskDistribution'] = 'least-loaded';
        
        if (poolStats.activeWorkers >= 8) {
            const loadVariance = this.calculateLoadVariance(metrics);
            if (loadVariance > 0.2) { // High variance
                taskDistribution = 'priority-based';
            }
        }

        // Adjust load balancing interval based on workload
        const loadBalancingInterval = Math.max(
            1000,
            Math.min(
                10000,
                poolStats.averageExecutionTime / 2
            )
        );

        // Update strategy
        this.currentStrategy = {
            taskDistribution,
            loadBalancingInterval,
            taskPrioritization: true,
            affinityRules: {
                cpuIntensive: metrics.avgCpuUsage < 70,
                ioIntensive: metrics.avgMemoryUsage < 70,
                priority: metrics.errorRate < 0.05 ? 3 : 2
            }
        };

        return this.currentStrategy;
    }

    public handleWorkerLifecycle(): void {
        const metrics = this.getAggregatedMetrics();
        const unhealthyWorkers = new Set<number>();

        // Check each worker's health
        for (const [workerId, workerMetrics] of this.workerMetrics.entries()) {
            if (
                workerMetrics.cpuUsage > this.config.cpuUsageThreshold ||
                workerMetrics.memoryUsage > this.config.memoryUsageThreshold ||
                workerMetrics.errorRate > this.config.errorRateThreshold ||
                workerMetrics.averageLatency > this.config.latencyThreshold
            ) {
                unhealthyWorkers.add(workerId);
            }
        }

        // Take action on unhealthy workers
        for (const workerId of unhealthyWorkers) {
            this.emit('worker_unhealthy', {
                workerId,
                metrics: this.workerMetrics.get(workerId)
            });

            // Attempt recovery
            this.recoverUnhealthyWorker(workerId);
        }

        // Scale workers if needed
        this.scaleWorkersBasedOnHealth(metrics, unhealthyWorkers.size);
    }

    private startMetricsCollection(): void {
        setInterval(() => {
            const timestamp = Date.now();
            const currentMetrics = new Map(this.workerMetrics);

            this.metricsHistory.push({ timestamp, metrics: currentMetrics });

            // Cleanup old metrics
            const cutoff = timestamp - this.config.metricsRetentionPeriod;
            this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);

            this.emit('metrics_collected', {
                timestamp,
                metrics: Object.fromEntries(currentMetrics)
            });
        }, this.config.metricsCollectionInterval);
    }

    private startWorkerHealthCheck(): void {
        setInterval(() => {
            this.handleWorkerLifecycle();
        }, this.config.workerHealthCheckInterval);
    }

    private getAggregatedMetrics() {
        let totalCpu = 0;
        let totalMemory = 0;
        let totalErrors = 0;
        let totalTasks = 0;
        let totalLatency = 0;

        for (const metrics of this.workerMetrics.values()) {
            totalCpu += metrics.cpuUsage;
            totalMemory += metrics.memoryUsage;
            totalErrors += metrics.errorRate * metrics.taskCount;
            totalTasks += metrics.taskCount;
            totalLatency += metrics.averageLatency * metrics.taskCount;
        }

        const workerCount = this.workerMetrics.size;
        return {
            avgCpuUsage: totalCpu / workerCount,
            avgMemoryUsage: totalMemory / workerCount,
            errorRate: totalTasks > 0 ? totalErrors / totalTasks : 0,
            avgLatency: totalTasks > 0 ? totalLatency / totalTasks : 0,
            totalTasks
        };
    }

    private calculateLoadVariance(metrics: ReturnType<typeof this.getAggregatedMetrics>): number {
        const cpuUsages = Array.from(this.workerMetrics.values()).map(m => m.cpuUsage);
        const mean = cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length;
        const variance = cpuUsages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / cpuUsages.length;
        return Math.sqrt(variance) / mean; // Coefficient of variation
    }

    private async recoverUnhealthyWorker(workerId: number): Promise<void> {
        const metrics = this.workerMetrics.get(workerId);
        if (!metrics) return;

        // Attempt graduated recovery
        if (metrics.cpuUsage > 90) {
            // Critical CPU usage - force restart
            this.emit('worker_restart', { workerId, reason: 'critical_cpu' });
            await this.threadPool.removeWorker(workerId);
            await this.threadPool.addWorker();
        } else if (metrics.errorRate > 0.2) {
            // High error rate - graceful restart
            this.emit('worker_restart', { workerId, reason: 'high_errors' });
            await this.threadPool.removeWorker(workerId);
            await this.threadPool.addWorker();
        } else {
            // Less severe issues - reduce load
            this.emit('worker_throttle', { workerId, metrics });
            // ThreadPool will automatically reduce load through its scheduling
        }
    }

    private scaleWorkersBasedOnHealth(
        metrics: ReturnType<typeof this.getAggregatedMetrics>,
        unhealthyCount: number
    ): void {
        const config = this.optimizeThreadAllocation();
        const currentWorkers = this.workerMetrics.size;

        if (unhealthyCount > currentWorkers * 0.2) { // More than 20% unhealthy
            // Scale up to handle load
            const neededWorkers = Math.min(
                config.maxThreads,
                currentWorkers + Math.ceil(unhealthyCount / 2)
            );

            this.emit('scaling_up', {
                current: currentWorkers,
                target: neededWorkers,
                reason: 'health_compensation'
            });
        } else if (metrics.avgCpuUsage < 40 && currentWorkers > config.minThreads) {
            // Scale down if underutilized
            const targetWorkers = Math.max(
                config.minThreads,
                currentWorkers - 1
            );

            this.emit('scaling_down', {
                current: currentWorkers,
                target: targetWorkers,
                reason: 'optimization'
            });
        }
    }
}
