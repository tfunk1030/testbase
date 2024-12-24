import { parentPort } from 'worker_threads';
import * as os from 'os';

if (!parentPort) {
    throw new Error('This module must be run as a worker thread');
}

interface TaskMessage {
    taskId: string;
    fn: () => Promise<any>;
}

interface WorkerMetrics {
    cpuUsage: {
        user: number;
        system: number;
        percent: number;
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        arrayBuffers: number;
    };
    performance: {
        taskCount: number;
        totalExecutionTime: number;
        averageExecutionTime: number;
        errorCount: number;
    };
    status: 'idle' | 'processing' | 'error';
}

const metrics: WorkerMetrics = {
    cpuUsage: {
        user: 0,
        system: 0,
        percent: 0
    },
    memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0
    },
    performance: {
        taskCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        errorCount: 0
    },
    status: 'idle'
};

let isProcessing = false;
let isShuttingDown = false;

async function executeTask(taskId: string, fn: () => Promise<any>): Promise<void> {
    if (isProcessing || isShuttingDown) {
        throw new Error('Worker is not available');
    }

    metrics.status = 'processing';
    isProcessing = true;
    const startTime = Date.now();
    const startCpuUsage = process.cpuUsage();
    const startMemory = process.memoryUsage();

    try {
        const result = await fn();
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Update CPU metrics
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        metrics.cpuUsage = {
            user: endCpuUsage.user,
            system: endCpuUsage.system,
            percent: calculateCpuPercent(endCpuUsage, duration)
        };

        // Update memory metrics
        const endMemory = process.memoryUsage();
        metrics.memory = {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal,
            external: endMemory.external,
            arrayBuffers: endMemory.arrayBuffers || 0
        };

        // Update performance metrics
        metrics.performance.taskCount++;
        metrics.performance.totalExecutionTime += duration;
        metrics.performance.averageExecutionTime = 
            metrics.performance.totalExecutionTime / metrics.performance.taskCount;

        parentPort?.postMessage({
            type: 'task_complete',
            taskId,
            result,
            metrics: {
                duration,
                cpu: metrics.cpuUsage,
                memory: metrics.memory
            }
        });
    } catch (error) {
        metrics.performance.errorCount++;
        metrics.status = 'error';
        
        parentPort?.postMessage({
            type: 'task_error',
            taskId,
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : 'Unknown error',
            metrics: {
                duration: Date.now() - startTime,
                cpu: metrics.cpuUsage,
                memory: metrics.memory
            }
        });
    } finally {
        isProcessing = false;
        metrics.status = 'idle';
        performHealthCheck();
    }
}

function calculateCpuPercent(usage: { user: number; system: number }, duration: number): number {
    const totalCpuTime = (usage.user + usage.system) / 1000; // Convert to ms
    return Math.min(100, (totalCpuTime / duration) * 100);
}

function performHealthCheck() {
    const currentMemory = process.memoryUsage();
    const healthStatus = {
        healthy: true,
        issues: [] as string[]
    };

    // Check memory usage
    if (currentMemory.heapUsed / currentMemory.heapTotal > 0.9) {
        healthStatus.healthy = false;
        healthStatus.issues.push('high_memory_usage');
    }

    // Check error rate
    const errorRate = metrics.performance.errorCount / Math.max(1, metrics.performance.taskCount);
    if (errorRate > 0.1) {
        healthStatus.healthy = false;
        healthStatus.issues.push('high_error_rate');
    }

    // Check CPU usage
    if (metrics.cpuUsage.percent > 90) {
        healthStatus.healthy = false;
        healthStatus.issues.push('high_cpu_usage');
    }

    parentPort?.postMessage({
        type: 'health_check',
        metrics,
        health: healthStatus
    });
}

// Enhanced message handling
parentPort.on('message', async (message: TaskMessage | { type: 'shutdown' }) => {
    if ('type' in message && message.type === 'shutdown') {
        await handleShutdown();
        return;
    }

    const { taskId, fn } = message as TaskMessage;
    await executeTask(taskId, fn);
});

async function handleShutdown(): Promise<void> {
    isShuttingDown = true;
    
    // Wait for current task to complete
    while (isProcessing) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send final metrics
    parentPort?.postMessage({
        type: 'shutdown_complete',
        finalMetrics: metrics
    });

    // Clean exit
    process.exit(0);
}

// Increase health check frequency when under load
setInterval(performHealthCheck, isProcessing ? 500 : 2000);

// Handle process warnings
process.on('warning', (warning) => {
    parentPort?.postMessage({
        type: 'warning',
        warning: {
            name: warning.name,
            message: warning.message,
            stack: warning.stack
        }
    });
});

// Handle errors
process.on('uncaughtException', (error) => {
    parentPort?.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
    });
});
