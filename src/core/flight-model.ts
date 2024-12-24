import { BallState, Environment, BallProperties, ValidationCase, TrajectoryPoint, TrajectoryResult, ValidationMetrics, ValidationResult, Vector3D, Forces } from './types';
import { FlightIntegrator } from './flight-integrator';
import { AerodynamicsEngine } from './aerodynamics';

export class FlightModel {
    private readonly flightIntegrator: FlightIntegrator;
    private readonly aerodynamicsEngine: AerodynamicsEngine;

    constructor(aerodynamicsEngine: AerodynamicsEngine) {
        this.flightIntegrator = new FlightIntegrator();
        this.aerodynamicsEngine = aerodynamicsEngine;
    }

    public async simulateFlight(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties
    ): Promise<TrajectoryResult> {
        // Validate inputs
        this.validateInputs(initialState, environment, properties);

        // Simulate flight
        return this.flightIntegrator.simulateFlight(
            initialState,
            environment,
            properties,
            this.aerodynamicsEngine
        );
    }

    private validateInputs(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties
    ): void {
        // Validate ball properties
        if (properties.mass <= 0) {
            throw new Error('Invalid ball properties: mass must be positive');
        }
        if (properties.radius <= 0) {
            throw new Error('Ball radius must be positive');
        }
        if (properties.dragCoefficient < 0) {
            throw new Error('Invalid ball properties: drag coefficient must be non-negative');
        }
        if (properties.liftCoefficient < 0) {
            throw new Error('Invalid ball properties: lift coefficient must be non-negative');
        }
        if (properties.magnusCoefficient < 0) {
            throw new Error('Invalid ball properties: magnus coefficient must be non-negative');
        }
        if (properties.spinDecayRate < 0) {
            throw new Error('Invalid ball properties: spin decay rate must be non-negative');
        }

        // Validate initial state
        if (initialState.mass <= 0) {
            throw new Error('Invalid initial state: mass must be positive');
        }
        if (initialState.spin.rate < 0) {
            throw new Error('Invalid initial state: spin rate must be non-negative');
        }

        // Validate environment
        if (environment.pressure <= 0) {
            throw new Error('Invalid environment: pressure must be positive');
        }
        if (environment.temperature < -273.15) {
            throw new Error('Invalid environment: temperature must be above absolute zero');
        }
        if (environment.humidity < 0 || environment.humidity > 1) {
            throw new Error('Invalid environment: humidity must be between 0 and 1');
        }
    }

    private calculateMetrics(points: TrajectoryPoint[]): ValidationMetrics {
        if (points.length < 2) {
            return {
                carryDistance: 0,
                maxHeight: points[0]?.position.y ?? 0,
                flightTime: 0,
                launchAngle: 0,
                landingAngle: 0,
                spinRate: 0
            };
        }

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        // Calculate carry distance (horizontal distance)
        const dx = lastPoint.position.x - firstPoint.position.x;
        const dz = lastPoint.position.z - firstPoint.position.z;
        const carryDistance = Math.sqrt(dx * dx + dz * dz);

        // Find maximum height
        const maxHeight = Math.max(...points.map(p => p.position.y));

        // Calculate flight time
        const flightTime = points.length * 0.01; // dt = 0.01

        // Calculate launch angle
        const initialVelocity = firstPoint.velocity;
        const launchAngle = Math.atan2(initialVelocity.y, Math.sqrt(initialVelocity.x * initialVelocity.x + initialVelocity.z * initialVelocity.z)) * 180 / Math.PI;

        // Calculate landing angle
        const finalVelocity = lastPoint.velocity;
        const landingAngle = Math.atan2(-finalVelocity.y, Math.sqrt(finalVelocity.x * finalVelocity.x + finalVelocity.z * finalVelocity.z)) * 180 / Math.PI;

        return {
            carryDistance,
            maxHeight,
            flightTime,
            launchAngle,
            landingAngle,
            spinRate: firstPoint.spin.rate
        };
    }

    public async validateTrajectory(validationCase: ValidationCase): Promise<ValidationResult> {
        try {
            const trajectory = await this.simulateFlight(
                validationCase.initialState,
                validationCase.environment,
                validationCase.properties
            );

            if (!trajectory || !trajectory.metrics) {
                return {
                    isValid: false,
                    errors: ['Failed to compute trajectory or metrics'],
                    trajectory: undefined
                };
            }

            const isValid = this.validateMetrics(trajectory.metrics);
            return {
                isValid: isValid,
                errors: isValid ? [] : ['Trajectory metrics out of expected ranges'],
                trajectory
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [(error as Error).message],
                trajectory: undefined
            };
        }
    }

    private validateMetrics(metrics: ValidationMetrics): boolean {
        // Validate each metric is within expected ranges
        const isCarryValid = metrics.carryDistance >= 0 && metrics.carryDistance <= 300; // meters
        const isHeightValid = metrics.maxHeight >= 0 && metrics.maxHeight <= 50; // meters
        const isTimeValid = metrics.flightTime >= 0 && metrics.flightTime <= 10; // seconds
        const isSpinValid = !metrics.spinRate || (metrics.spinRate >= 0 && metrics.spinRate <= 10000); // rpm

        return isCarryValid && isHeightValid && isTimeValid && isSpinValid;
    }

    public async validateBatch(cases: ValidationCase[]): Promise<ValidationResult[]> {
        return Promise.all(cases.map(testCase => this.validateTrajectory(testCase)));
    }
}
