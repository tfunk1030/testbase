import { FlightIntegrator } from './flight-integrator';
import { LaunchConditions, Environment, BallProperties, Trajectory, BallState } from './types';

export class PerformanceOptimizer {
    private readonly integrator: FlightIntegrator;
    private readonly SIMULATION_STEPS = 1000;
    private readonly TIME_STEP = 0.001; // seconds

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
     * Optimize trajectory for maximum distance
     */
    public optimizeForDistance(
        initialConditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        let bestTrajectory: Trajectory | null = null;
        let maxDistance = 0;

        // Simple grid search for launch angle and spin
        for (let angle = 0; angle <= 45; angle += 5) {
            for (let spin = 1000; spin <= 5000; spin += 500) {
                const conditions: LaunchConditions = {
                    ...initialConditions,
                    launchAngle: angle,
                    totalSpin: spin
                };

                const initialState = this.convertToInitialState(conditions, ballProperties);
                const trajectory = this.integrator.integrate(
                    initialState,
                    environment,
                    ballProperties
                );

                const distance = this.calculateDistance(trajectory);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    bestTrajectory = trajectory;
                }
            }
        }

        return bestTrajectory || this.integrator.integrate(
            this.convertToInitialState(initialConditions, ballProperties),
            environment,
            ballProperties
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
     * Optimize trajectory for maximum carry
     */
    public optimizeForCarry(
        initialConditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        let bestTrajectory: Trajectory | null = null;
        let maxCarry = 0;

        // Simple grid search for launch angle and spin
        for (let angle = 0; angle <= 45; angle += 5) {
            for (let spin = 1000; spin <= 5000; spin += 500) {
                const conditions: LaunchConditions = {
                    ...initialConditions,
                    launchAngle: angle,
                    totalSpin: spin
                };

                const initialState = this.convertToInitialState(conditions, ballProperties);
                const trajectory = this.integrator.integrate(
                    initialState,
                    environment,
                    ballProperties
                );

                const carry = this.calculateCarry(trajectory);
                if (carry > maxCarry) {
                    maxCarry = carry;
                    bestTrajectory = trajectory;
                }
            }
        }

        return bestTrajectory || this.integrator.integrate(
            this.convertToInitialState(initialConditions, ballProperties),
            environment,
            ballProperties
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

    /**
     * Optimize trajectory for maximum height
     */
    public optimizeForHeight(
        initialConditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        let bestTrajectory: Trajectory | null = null;
        let maxHeight = 0;

        // Simple grid search for launch angle and spin
        for (let angle = 0; angle <= 60; angle += 5) {
            for (let spin = 1000; spin <= 5000; spin += 500) {
                const conditions: LaunchConditions = {
                    ...initialConditions,
                    launchAngle: angle,
                    totalSpin: spin
                };

                const initialState = this.convertToInitialState(conditions, ballProperties);
                const trajectory = this.integrator.integrate(
                    initialState,
                    environment,
                    ballProperties
                );

                if (trajectory.maxHeight > maxHeight) {
                    maxHeight = trajectory.maxHeight;
                    bestTrajectory = trajectory;
                }
            }
        }

        return bestTrajectory || this.integrator.integrate(
            this.convertToInitialState(initialConditions, ballProperties),
            environment,
            ballProperties
        );
    }

    /**
     * Optimize trajectory for accuracy
     */
    public optimizeForAccuracy(
        initialConditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        // For accuracy, we want a lower, more controlled trajectory
        const conditions: LaunchConditions = {
            ...initialConditions,
            launchAngle: Math.min(initialConditions.launchAngle, 20), // Cap launch angle
            totalSpin: Math.min(initialConditions.totalSpin, 3000) // Cap spin rate
        };

        return this.integrator.integrate(
            this.convertToInitialState(conditions, ballProperties),
            environment,
            ballProperties
        );
    }

    /**
     * Optimize trajectory for given conditions
     */
    public optimizeTrajectory(
        conditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties,
        targetMetric: 'distance' | 'height' | 'accuracy' = 'distance'
    ): Trajectory {
        switch (targetMetric) {
            case 'distance':
                return this.optimizeForDistance(conditions, environment, ballProperties);
            case 'height':
                return this.optimizeForHeight(conditions, environment, ballProperties);
            case 'accuracy':
                return this.optimizeForAccuracy(conditions, environment, ballProperties);
            default:
                return this.optimizeForDistance(conditions, environment, ballProperties);
        }
    }

    /**
     * Batch process multiple trajectories
     */
    public batchProcess(
        conditions: LaunchConditions[],
        environment: Environment,
        ballProperties: BallProperties,
        targetMetric: 'distance' | 'height' | 'accuracy' = 'distance'
    ): Trajectory[] {
        return conditions.map(condition => 
            this.optimizeTrajectory(condition, environment, ballProperties, targetMetric)
        );
    }
}
