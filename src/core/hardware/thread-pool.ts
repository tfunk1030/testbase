import * as os from 'os';
import { EventEmitter } from 'events';
import { RealTimeMonitor } from '../real-time-monitor';

interface Task {
    id: string;
    fn: () => Promise<any>;
    priority: number;
    timestamp: number;
    cpuIntensive: boolean;
}

interface WorkerStats {
    taskCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    lastTaskTimestamp: number;
    cpuUsage: number;
}

interface ThreadPoolConfig {
    minThreads?: number;
    maxThreads?: number;
    threadIdleTimeout?: number;
    queueSize?: number;
    priorityLevels?: number;
    cpuTarget?: number;
    adaptiveScaling?: boolean;
}

export class ThreadPool extends EventEmitter {
    private static instance: ThreadPool;
    private readonly monitor: RealTimeMonitor;
    
    private workers: Worker[] = [];
    private taskQueue: Task[] = [];
    private workerStats: Map<Worker, WorkerStats> = new Map();
    private isShuttingDown: boolean = false;

    private readonly config: Required<ThreadPoolConfig>;
    private readonly defaultConfig: Required<ThreadPoolConfig> = {
        minThreads: Math.max(1, Math.floor(os.cpus().length * 0.25)),
        maxThreads: os.cpus().length,
        threadIdleTimeout: 60000, // 1 minute
        queueSize: 10000,
        priorityLevels: 5,
        cpuTarget: 70, // 70% CPU target
        adaptiveScaling: true
    };

    private constructor(config: ThreadPoolConfig = {}) {
        super();
        this.config = { ...this.defaultConfig, ...config };
        this.monitor = RealTimeMonitor.getInstance();
        this.initialize();
    }

    public static getInstance(config?: ThreadPoolConfig): ThreadPool {
        if (!ThreadPool.instance) {
            ThreadPool.instance = new ThreadPool(config);
        }
        return ThreadPool.instance;
    }

    private async initialize(): Promise<void> {
        // Create initial worker pool
        for (let i = 0; i < this.config.minThreads; i++) {
            await this.addWorker();
        }

        // Start monitoring and scaling
        if (this.config.adaptiveScaling) {
            this.startAdaptiveScaling();
        }
    }

    private async addWorker(): Promise<Worker> {
        const worker = new Worker('./worker.js');
        
        this.workerStats.set(worker, {
            taskCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            lastTaskTimestamp: Date.now(),
            cpuUsage: 0
        });

        worker.on('message', (result: { taskId: string; duration: number; cpuUsage: number }) => {
            const stats = this.workerStats.get(worker);
            if (stats) {
                stats.taskCount++;
                stats.totalExecutionTime += result.duration;
                stats.averageExecutionTime = stats.totalExecutionTime / stats.taskCount;
                stats.lastTaskTimestamp = Date.now();
                stats.cpuUsage = result.cpuUsage;
            }

            this.processNextTask(worker);
        });

        worker.on('error', (error) => {
            console.error('Worker error:', error);
            this.removeWorker(worker);
            this.addWorker(); // Replace failed worker
        });

        this.workers.push(worker);
        this.emit('workerAdded', { workerId: worker.threadId });
        return worker;
    }

    private async removeWorker(worker: Worker): Promise<void> {
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            this.workerStats.delete(worker);
            await worker.terminate();
            this.emit('workerRemoved', { workerId: worker.threadId });
        }
    }

    public async submitTask<T>(
        task: () => Promise<T>,
        options: {
            priority?: number;
            cpuIntensive?: boolean;
            timeout?: number;
        } = {}
    ): Promise<T> {
        if (this.isShuttingDown) {
            throw new Error('ThreadPool is shutting down');
        }

        const { priority = 1, cpuIntensive = false, timeout } = options;

        if (this.taskQueue.length >= this.config.queueSize) {
            throw new Error('Task queue is full');
        }

        const taskWrapper: Task = {
            id: Math.random().toString(36).substr(2, 9),
            fn: task,
            priority: Math.max(0, Math.min(priority, this.config.priorityLevels - 1)),
            timestamp: Date.now(),
            cpuIntensive
        };

        return new Promise((resolve, reject) => {
            const timeoutId = timeout ? setTimeout(() => {
                reject(new Error('Task timeout'));
            }, timeout) : null;

            this.taskQueue.push({
                ...taskWrapper,
                fn: async () => {
                    try {
                        const result = await task();
                        if (timeoutId) clearTimeout(timeoutId);
                        resolve(result);
                        return result;
                    } catch (error) {
                        if (timeoutId) clearTimeout(timeoutId);
                        reject(error);
                        throw error;
                    }
                }
            });

            this.scheduleTask();
        });
    }

    private async scheduleTask(): Promise<void> {
        if (this.taskQueue.length === 0) return;

        // Sort tasks by priority and timestamp
        this.taskQueue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            return a.timestamp - b.timestamp; // Older tasks first
        });

        // Find available worker
        const availableWorker = this.workers.find(worker => {
            const stats = this.workerStats.get(worker);
            return stats && Date.now() - stats.lastTaskTimestamp > 100; // 100ms idle
        });

        if (availableWorker) {
            const task = this.taskQueue.shift();
            if (task) {
                this.processTask(availableWorker, task);
            }
        } else if (this.workers.length < this.config.maxThreads) {
            // Add new worker if needed
            const worker = await this.addWorker();
            const task = this.taskQueue.shift();
            if (task) {
                this.processTask(worker, task);
            }
        }
    }

    private async processTask(worker: Worker, task: Task): Promise<void> {
        const startTime = Date.now();
        const stats = this.workerStats.get(worker);
        if (!stats) return;

        try {
            const result = await task.fn();
            const duration = Date.now() - startTime;

            worker.postMessage({
                taskId: task.id,
                duration,
                result
            });

            // Update stats
            stats.taskCount++;
            stats.totalExecutionTime += duration;
            stats.averageExecutionTime = stats.totalExecutionTime / stats.taskCount;
            stats.lastTaskTimestamp = Date.now();

            this.emit('taskCompleted', {
                taskId: task.id,
                workerId: worker.threadId,
                duration
            });
        } catch (error) {
            this.emit('taskError', {
                taskId: task.id,
                workerId: worker.threadId,
                error
            });
            throw error;
        }
    }

    private startAdaptiveScaling(): void {
        setInterval(async () => {
            const metrics = await this.monitor.getAggregateMetrics(10); // Last 10 seconds
            const currentCpuUsage = metrics.avgCpuUsage;

            if (currentCpuUsage > this.config.cpuTarget + 10) {
                // CPU usage too high, reduce workers
                if (this.workers.length > this.config.minThreads) {
                    const worker = this.workers[this.workers.length - 1];
                    await this.removeWorker(worker);
                }
            } else if (currentCpuUsage < this.config.cpuTarget - 10) {
                // CPU usage too low, add workers
                if (this.workers.length < this.config.maxThreads) {
                    await this.addWorker();
                }
            }
        }, 5000); // Check every 5 seconds
    }

    public getStats(): {
        activeWorkers: number;
        queueLength: number;
        averageExecutionTime: number;
        totalTasksProcessed: number;
        cpuUsage: number;
    } {
        const totalStats = Array.from(this.workerStats.values()).reduce(
            (acc, stats) => ({
                taskCount: acc.taskCount + stats.taskCount,
                totalExecutionTime: acc.totalExecutionTime + stats.totalExecutionTime,
                cpuUsage: acc.cpuUsage + stats.cpuUsage
            }),
            { taskCount: 0, totalExecutionTime: 0, cpuUsage: 0 }
        );

        return {
            activeWorkers: this.workers.length,
            queueLength: this.taskQueue.length,
            averageExecutionTime: totalStats.taskCount > 0 ?
                totalStats.totalExecutionTime / totalStats.taskCount :
                0,
            totalTasksProcessed: totalStats.taskCount,
            cpuUsage: totalStats.cpuUsage / this.workers.length
        };
    }

    public async shutdown(): Promise<void> {
        this.isShuttingDown = true;

        // Wait for queue to empty
        while (this.taskQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Terminate all workers
        await Promise.all(this.workers.map(worker => this.removeWorker(worker)));
    }
}
