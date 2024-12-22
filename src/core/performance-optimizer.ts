import { FlightIntegrator } from './flight-integrator';
import { LaunchConditions, Environment, BallProperties, Trajectory } from './types';

export class PerformanceOptimizer {
    private readonly integrator: FlightIntegrator;
    private readonly SIMULATION_STEPS = 1000;
    private readonly TIME_STEP = 0.001; // seconds

    constructor() {
        this.integrator = new FlightIntegrator();
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

                const trajectory = this.integrator.integrate(
                    conditions,
                    environment,
                    ballProperties,
                    { dragModifier: 1.0, liftModifier: 1.0 }
                );

                const distance = this.calculateDistance(trajectory);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    bestTrajectory = trajectory;
                }
            }
        }

        return bestTrajectory || this.integrator.integrate(
            initialConditions,
            environment,
            ballProperties,
            { dragModifier: 1.0, liftModifier: 1.0 }
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

                const trajectory = this.integrator.integrate(
                    conditions,
                    environment,
                    ballProperties,
                    { dragModifier: 1.0, liftModifier: 1.0 }
                );

                const carry = this.calculateCarry(trajectory);
                if (carry > maxCarry) {
                    maxCarry = carry;
                    bestTrajectory = trajectory;
                }
            }
        }

        return bestTrajectory || this.integrator.integrate(
            initialConditions,
            environment,
            ballProperties,
            { dragModifier: 1.0, liftModifier: 1.0 }
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
