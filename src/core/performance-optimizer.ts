import { FlightIntegrator } from './flight-integrator';
import { LaunchConditions, Environment, BallProperties, Trajectory, BallState } from './types';

export class PerformanceOptimizer {
    private readonly integrator: FlightIntegrator;
    private readonly SIMULATION_STEPS = 1000;
    private readonly TIME_STEP = 0.001; // seconds
    private readonly resultCache: Map<string, Trajectory> = new Map();
    private readonly MAX_CACHE_SIZE = 1000;

    // Optimization parameters
    private readonly ANGLE_RANGE = { min: 0, max: 45, step: 2.5 };
    private readonly SPIN_RANGE = { min: 1000, max: 5000, step: 250 };
    private readonly BATCH_SIZE = 10;

    constructor() {
        this.integrator = new FlightIntegrator();
    }

    /**
     * Convert launch conditions to initial state
     */
    private convertToInitialState(conditions: LaunchConditions, ballProperties: BallProperties): BallState {
        const speed = conditions.ballSpeed; // Already in m/s
        const angle = conditions.launchAngle * Math.PI / 180;
        const direction = conditions.launchDirection * Math.PI / 180;

        return {
            position: { x: 0, y: 0, z: 0 },
            velocity: {
                x: speed * Math.cos(angle) * Math.cos(direction),
                y: speed * Math.sin(angle),
                z: speed * Math.cos(angle) * Math.sin(direction)
            },
            spin: {
                x: conditions.totalSpin * Math.cos(conditions.spinAxis * Math.PI / 180),
                y: 0,
                z: conditions.totalSpin * Math.sin(conditions.spinAxis * Math.PI / 180)
            },
            mass: ballProperties.mass
        };
    }

    /**
     * Generate cache key for trajectory
     */
    private generateCacheKey(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): string {
        return JSON.stringify({
            speed: Math.round(conditions.ballSpeed * 100) / 100,
            angle: Math.round(conditions.launchAngle * 10) / 10,
            spin: Math.round(conditions.totalSpin / 100) * 100,
            wind: Math.round(environment.wind.speed * 10) / 10,
            temp: Math.round(environment.temperature),
            humidity: Math.round(environment.humidity)
        });
    }

    /**
     * Process a batch of trajectories in parallel
     */
    private async processBatch(
        batch: LaunchConditions[],
        environment: Environment,
        properties: BallProperties
    ): Promise<{ trajectory: Trajectory; distance: number }[]> {
        return Promise.all(
            batch.map(async (conditions) => {
                const cacheKey = this.generateCacheKey(conditions, environment, properties);
                let trajectory = this.resultCache.get(cacheKey);

                if (!trajectory) {
                    const initialState = this.convertToInitialState(conditions, properties);
                    trajectory = await this.integrator.simulateFlight(
                        initialState,
                        environment,
                        properties,
                        new AerodynamicsEngine()
                    );

                    // Cache result
                    if (this.resultCache.size >= this.MAX_CACHE_SIZE) {
                        const firstKey = this.resultCache.keys().next().value;
                        this.resultCache.delete(firstKey);
                    }
                    this.resultCache.set(cacheKey, trajectory);
                }

                return {
                    trajectory,
                    distance: this.calculateDistance(trajectory)
                };
            })
        );
    }

    /**
     * Optimize trajectory using parallel grid search
     */
    private async gridSearch(
        baseConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties,
        optimizationFunction: (t: Trajectory) => number
    ): Promise<Trajectory> {
        let bestTrajectory: Trajectory | null = null;
        let bestMetric = 0;
        const batch: LaunchConditions[] = [];

        for (let angle = this.ANGLE_RANGE.min; angle <= this.ANGLE_RANGE.max; angle += this.ANGLE_RANGE.step) {
            for (let spin = this.SPIN_RANGE.min; spin <= this.SPIN_RANGE.max; spin += this.SPIN_RANGE.step) {
                batch.push({
                    ...baseConditions,
                    launchAngle: angle,
                    totalSpin: spin
                });

                if (batch.length >= this.BATCH_SIZE) {
                    const results = await this.processBatch(batch, environment, properties);
                    
                    for (const result of results) {
                        const metric = optimizationFunction(result.trajectory);
                        if (metric > bestMetric) {
                            bestMetric = metric;
                            bestTrajectory = result.trajectory;
                        }
                    }
                    
                    batch.length = 0;
                }
            }
        }

        // Process remaining trajectories
        if (batch.length > 0) {
            const results = await this.processBatch(batch, environment, properties);
            for (const result of results) {
                const metric = optimizationFunction(result.trajectory);
                if (metric > bestMetric) {
                    bestMetric = metric;
                    bestTrajectory = result.trajectory;
                }
            }
        }

        return bestTrajectory || (await this.integrator.simulateFlight(
            this.convertToInitialState(baseConditions, properties),
            environment,
            properties,
            new AerodynamicsEngine()
        ));
    }

    /**
     * Optimize trajectory for maximum distance
     */
    public async optimizeForDistance(
        initialConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<Trajectory> {
        return this.gridSearch(
            initialConditions,
            environment,
            properties,
            (trajectory) => this.calculateDistance(trajectory)
        );
    }

    /**
     * Optimize trajectory for maximum carry
     */
    public async optimizeForCarry(
        initialConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<Trajectory> {
        return this.gridSearch(
            initialConditions,
            environment,
            properties,
            (trajectory) => this.calculateCarry(trajectory)
        );
    }

    /**
     * Optimize trajectory for maximum height
     */
    public async optimizeForHeight(
        initialConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<Trajectory> {
        return this.gridSearch(
            initialConditions,
            environment,
            properties,
            (trajectory) => trajectory.maxHeight || 0
        );
    }

    /**
     * Optimize trajectory for accuracy
     */
    public async optimizeForAccuracy(
        initialConditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<Trajectory> {
        // For accuracy, we want a lower, more controlled trajectory
        const conditions: LaunchConditions = {
            ...initialConditions,
            launchAngle: Math.min(initialConditions.launchAngle, 20), // Cap launch angle
            totalSpin: Math.min(initialConditions.totalSpin, 3000) // Cap spin rate
        };

        return this.integrator.simulateFlight(
            this.convertToInitialState(conditions, properties),
            environment,
            properties,
            new AerodynamicsEngine()
        );
    }

    /**
     * Optimize trajectory for given conditions
     */
    public async optimizeTrajectory(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties,
        targetMetric: 'distance' | 'height' | 'accuracy' = 'distance'
    ): Promise<Trajectory> {
        switch (targetMetric) {
            case 'distance':
                return this.optimizeForDistance(conditions, environment, properties);
            case 'height':
                return this.optimizeForHeight(conditions, environment, properties);
            case 'accuracy':
                return this.optimizeForAccuracy(conditions, environment, properties);
            default:
                return this.optimizeForDistance(conditions, environment, properties);
        }
    }

    /**
     * Batch process multiple trajectories
     */
    public async batchProcess(
        conditions: LaunchConditions[],
        environment: Environment,
        properties: BallProperties,
        targetMetric: 'distance' | 'height' | 'accuracy' = 'distance'
    ): Promise<Trajectory[]> {
        return Promise.all(
            conditions.map(async (condition) => 
                this.optimizeTrajectory(condition, environment, properties, targetMetric)
            )
        );
    }

    /**
     * Calculate total distance of trajectory
     */
    private calculateDistance(trajectory: Trajectory): number {
        if (trajectory.points.length === 0) return 0;

        const lastPoint = trajectory.points[trajectory.points.length - 1];
        return Math.sqrt(
            lastPoint.position.x * lastPoint.position.x +
            lastPoint.position.z * lastPoint.position.z
        );
    }

    /**
     * Calculate carry distance of trajectory
     */
    private calculateCarry(trajectory: Trajectory): number {
        if (trajectory.points.length === 0) return 0;

        let maxHeight = 0;
        let carryDistance = 0;

        for (const point of trajectory.points) {
            if (point.position.y > maxHeight) {
                maxHeight = point.position.y;
                carryDistance = Math.sqrt(
                    point.position.x * point.position.x +
                    point.position.z * point.position.z
                );
            }
        }

        return carryDistance;
    }
}
