import {
    LaunchConditions,
    Environment,
    BallProperties,
    TrajectoryPoint,
    ValidationResult,
    ValidationCase,
    ValidationMetrics,
    TrajectoryResult,
    Vector3D,
    Forces,
    SpinState,
    BallState
} from './types';
import { FlightIntegrator } from './flight-integrator';

/**
 * Detailed validation metrics interface
 */
export interface DetailedValidationMetrics {
    carryDistance: {
        actual: number;
        expected: number;
        error: number;
        errorPercent: number;
    };
    maxHeight: {
        actual: number;
        expected: number;
        error: number;
        errorPercent: number;
    };
    flightTime: {
        actual: number;
        expected: number;
        error: number;
        errorPercent: number;
    };
    launchAngle: {
        actual: number;
        expected: number;
        error: number;
        errorPercent: number;
    };
    landingAngle: {
        actual: number;
        expected: number;
        error: number;
        errorPercent: number;
    };
    spinRate: {
        actual: number;
        expected: number;
        error: number;
        errorPercent: number;
    };
}

export class ValidationSystem {
    private readonly flightIntegrator: FlightIntegrator;

    // Validation thresholds (as percentages)
    private readonly METRIC_THRESHOLD = 0.20;  // 20% threshold for all metrics
    private readonly SPIN_RATE_THRESHOLD = 0.20;  // 20% threshold for spin rate
    private readonly R2_SCORE_THRESHOLD = 0.95;  // R² score threshold for trajectory shape

    constructor() {
        this.flightIntegrator = new FlightIntegrator();
    }

    /**
     * Validate launch conditions
     */
    private validateLaunchConditions(conditions: LaunchConditions): string[] {
        const errors: string[] = [];

        if (conditions.ballSpeed < 22.352 || conditions.ballSpeed > 89.4112) {
            errors.push(`Ball speed must be between 22.352 and 89.4112 m/s`);
        }

        if (conditions.launchAngle < -10 || conditions.launchAngle > 60) {
            errors.push(`Launch angle must be between -10 and 60 degrees`);
        }

        if (conditions.launchDirection < -90 || conditions.launchDirection > 90) {
            errors.push(`Launch direction must be between -90 and 90 degrees`);
        }

        if (conditions.spinRate < 0 || conditions.spinRate > 10000) {
            errors.push(`Spin rate must be between 0 and 10000 rpm`);
        }

        return errors;
    }

    /**
     * Validate environment conditions
     */
    private validateEnvironment(env: Environment): string[] {
        const errors: string[] = [];

        if (env.temperature < -28.89 || env.temperature > 48.89) {
            errors.push(`Temperature must be between -28.89 and 48.89 °C`);
        }

        if (env.pressure < 846.6 || env.pressure > 1185.3) {
            errors.push(`Pressure must be between 846.6 and 1185.3 hPa`);
        }

        if (env.humidity < 0 || env.humidity > 100) {
            errors.push(`Humidity must be between 0 and 100%`);
        }

        if (env.altitude < -304.8 || env.altitude > 4572) {
            errors.push(`Altitude must be between -304.8 and 4572 meters`);
        }

        const windSpeed = Math.sqrt(env.wind.x * env.wind.x + env.wind.y * env.wind.y + env.wind.z * env.wind.z);
        if (windSpeed > 22.352) {
            errors.push(`Wind speed must be less than 22.352 m/s`);
        }

        return errors;
    }

    /**
     * Validate ball properties
     */
    private validateBallProperties(props: BallProperties): string[] {
        const errors: string[] = [];

        if (props.mass < 0.040 || props.mass > 0.050) {
            errors.push(`Mass must be between 0.040 and 0.050 kg`);
        }

        if (props.radius < 0.02032 || props.radius > 0.02159) {
            errors.push(`Radius must be between 0.02032 and 0.02159 meters`);
        }

        if (props.dragCoefficient < 0.15 || props.dragCoefficient > 0.28) {
            errors.push(`Drag coefficient must be between 0.15 and 0.28`);
        }

        if (props.liftCoefficient < 0.15 || props.liftCoefficient > 0.25) {
            errors.push(`Lift coefficient must be between 0.15 and 0.25`);
        }

        if (props.spinDecayRate < 5 || props.spinDecayRate > 15) {
            errors.push(`Spin decay rate must be between 5 and 15 rpm/s`);
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

        let previousTime = points[0].time;
        for (let i = 1; i < points.length; i++) {
            const point = points[i];

            // Check time monotonicity
            if (point.time <= previousTime) {
                errors.push(`Time must be strictly increasing at point ${i}`);
            }

            previousTime = point.time;
        }

        return errors;
    }

    /**
     * Calculate R² score for trajectory shape validation
     */
    private calculateR2Score(actual: TrajectoryPoint[], expected: TrajectoryPoint[], mass: number): number {
        if (actual.length === 0 || expected.length === 0) {
            return 0;
        }

        // Interpolate points to ensure same number of samples
        const interpolatedExpected = this.interpolateTrajectory(expected, actual.length, mass);
        
        // Calculate R² score for each dimension
        const r2X = this.calculateDimensionR2(actual.map(p => p.position.x), interpolatedExpected.map(p => p.position.x));
        const r2Y = this.calculateDimensionR2(actual.map(p => p.position.y), interpolatedExpected.map(p => p.position.y));
        const r2Z = this.calculateDimensionR2(actual.map(p => p.position.z), interpolatedExpected.map(p => p.position.z));
        
        // Return average R² score
        return (r2X + r2Y + r2Z) / 3;
    }

    /**
     * Calculate R² score for a single dimension
     */
    private calculateDimensionR2(actual: number[], predicted: number[]): number {
        const mean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
        const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
        const ssResidual = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
        return 1 - (ssResidual / ssTotal);
    }

    /**
     * Interpolate trajectory points to match target length
     */
    private interpolateTrajectory(points: TrajectoryPoint[], targetLength: number, initialMass: number): TrajectoryPoint[] {
        const result: TrajectoryPoint[] = [];
        const timeStep = points[points.length - 1].time / (targetLength - 1);

        for (let i = 0; i < targetLength; i++) {
            const time = i * timeStep;
            const interpolated = this.interpolatePoint(points, time, initialMass);
            result.push(interpolated);
        }

        return result;
    }

    /**
     * Interpolate a single trajectory point
     */
    private interpolatePoint(points: TrajectoryPoint[], time: number, mass: number): TrajectoryPoint {
        // Find surrounding points
        let i = 1;
        while (i < points.length && points[i].time < time) i++;
        const t1 = points[i - 1].time;
        const t2 = points[i].time;
        const alpha = (time - t1) / (t2 - t1);

        // Linear interpolation of all properties
        const p1 = points[i - 1];
        const p2 = points[i];

        const spin: SpinState = {
            axis: {
                x: this.lerp(p1.spin.axis.x, p2.spin.axis.x, alpha),
                y: this.lerp(p1.spin.axis.y, p2.spin.axis.y, alpha),
                z: this.lerp(p1.spin.axis.z, p2.spin.axis.z, alpha)
            },
            rate: this.lerp(p1.spin.rate, p2.spin.rate, alpha)
        };

        const forces: Forces = {
            drag: {
                x: this.lerp(p1.forces.drag.x, p2.forces.drag.x, alpha),
                y: this.lerp(p1.forces.drag.y, p2.forces.drag.y, alpha),
                z: this.lerp(p1.forces.drag.z, p2.forces.drag.z, alpha)
            },
            lift: {
                x: this.lerp(p1.forces.lift.x, p2.forces.lift.x, alpha),
                y: this.lerp(p1.forces.lift.y, p2.forces.lift.y, alpha),
                z: this.lerp(p1.forces.lift.z, p2.forces.lift.z, alpha)
            },
            magnus: {
                x: this.lerp(p1.forces.magnus.x, p2.forces.magnus.x, alpha),
                y: this.lerp(p1.forces.magnus.y, p2.forces.magnus.y, alpha),
                z: this.lerp(p1.forces.magnus.z, p2.forces.magnus.z, alpha)
            },
            gravity: {
                x: this.lerp(p1.forces.gravity.x, p2.forces.gravity.x, alpha),
                y: this.lerp(p1.forces.gravity.y, p2.forces.gravity.y, alpha),
                z: this.lerp(p1.forces.gravity.z, p2.forces.gravity.z, alpha)
            }
        };

        // Create base ball state
        const ballState: BallState = {
            position: {
                x: this.lerp(p1.position.x, p2.position.x, alpha),
                y: this.lerp(p1.position.y, p2.position.y, alpha),
                z: this.lerp(p1.position.z, p2.position.z, alpha)
            },
            velocity: {
                x: this.lerp(p1.velocity.x, p2.velocity.x, alpha),
                y: this.lerp(p1.velocity.y, p2.velocity.y, alpha),
                z: this.lerp(p1.velocity.z, p2.velocity.z, alpha)
            },
            spin,
            mass // Use the passed mass parameter
        };

        // Extend to trajectory point
        return {
            ...ballState,
            time,
            forces
        };
    }

    /**
     * Linear interpolation helper
     */
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    /**
     * Calculate detailed validation metrics
     */
    private calculateDetailedMetrics(actual: ValidationMetrics, expected: ValidationMetrics): DetailedValidationMetrics {
        const calculateError = (actual: number, expected: number) => ({
            actual,
            expected,
            error: Math.abs(actual - expected),
            errorPercent: Math.abs((actual - expected) / expected) * 100
        });

        return {
            carryDistance: calculateError(actual.carryDistance, expected.carryDistance),
            maxHeight: calculateError(actual.maxHeight, expected.maxHeight),
            flightTime: calculateError(actual.flightTime, expected.flightTime),
            launchAngle: calculateError(actual.launchAngle, expected.launchAngle),
            landingAngle: calculateError(actual.landingAngle, expected.landingAngle),
            spinRate: calculateError(actual.spinRate, expected.spinRate)
        };
    }

    /**
     * Format detailed error message
     */
    private formatDetailedError(metric: string, detail: { actual: number; expected: number; error: number; errorPercent: number }, units: string): string {
        return `${metric}:
    Actual: ${detail.actual.toFixed(2)}${units}
    Expected: ${detail.expected.toFixed(2)}${units}
    Error: ${detail.error.toFixed(2)}${units} (${detail.errorPercent.toFixed(1)}%)
    Threshold: ${(this.METRIC_THRESHOLD * 100).toFixed(1)}%`;
    }

    /**
     * Validate a trajectory against expected metrics
     */
    public validateTrajectory(validationCase: ValidationCase): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!validationCase.trajectory) {
            errors.push('No trajectory data provided');
            return { isValid: false, errors, warnings, trajectory: validationCase.trajectory };
        }

        const { expectedMetrics } = validationCase;
        const actualMetrics = validationCase.trajectory.metrics;

        if (!actualMetrics || !expectedMetrics) {
            errors.push('Missing metrics data');
            return { isValid: false, errors, warnings, trajectory: validationCase.trajectory };
        }

        // Calculate detailed metrics
        const detailedMetrics = this.calculateDetailedMetrics(actualMetrics, expectedMetrics);
        const failedMetrics: string[] = [];

        // Check each metric
        if (detailedMetrics.carryDistance.errorPercent > this.METRIC_THRESHOLD * 100) {
            failedMetrics.push(this.formatDetailedError('Carry Distance', detailedMetrics.carryDistance, 'm'));
        }

        if (detailedMetrics.maxHeight.errorPercent > this.METRIC_THRESHOLD * 100) {
            failedMetrics.push(this.formatDetailedError('Max Height', detailedMetrics.maxHeight, 'm'));
        }

        if (detailedMetrics.flightTime.errorPercent > this.METRIC_THRESHOLD * 100) {
            failedMetrics.push(this.formatDetailedError('Flight Time', detailedMetrics.flightTime, 's'));
        }

        if (detailedMetrics.launchAngle.errorPercent > this.METRIC_THRESHOLD * 100) {
            failedMetrics.push(this.formatDetailedError('Launch Angle', detailedMetrics.launchAngle, '°'));
        }

        if (detailedMetrics.landingAngle.errorPercent > this.METRIC_THRESHOLD * 100) {
            failedMetrics.push(this.formatDetailedError('Landing Angle', detailedMetrics.landingAngle, '°'));
        }

        if (detailedMetrics.spinRate.errorPercent > this.SPIN_RATE_THRESHOLD * 100) {
            failedMetrics.push(this.formatDetailedError('Spin Rate', detailedMetrics.spinRate, 'rpm'));
        }

        // Add detailed error report if any metrics failed
        if (failedMetrics.length > 0) {
            errors.push('Validation Failed:\n' + failedMetrics.join('\n\n'));
        }

        // Add warnings for metrics close to thresholds
        this.addWarningsForNearThresholds(actualMetrics, expectedMetrics, warnings);

        // Get mass from initial state for trajectory comparison
        const mass = validationCase.initialState.mass;

        // Calculate R² score for trajectory shape
        const r2Score = this.calculateR2Score(
            validationCase.trajectory.points,
            validationCase.expectedTrajectory?.points || [],
            mass
        );
        
        if (r2Score < this.R2_SCORE_THRESHOLD) {
            errors.push(`Trajectory Shape Validation:
    R² Score: ${r2Score.toFixed(3)}
    Threshold: ${this.R2_SCORE_THRESHOLD}
    Note: Lower R² score indicates poor trajectory shape matching`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            trajectory: validationCase.trajectory
        };
    }

    /**
     * Add warnings for metrics that are close to their thresholds
     */
    private addWarningsForNearThresholds(actual: ValidationMetrics, expected: ValidationMetrics, warnings: string[]): void {
        const WARNING_THRESHOLD = 0.8; // 80% of error threshold

        const checkNearThreshold = (value: number, threshold: number, metric: string) => {
            if (value > threshold * WARNING_THRESHOLD) {
                warnings.push(`${metric} is within ${((1 - value/threshold) * 100).toFixed(1)}% of threshold`);
            }
        };

        checkNearThreshold(Math.abs(actual.carryDistance - expected.carryDistance), this.METRIC_THRESHOLD, "Carry distance");
        checkNearThreshold(Math.abs(actual.maxHeight - expected.maxHeight), this.METRIC_THRESHOLD, "Max height");
        checkNearThreshold(Math.abs(actual.flightTime - expected.flightTime), this.METRIC_THRESHOLD, "Flight time");
        checkNearThreshold(Math.abs(actual.launchAngle - expected.launchAngle), this.METRIC_THRESHOLD, "Launch angle");
        checkNearThreshold(Math.abs(actual.landingAngle - expected.landingAngle), this.METRIC_THRESHOLD, "Landing angle");
        checkNearThreshold(Math.abs(actual.spinRate - expected.spinRate), this.SPIN_RATE_THRESHOLD, "Spin rate");
    }

    /**
     * Validate multiple trajectories
     */
    public validateBatch(cases: ValidationCase[]): ValidationResult[] {
        return cases.map(validationCase => this.validateTrajectory(validationCase));
    }
}
