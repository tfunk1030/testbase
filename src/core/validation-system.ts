import {
    LaunchConditions,
    Environment,
    BallProperties,
    Trajectory,
    TrajectoryPoint,
    ValidationResult,
    ValidationCase
} from './types';
import { FlightIntegrator } from './flight-integrator';

export class ValidationSystem {
    private readonly flightIntegrator: FlightIntegrator;

    // Validation constants
    private readonly MIN_BALL_SPEED = 50; // mph
    private readonly MAX_BALL_SPEED = 200; // mph
    private readonly MIN_LAUNCH_ANGLE = -10; // degrees
    private readonly MAX_LAUNCH_ANGLE = 60; // degrees
    private readonly MIN_LAUNCH_DIRECTION = -90; // degrees
    private readonly MAX_LAUNCH_DIRECTION = 90; // degrees
    private readonly MIN_TOTAL_SPIN = 0; // rpm
    private readonly MAX_TOTAL_SPIN = 10000; // rpm
    private readonly MIN_SPIN_AXIS = -90; // degrees
    private readonly MAX_SPIN_AXIS = 90; // degrees

    private readonly MIN_TEMPERATURE = -20; // °F
    private readonly MAX_TEMPERATURE = 120; // °F
    private readonly MAX_WIND_SPEED = 50; // mph
    private readonly MIN_ALTITUDE = -1000; // feet
    private readonly MAX_ALTITUDE = 15000; // feet
    private readonly MIN_HUMIDITY = 0; // %
    private readonly MAX_HUMIDITY = 100; // %
    private readonly MIN_PRESSURE = 25; // inHg
    private readonly MAX_PRESSURE = 35; // inHg

    private readonly MIN_MASS = 40; // grams
    private readonly MAX_MASS = 50; // grams
    private readonly MIN_DIAMETER = 1.6; // inches
    private readonly MAX_DIAMETER = 1.7; // inches
    private readonly MIN_DIMPLE_COUNT = 300;
    private readonly MAX_DIMPLE_COUNT = 500;
    private readonly MIN_DIMPLE_COVERAGE = 0.6;
    private readonly MAX_DIMPLE_COVERAGE = 0.9;
    private readonly MIN_DIMPLE_DEPTH = 0.005; // inches
    private readonly MAX_DIMPLE_DEPTH = 0.015; // inches
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
            errors.push(`Ball speed must be between ${this.MIN_BALL_SPEED} and ${this.MAX_BALL_SPEED} mph`);
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
            errors.push(`Temperature must be between ${this.MIN_TEMPERATURE} and ${this.MAX_TEMPERATURE} °F`);
        }

        if (env.windSpeed < 0 || env.windSpeed > this.MAX_WIND_SPEED) {
            errors.push(`Wind speed must be between 0 and ${this.MAX_WIND_SPEED} mph`);
        }

        if (env.windDirection < -180 || env.windDirection > 180) {
            errors.push('Wind direction must be between -180 and 180 degrees');
        }

        if (env.altitude < this.MIN_ALTITUDE || env.altitude > this.MAX_ALTITUDE) {
            errors.push(`Altitude must be between ${this.MIN_ALTITUDE} and ${this.MAX_ALTITUDE} feet`);
        }

        if (env.humidity < this.MIN_HUMIDITY || env.humidity > this.MAX_HUMIDITY) {
            errors.push(`Humidity must be between ${this.MIN_HUMIDITY} and ${this.MAX_HUMIDITY}%`);
        }

        if (env.pressure < this.MIN_PRESSURE || env.pressure > this.MAX_PRESSURE) {
            errors.push(`Pressure must be between ${this.MIN_PRESSURE} and ${this.MAX_PRESSURE} inHg`);
        }

        if (!['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'].includes(env.timeOfDay)) {
            errors.push('Invalid time of day');
        }

        return errors;
    }

    /**
     * Validate ball properties
     */
    private validateBallProperties(props: BallProperties): string[] {
        const errors: string[] = [];

        if (props.mass < this.MIN_MASS || props.mass > this.MAX_MASS) {
            errors.push(`Mass must be between ${this.MIN_MASS} and ${this.MAX_MASS} grams`);
        }

        if (props.diameter < this.MIN_DIAMETER || props.diameter > this.MAX_DIAMETER) {
            errors.push(`Diameter must be between ${this.MIN_DIAMETER} and ${this.MAX_DIAMETER} inches`);
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
            errors.push(`Dimple depth must be between ${this.MIN_DIMPLE_DEPTH} and ${this.MAX_DIMPLE_DEPTH} inches`);
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
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Run validation case
     */
    public runValidationCase(testCase: ValidationCase): ValidationResult {
        const trajectory = this.flightIntegrator.integrate(
            {
                position: { x: 0, y: 0, z: 0 },
                velocity: {
                    x: testCase.conditions.ballSpeed * Math.cos(testCase.conditions.launchAngle * Math.PI / 180),
                    y: testCase.conditions.ballSpeed * Math.sin(testCase.conditions.launchAngle * Math.PI / 180),
                    z: 0
                },
                spin: {
                    x: testCase.conditions.totalSpin * Math.cos(testCase.conditions.spinAxis * Math.PI / 180),
                    y: 0,
                    z: testCase.conditions.totalSpin * Math.sin(testCase.conditions.spinAxis * Math.PI / 180)
                },
                mass: testCase.ballProperties.mass
            },
            testCase.environment,
            testCase.ballProperties,
            { dragModifier: 1.0, liftModifier: 1.0 }
        );

        return this.validate(
            testCase.conditions,
            testCase.environment,
            testCase.ballProperties,
            trajectory
        );
    }
}
