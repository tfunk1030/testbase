import * as tf from '@tensorflow/tfjs-node-gpu';
import { MemoryManager, MemoryStats } from './memory-manager';
import { DeviceManager } from './device-manager';

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    memoryStats: MemoryStats;
    deviceMetrics: {
        load: number;
        temperature?: number;
        memoryUsage: number;
        computeUtilization: number;
    };
    tensorStats: {
        activeCount: number;
        totalAllocated: number;
        peakMemory: number;
    };
    pipelineStats: {
        cacheHits: number;
        cacheMisses: number;
        averageComputeTime: number;
    };
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private readonly memoryManager: MemoryManager;
    private readonly deviceManager: DeviceManager;
    
    private frameCount: number = 0;
    private lastFrameTime: number = 0;
    private frameTimestamps: number[] = [];
    private pipelineStats = {
        cacheHits: 0,
        cacheMisses: 0,
        computeTimes: [] as number[]
    };

    private constructor() {
        this.memoryManager = MemoryManager.getInstance();
        this.deviceManager = DeviceManager.getInstance();
        this.startMonitoring();
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    private startMonitoring(): void {
        // Monitor frame rate and performance metrics
        const monitorLoop = () => {
            this.updateFrameStats();
            requestAnimationFrame(monitorLoop);
        };
        requestAnimationFrame(monitorLoop);
    }

    private updateFrameStats(): void {
        const now = performance.now();
        this.frameCount++;

        // Update frame timestamps
        this.frameTimestamps.push(now);
        // Keep only last second of timestamps
        const oneSecondAgo = now - 1000;
        this.frameTimestamps = this.frameTimestamps.filter(t => t > oneSecondAgo);

        // Calculate frame time
        if (this.lastFrameTime) {
            const frameTime = now - this.lastFrameTime;
            this.pipelineStats.computeTimes.push(frameTime);
            // Keep only last 100 frame times
            if (this.pipelineStats.computeTimes.length > 100) {
                this.pipelineStats.computeTimes.shift();
            }
        }
        this.lastFrameTime = now;
    }

    public recordPipelineStats(hit: boolean, computeTime: number): void {
        if (hit) {
            this.pipelineStats.cacheHits++;
        } else {
            this.pipelineStats.cacheMisses++;
        }
        this.pipelineStats.computeTimes.push(computeTime);
    }

    public getMetrics(): PerformanceMetrics {
        const now = performance.now();
        const fps = this.frameTimestamps.length;
        const frameTime = this.pipelineStats.computeTimes.length > 0 
            ? this.pipelineStats.computeTimes.reduce((a, b) => a + b) / this.pipelineStats.computeTimes.length 
            : 0;

        const memoryStats = this.memoryManager.getMemoryStats();
        const activeDevice = this.deviceManager.getActiveDevice();
        const tfMemory = tf.memory();

        return {
            fps,
            frameTime,
            memoryStats,
            deviceMetrics: {
                load: activeDevice?.load ?? 0,
                temperature: activeDevice?.temperature,
                memoryUsage: tfMemory.numBytes,
                computeUtilization: activeDevice?.load ?? 0
            },
            tensorStats: {
                activeCount: tfMemory.numTensors,
                totalAllocated: tfMemory.numBytes,
                peakMemory: tfMemory.numBytes // TF.js doesn't provide peak memory info
            },
            pipelineStats: {
                cacheHits: this.pipelineStats.cacheHits,
                cacheMisses: this.pipelineStats.cacheMisses,
                averageComputeTime: frameTime
            }
        };
    }

    public reset(): void {
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.frameTimestamps = [];
        this.pipelineStats = {
            cacheHits: 0,
            cacheMisses: 0,
            computeTimes: []
        };
    }

    public async cleanup(): Promise<void> {
        this.reset();
    }
}
