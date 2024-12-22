import {
    LaunchConditions,
    Environment,
    BallProperties,
    Trajectory,
    TrajectoryPoint,
    ValidationResult,
    ValidationCase,
    SurfaceEffects,
    BallState
} from './types';
import { FlightIntegrator } from './flight-integrator';

export class ValidationSystem {
    private readonly flightIntegrator: FlightIntegrator;

    // Validation constants
    private readonly MIN_BALL_SPEED = 22.352; // m/s (50 mph)
    private readonly MAX_BALL_SPEED = 89.4112; // m/s (200 mph)
    private readonly MIN_LAUNCH_ANGLE = -10; // degrees
    private readonly MAX_LAUNCH_ANGLE = 60; // degrees
    private readonly MIN_LAUNCH_DIRECTION = -90; // degrees
    private readonly MAX_LAUNCH_DIRECTION = 90; // degrees
    private readonly MIN_TOTAL_SPIN = 0; // rpm
    private readonly MAX_TOTAL_SPIN = 10000; // rpm
    private readonly MIN_SPIN_AXIS = -90; // degrees
    private readonly MAX_SPIN_AXIS = 90; // degrees

    private readonly MIN_TEMPERATURE = -28.89; // °C (-20°F)
    private readonly MAX_TEMPERATURE = 48.89; // °C (120°F)
    private readonly MAX_WIND_SPEED = 22.352; // m/s (50 mph)
    private readonly MIN_ALTITUDE = -304.8; // meters (-1000 feet)
    private readonly MAX_ALTITUDE = 4572; // meters (15000 feet)
    private readonly MIN_HUMIDITY = 0; // %
    private readonly MAX_HUMIDITY = 100; // %
    private readonly MIN_PRESSURE = 846.6; // hPa (25 inHg)
    private readonly MAX_PRESSURE = 1185.3; // hPa (35 inHg)

    private readonly MIN_MASS = 0.040; // kg (40 grams)
    private readonly MAX_MASS = 0.050; // kg (50 grams)
    private readonly MIN_DIAMETER = 0.04064; // meters (1.6 inches)
    private readonly MAX_DIAMETER = 0.04318; // meters (1.7 inches)
    private readonly MIN_DIMPLE_COUNT = 300;
    private readonly MAX_DIMPLE_COUNT = 500;
    private readonly MIN_DIMPLE_COVERAGE = 0.6;
    private readonly MAX_DIMPLE_COVERAGE = 0.9;
    private readonly MIN_DIMPLE_DEPTH = 0.000127; // meters (0.005 inches)
    private readonly MAX_DIMPLE_DEPTH = 0.000381; // meters (0.015 inches)
    private readonly MIN_COMPRESSION = 50;
    private readonly MAX_COMPRESSION = 120;

    constructor() {
        this.flightIntegrator = new FlightIntegrator();
    }

    /**
     * Validate launch conditions
     */
    private validateLaunchConditions(conditions: LaunchConditions): string[] {
        const errors: string[] = [];

        if (conditions.ballSpeed < this.MIN_BALL_SPEED || conditions.ballSpeed > this.MAX_BALL_SPEED) {
            errors.push(`Ball speed must be between ${this.MIN_BALL_SPEED} and ${this.MAX_BALL_SPEED} m/s`);
        }

        if (conditions.launchAngle < this.MIN_LAUNCH_ANGLE || conditions.launchAngle > this.MAX_LAUNCH_ANGLE) {
            errors.push(`Launch angle must be between ${this.MIN_LAUNCH_ANGLE} and ${this.MAX_LAUNCH_ANGLE} degrees`);
        }

        if (conditions.launchDirection < this.MIN_LAUNCH_DIRECTION || conditions.launchDirection > this.MAX_LAUNCH_DIRECTION) {
            errors.push(`Launch direction must be between ${this.MIN_LAUNCH_DIRECTION} and ${this.MAX_LAUNCH_DIRECTION} degrees`);
        }

        if (conditions.totalSpin < this.MIN_TOTAL_SPIN || conditions.totalSpin > this.MAX_TOTAL_SPIN) {
            errors.push(`Total spin must be between ${this.MIN_TOTAL_SPIN} and ${this.MAX_TOTAL_SPIN} rpm`);
        }

        if (conditions.spinAxis < this.MIN_SPIN_AXIS || conditions.spinAxis > this.MAX_SPIN_AXIS) {
            errors.push(`Spin axis must be between ${this.MIN_SPIN_AXIS} and ${this.MAX_SPIN_AXIS} degrees`);
        }

        return errors;
    }

    /**
     * Validate environment conditions
     */
    private validateEnvironment(env: Environment): string[] {
        const errors: string[] = [];

        if (env.temperature < this.MIN_TEMPERATURE || env.temperature > this.MAX_TEMPERATURE) {
            errors.push(`Temperature ${env.temperature}°C is outside valid range [${this.MIN_TEMPERATURE}, ${this.MAX_TEMPERATURE}]`);
        }

        if (env.pressure < this.MIN_PRESSURE || env.pressure > this.MAX_PRESSURE) {
            errors.push(`Pressure ${env.pressure} hPa is outside valid range [${this.MIN_PRESSURE}, ${this.MAX_PRESSURE}]`);
        }

        if (env.humidity < this.MIN_HUMIDITY || env.humidity > this.MAX_HUMIDITY) {
            errors.push(`Humidity ${env.humidity}% is outside valid range [${this.MIN_HUMIDITY}, ${this.MAX_HUMIDITY}]`);
        }

        if (env.altitude < this.MIN_ALTITUDE || env.altitude > this.MAX_ALTITUDE) {
            errors.push(`Altitude ${env.altitude}m is outside valid range [${this.MIN_ALTITUDE}, ${this.MAX_ALTITUDE}]`);
        }

        if (env.windSpeed < 0 || env.windSpeed > this.MAX_WIND_SPEED) {
            errors.push(`Wind speed ${env.windSpeed} m/s is outside valid range [0, ${this.MAX_WIND_SPEED}]`);
        }

        if (env.windDirection < 0 || env.windDirection >= 360) {
            errors.push(`Wind direction ${env.windDirection}° is outside valid range [0, 360)`);
        }

        if (env.timeOfDay && !['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'].includes(env.timeOfDay)) {
            errors.push(`Time of day ${env.timeOfDay} is not valid. Must be one of: dawn, morning, noon, afternoon, dusk, night`);
        }

        return errors;
    }

    /**
     * Validate ball properties
     */
    private validateBallProperties(props: BallProperties): string[] {
        const errors: string[] = [];

        if (props.mass < this.MIN_MASS || props.mass > this.MAX_MASS) {
            errors.push(`Mass must be between ${this.MIN_MASS} and ${this.MAX_MASS} kg`);
        }

        if (props.diameter < this.MIN_DIAMETER || props.diameter > this.MAX_DIAMETER) {
            errors.push(`Diameter must be between ${this.MIN_DIAMETER} and ${this.MAX_DIAMETER} meters`);
        }

        if (props.dimpleCount < this.MIN_DIMPLE_COUNT || props.dimpleCount > this.MAX_DIMPLE_COUNT) {
            errors.push(`Dimple count must be between ${this.MIN_DIMPLE_COUNT} and ${this.MAX_DIMPLE_COUNT}`);
        }

        if (!['circular', 'hexagonal', 'triangular'].includes(props.dimpleShape)) {
            errors.push('Invalid dimple shape');
        }

        if (!['icosahedral', 'octahedral', 'tetrahedral', 'hybrid'].includes(props.dimplePattern)) {
            errors.push('Invalid dimple pattern');
        }

        if (!['sharp', 'rounded', 'smooth'].includes(props.edgeProfile)) {
            errors.push('Invalid edge profile');
        }

        if (!['smooth', 'textured', 'rough'].includes(props.surfaceTexture)) {
            errors.push('Invalid surface texture');
        }

        if (!['2-piece', '3-piece', '4-piece', '5-piece'].includes(props.construction)) {
            errors.push('Invalid ball construction');
        }

        if (props.dimpleCoverage < this.MIN_DIMPLE_COVERAGE || props.dimpleCoverage > this.MAX_DIMPLE_COVERAGE) {
            errors.push(`Dimple coverage must be between ${this.MIN_DIMPLE_COVERAGE} and ${this.MAX_DIMPLE_COVERAGE}`);
        }

        if (props.dimpleDepth < this.MIN_DIMPLE_DEPTH || props.dimpleDepth > this.MAX_DIMPLE_DEPTH) {
            errors.push(`Dimple depth must be between ${this.MIN_DIMPLE_DEPTH} and ${this.MAX_DIMPLE_DEPTH} meters`);
        }

        if (props.compression < this.MIN_COMPRESSION || props.compression > this.MAX_COMPRESSION) {
            errors.push(`Compression must be between ${this.MIN_COMPRESSION} and ${this.MAX_COMPRESSION}`);
        }

        return errors;
    }

    /**
     * Validate trajectory points
     */
    private validateTrajectoryPoints(points: TrajectoryPoint[]): string[] {
        const errors: string[] = [];

        if (points.length === 0) {
            errors.push('Trajectory must contain at least one point');
            return errors;
        }

        let previousTime = points[0].t;
        for (let i = 1; i < points.length; i++) {
            const point = points[i];

            // Check time monotonicity
            if (point.t <= previousTime) {
                errors.push(`Time must be strictly increasing at point ${i}`);
            }
            previousTime = point.t;

            // Check for NaN or infinite values
            const values = [
                point.x, point.y, point.z,
                point.vx, point.vy, point.vz,
                point.wx, point.wy, point.wz
            ];

            if (values.some(v => isNaN(v) || !isFinite(v))) {
                errors.push(`Invalid numerical values at point ${i}`);
            }
        }

        return errors;
    }

    /**
     * Validate trajectory metrics
     */
    private validateTrajectoryMetrics(trajectory: Trajectory): string[] {
        const errors: string[] = [];

        if (trajectory.maxHeight < 0) {
            errors.push('Maximum height cannot be negative');
        }

        if (trajectory.carryDistance < 0) {
            errors.push('Carry distance cannot be negative');
        }

        if (trajectory.flightTime < 0) {
            errors.push('Flight time cannot be negative');
        }

        return errors;
    }

    public convertToInitialState(conditions: LaunchConditions, ballProperties: BallProperties): BallState {
        const speed = conditions.ballSpeed; // Already in m/s
        const angle = conditions.launchAngle * Math.PI / 180;
        const direction = conditions.launchDirection * Math.PI / 180;
        const spinAxis = conditions.spinAxis * Math.PI / 180;

        // Convert spin from rpm to rad/s
        const spinRateRadPerSec = conditions.totalSpin * 2 * Math.PI / 60;

        // Calculate spin components based on spin axis
        // spinAxis is 0 for pure backspin, positive for right spin, negative for left spin
        return {
            position: { x: 0, y: 0, z: 0 },
            velocity: {
                x: speed * Math.cos(angle) * Math.cos(direction),
                y: speed * Math.sin(angle),
                z: speed * Math.cos(angle) * Math.sin(direction)
            },
            spin: {
                // x component (sidespin) - positive is spin to the right
                x: spinRateRadPerSec * Math.sin(spinAxis),
                // y component (backspin/topspin) - positive is backspin
                y: spinRateRadPerSec * Math.cos(spinAxis),
                // z component is 0 (assuming no spin around the vertical axis)
                z: 0
            },
            mass: ballProperties.mass
        };
    }

    private validateTrajectory(
        conditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        const initialState = this.convertToInitialState(conditions, ballProperties);
        const trajectory = this.flightIntegrator.simulateFlight(
            initialState,
            environment,
            ballProperties
        );

        // Validate basic trajectory requirements
        if (trajectory.points.length < 2) {
            throw new Error('Invalid trajectory: must have at least 2 points');
        }

        // Validate that the ball actually moves
        const firstPoint = trajectory.points[0];
        const lastPoint = trajectory.points[trajectory.points.length - 1];
        const displacement = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) +
            Math.pow(lastPoint.y - firstPoint.y, 2) +
            Math.pow(lastPoint.z - firstPoint.z, 2)
        );

        if (displacement < 1.0) { // At least 1 meter of movement
            throw new Error('Invalid trajectory: ball must move at least 1 meter');
        }

        // Calculate and set trajectory metrics
        trajectory.carryDistance = displacement;
        trajectory.maxHeight = Math.max(...trajectory.points.map(p => p.y));
        trajectory.flightTime = lastPoint.t - firstPoint.t;
        trajectory.landingAngle = Math.atan2(-lastPoint.vy, Math.sqrt(lastPoint.vx * lastPoint.vx + lastPoint.vz * lastPoint.vz)) * 180 / Math.PI;
        trajectory.lateralDeviation = lastPoint.z;

        return trajectory;
    }

    /**
     * Validate all components
     */
    public validate(
        conditions: LaunchConditions,
        environment: Environment,
        ballProperties: BallProperties,
        trajectory: Trajectory
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate each component
        errors.push(...this.validateLaunchConditions(conditions));
        errors.push(...this.validateEnvironment(environment));
        errors.push(...this.validateBallProperties(ballProperties));
        errors.push(...this.validateTrajectoryPoints(trajectory.points));
        errors.push(...this.validateTrajectoryMetrics(trajectory));

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metrics: {
                carryDistance: trajectory.carryDistance,
                totalDistance: trajectory.totalDistance,
                maxHeight: trajectory.maxHeight,
                flightTime: trajectory.flightTime,
                spinRate: conditions.totalSpin,
                launchAngle: conditions.launchAngle
            }
        };
    }

    /**
     * Run validation case
     */
    public runValidationCase(testCase: ValidationCase): ValidationResult {
        const trajectory = this.validateTrajectory(
            testCase.conditions,
            testCase.environment,
            testCase.ballProperties
        );

        return this.validate(
            testCase.conditions,
            testCase.environment,
            testCase.ballProperties,
            trajectory
        );
    }

    /**
     * Validate model against test cases
     */
    public validateModel(testCases: ValidationCase[]): ValidationResult[] {
        return testCases.map(testCase => {
            try {
                const trajectory = this.validateTrajectory(
                    testCase.conditions,
                    testCase.environment,
                    testCase.ballProperties
                );

                const errors: string[] = [];
                const warnings: string[] = [];

                // Validate launch conditions
                const launchErrors = this.validateLaunchConditions(testCase.conditions);
                errors.push(...launchErrors);

                // Validate environment
                const envErrors = this.validateEnvironment(testCase.environment);
                errors.push(...envErrors);

                // Validate ball properties
                const ballErrors = this.validateBallProperties(testCase.ballProperties);
                errors.push(...ballErrors);

                // Validate trajectory points
                const trajectoryErrors = this.validateTrajectoryPoints(trajectory.points);
                errors.push(...trajectoryErrors);

                // Validate trajectory metrics
                const metricErrors = this.validateTrajectoryMetrics(trajectory);
                errors.push(...metricErrors);

                // Additional validation checks
                if (trajectory.carryDistance <= 0) {
                    errors.push('Invalid carry distance: must be positive');
                }
                if (trajectory.maxHeight <= 0) {
                    errors.push('Invalid max height: must be positive');
                }
                if (trajectory.flightTime <= 0) {
                    errors.push('Invalid flight time: must be positive');
                }

                // Check for reasonable values
                if (trajectory.carryDistance > 400) { // 400 meters is unreasonable
                    errors.push('Carry distance exceeds reasonable maximum');
                }
                if (trajectory.maxHeight > 100) { // 100 meters is unreasonable
                    errors.push('Max height exceeds reasonable maximum');
                }
                if (trajectory.flightTime > 15) { // 15 seconds is unreasonable
                    errors.push('Flight time exceeds reasonable maximum');
                }

                return {
                    isValid: errors.length === 0,
                    errors,
                    warnings,
                    metrics: {
                        carryDistance: trajectory.carryDistance,
                        totalDistance: trajectory.totalDistance,
                        maxHeight: trajectory.maxHeight,
                        flightTime: trajectory.flightTime,
                        spinRate: testCase.conditions.totalSpin,
                        launchAngle: testCase.conditions.launchAngle
                    }
                };
            } catch (error) {
                return {
                    isValid: false,
                    errors: [(error as Error).message],
                    warnings: [],
                    metrics: {
                        carryDistance: 0,
                        totalDistance: 0,
                        maxHeight: 0,
                        flightTime: 0,
                        spinRate: testCase.conditions.totalSpin,
                        launchAngle: testCase.conditions.launchAngle
                    }
                };
            }
        });
    }
}
