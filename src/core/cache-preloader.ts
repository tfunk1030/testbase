import { Environment, BallProperties, LaunchConditions } from './types';
import { CacheManager } from './cache-manager';
import { PerformanceMonitor } from './performance-monitor';

export class CachePreloader {
    private readonly cacheManager: CacheManager;
    private readonly monitor: PerformanceMonitor;
    private readonly batchSize: number = 10;
    private isPreloading: boolean = false;

    constructor() {
        this.cacheManager = CacheManager.getInstance();
        this.monitor = PerformanceMonitor.getInstance();
    }

    /**
     * Preload cache with common trajectories based on statistical analysis
     */
    public async preloadCommonTrajectories(
        environment: Environment,
        properties: BallProperties
    ): Promise<void> {
        if (this.isPreloading) {
            return;
        }

        this.isPreloading = true;
        const operationId = 'preload_' + Date.now();
        this.monitor.startOperation(operationId);

        try {
            await this.cacheManager.preloadCache(environment, properties);
        } finally {
            this.isPreloading = false;
            this.monitor.endOperation(operationId);
        }
    }

    /**
     * Warm up cache with specific conditions
     */
    public async warmupCache(
        conditions: LaunchConditions[],
        environment: Environment,
        properties: BallProperties
    ): Promise<void> {
        if (this.isPreloading) {
            return;
        }

        this.isPreloading = true;
        const operationId = 'warmup_' + Date.now();
        this.monitor.startOperation(operationId);

        try {
            // Process in batches to avoid memory pressure
            for (let i = 0; i < conditions.length; i += this.batchSize) {
                const batch = conditions.slice(i, i + this.batchSize);
                await Promise.all(
                    batch.map(condition =>
                        this.cacheManager.preloadTrajectory(condition, environment, properties)
                    )
                );
            }
        } finally {
            this.isPreloading = false;
            this.monitor.endOperation(operationId);
        }
    }

    /**
     * Generate a range of launch conditions for comprehensive cache warming
     */
    public generateWarmupConditions(
        speedRange: { min: number; max: number; step: number },
        angleRange: { min: number; max: number; step: number },
        spinRange: { min: number; max: number; step: number }
    ): LaunchConditions[] {
        const conditions: LaunchConditions[] = [];

        for (let speed = speedRange.min; speed <= speedRange.max; speed += speedRange.step) {
            for (let angle = angleRange.min; angle <= angleRange.max; angle += angleRange.step) {
                for (let spin = spinRange.min; spin <= spinRange.max; spin += spinRange.step) {
                    conditions.push({
                        ballSpeed: speed,
                        launchAngle: angle,
                        spinRate: spin,
                        spinAxis: { x: 0, y: 1, z: 0 }
                    });
                }
            }
        }

        return conditions;
    }
}
