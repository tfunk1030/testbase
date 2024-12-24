import { BallState, Environment, BallProperties, ValidationCase, TrajectoryPoint, TrajectoryResult, ValidationMetrics, ValidationResult, Vector3D, Forces, LaunchConditions } from './types';
import { FlightIntegrator } from './flight-integrator';
import { AerodynamicsEngine } from './aerodynamics';

export class FlightModel {
    private readonly aerodynamicsEngine: AerodynamicsEngine;
    private readonly flightIntegrator: FlightIntegrator;

    constructor(aerodynamicsEngine?: AerodynamicsEngine) {
        this.aerodynamicsEngine = aerodynamicsEngine || new AerodynamicsEngine();
        this.flightIntegrator = new FlightIntegrator(this.aerodynamicsEngine);
    }

    public async simulateFlight(
        initialState: BallState,
        environment: Environment,
        properties: BallProperties
    ): Promise<TrajectoryResult> {
        // Validate inputs
        this.validateInputs(initialState, environment, properties);

        // Simulate flight
        return this.flightIntegrator.integrate(initialState, environment, properties);
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

    public generateRandomConditions(): LaunchConditions {
        return {
            ballSpeed: Math.random() * 50 + 30,  // 30-80 m/s
            launchAngle: Math.random() * 30,     // 0-30 degrees
            launchDirection: Math.random() * 360, // 0-360 degrees
            spinRate: Math.random() * 5000 + 2000, // 2000-7000 rpm
            spinAxis: {
                x: Math.random() - 0.5,
                y: Math.random() - 0.5,
                z: Math.random() - 0.5
            }
        };
    }

    public generateRandomEnvironment(): Environment {
        return {
            temperature: Math.random() * 30 + 10,  // 10-40 C
            pressure: Math.random() * 20 + 990,    // 990-1010 hPa
            humidity: Math.random() * 100,         // 0-100%
            altitude: Math.random() * 1000,        // 0-1000m
            wind: {
                x: Math.random() * 10 - 5,         // -5 to 5 m/s
                y: 0,
                z: Math.random() * 10 - 5
            }
        };
    }

    public generateRandomBallProperties(): BallProperties {
        return {
            mass: 0.0459,                // kg
            radius: 0.0214,              // m
            area: Math.PI * 0.0214 * 0.0214,  // m^2
            dragCoefficient: 0.25,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.23,
            spinDecayRate: 0.15          // rad/s^2
        };
    }

    public simulateShot(
        conditions: LaunchConditions,
        environment: Environment,
        properties: BallProperties
    ): Promise<TrajectoryResult> {
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: {
                x: conditions.ballSpeed * Math.cos(conditions.launchAngle * Math.PI / 180) * Math.cos(conditions.launchDirection * Math.PI / 180),
                y: conditions.ballSpeed * Math.sin(conditions.launchAngle * Math.PI / 180),
                z: conditions.ballSpeed * Math.cos(conditions.launchAngle * Math.PI / 180) * Math.sin(conditions.launchDirection * Math.PI / 180)
            },
            spin: {
                rate: conditions.spinRate,
                axis: conditions.spinAxis
            },
            mass: properties.mass
        };

        return this.simulateFlight(initialState, environment, properties);
    }
}
