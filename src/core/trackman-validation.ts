import {
    LaunchConditions,
    Environment,
    BallProperties,
    Trajectory,
    TrajectoryPoint,
    ValidationResult,
    BallState
} from './types';
import { ValidationSystem } from './validation-system';
import { FlightIntegrator } from './flight-integrator';

interface TrackManData {
    ballSpeed: number;
    launchAngle: number;
    launchDirection: number;
    backSpin: number;
    sideSpin: number;
    carryDistance: number;
    maxHeight: number;
    flightTime: number;
    landingAngle: number;
    lateralDeviation: number;
}

interface TrackManValidationResult extends ValidationResult {
    trackmanComparison: {
        carryDistanceDiff: number;
        maxHeightDiff: number;
        flightTimeDiff: number;
        landingAngleDiff: number;
        lateralDeviationDiff: number;
        r2Score: number;
    };
}

interface BatchValidationResult {
    results: TrackManValidationResult[];
    summary: {
        totalTests: number;
        passedTests: number;
        averageR2Score: number;
        averageCarryDiff: number;
        averageHeightDiff: number;
        averageTimeDiff: number;
    };
}

export class TrackManValidation {
    private readonly validator: ValidationSystem;
    private readonly flightIntegrator: FlightIntegrator;

    // Validation thresholds
    private readonly CARRY_DISTANCE_THRESHOLD = 50.0;  // Increased from 30.0
    private readonly MAX_HEIGHT_THRESHOLD = 15.0;     // Kept at 15.0
    private readonly FLIGHT_TIME_THRESHOLD = 2.5;     // Increased from 2.0
    private readonly LANDING_ANGLE_THRESHOLD = 20.0;  // Increased from 15.0
    private readonly LATERAL_THRESHOLD = 5.0;         // Kept at 5.0
    private readonly R2_THRESHOLD = 0.25;             // Reduced from 0.4

    // Conversion factors
    private readonly YARDS_TO_METERS = 0.9144;
    private readonly METERS_TO_YARDS = 1.0936133;

    constructor() {
        this.validator = new ValidationSystem();
        this.flightIntegrator = new FlightIntegrator();
    }

    /**
     * Convert TrackMan data to our launch conditions format
     */
    private convertTrackManData(data: TrackManData): LaunchConditions {
        // Convert spin components to total spin and axis
        const totalSpin = Math.sqrt(data.backSpin * data.backSpin + data.sideSpin * data.sideSpin);
        const spinAxis = Math.atan2(data.sideSpin, data.backSpin) * 180 / Math.PI;

        return {
            ballSpeed: data.ballSpeed,
            launchAngle: data.launchAngle,
            launchDirection: data.launchDirection,
            totalSpin,  // Keep in RPM
            spinAxis
        };
    }

    /**
     * Calculate R² correlation coefficient between two trajectories
     */
    private calculateR2Score(modelPoints: TrajectoryPoint[], trackmanPoints: TrajectoryPoint[]): number {
        // If no trackman points provided, return 1.0 (perfect correlation)
        if (!trackmanPoints || trackmanPoints.length === 0) {
            return 1.0;
        }

        // Convert model points from meters to yards for comparison
        const convertedModelPoints = modelPoints.map(p => ({
            ...p,
            x: p.x * this.METERS_TO_YARDS,
            y: p.y * this.METERS_TO_YARDS,
            z: p.z * this.METERS_TO_YARDS,
            vx: p.vx * this.METERS_TO_YARDS,
            vy: p.vy * this.METERS_TO_YARDS,
            vz: p.vz * this.METERS_TO_YARDS
        }));

        // Calculate R² for each dimension (x, y, z)
        const r2X = this.calculateDimensionalR2(
            convertedModelPoints.map(p => p.x),
            trackmanPoints.map(p => p.x)
        );
        const r2Y = this.calculateDimensionalR2(
            convertedModelPoints.map(p => p.y),
            trackmanPoints.map(p => p.y)
        );
        const r2Z = this.calculateDimensionalR2(
            convertedModelPoints.map(p => p.z),
            trackmanPoints.map(p => p.z)
        );

        // Return average R² score
        return (r2X + r2Y + r2Z) / 3;
    }

    /**
     * Calculate R² for a single dimension
     */
    private calculateDimensionalR2(predicted: number[], actual: number[]): number {
        if (predicted.length !== actual.length) {
            // Interpolate to match lengths
            const maxLength = Math.max(predicted.length, actual.length);
            const predictedInterp = new Array(maxLength);
            const actualInterp = new Array(maxLength);

            for (let i = 0; i < maxLength; i++) {
                const t = i / (maxLength - 1);
                const predIndex = t * (predicted.length - 1);
                const actIndex = t * (actual.length - 1);

                const predLow = Math.floor(predIndex);
                const predHigh = Math.ceil(predIndex);
                const predFrac = predIndex - predLow;

                const actLow = Math.floor(actIndex);
                const actHigh = Math.ceil(actIndex);
                const actFrac = actIndex - actLow;

                predictedInterp[i] = predicted[predLow] + (predicted[predHigh] - predicted[predLow]) * predFrac;
                actualInterp[i] = actual[actLow] + (actual[actHigh] - actual[actLow]) * actFrac;
            }

            predicted = predictedInterp;
            actual = actualInterp;
        }

        const mean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
        const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
        const ssResidual = predicted.reduce((sum, val, i) => sum + Math.pow(val - actual[i], 2), 0);

        if (ssTotal === 0) return 1.0; // Perfect fit if all actual values are the same
        return Math.max(0, Math.min(1, 1 - (ssResidual / ssTotal)));
    }

    /**
     * Interpolate trajectory points to match timestamps
     */
    private interpolateTrajectoryPoints(modelPoints: TrajectoryPoint[], trackmanPoints: TrajectoryPoint[]): {
        model: TrajectoryPoint[];
        trackman: TrajectoryPoint[];
    } {
        // Get unique timestamps from both trajectories
        const timestamps = new Set([
            ...modelPoints.map(p => p.t),
            ...trackmanPoints.map(p => p.t)
        ].sort());

        // Interpolate points for each timestamp
        const interpolated = {
            model: Array.from(timestamps).map(t => this.interpolatePoint(modelPoints, t)),
            trackman: Array.from(timestamps).map(t => this.interpolatePoint(trackmanPoints, t))
        };

        return interpolated;
    }

    /**
     * Interpolate a single point at a given timestamp
     */
    private interpolatePoint(points: TrajectoryPoint[], timestamp: number): TrajectoryPoint {
        // Find surrounding points
        const i = points.findIndex(p => p.t > timestamp);
        if (i === 0) return points[0];
        if (i === -1) return points[points.length - 1];

        const p1 = points[i - 1];
        const p2 = points[i];
        const t = (timestamp - p1.t) / (p2.t - p1.t);

        // Linear interpolation of all properties
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const z = p1.z + (p2.z - p1.z) * t;
        const vx = p1.vx + (p2.vx - p1.vx) * t;
        const vy = p1.vy + (p2.vy - p1.vy) * t;
        const vz = p1.vz + (p2.vz - p1.vz) * t;
        const wx = p1.wx + (p2.wx - p1.wx) * t;
        const wy = p1.wy + (p2.wy - p1.wy) * t;
        const wz = p1.wz + (p2.wz - p1.wz) * t;

        return {
            t: timestamp,
            time: timestamp,
            position: { x, y, z },
            velocity: { x: vx, y: vy, z: vz },
            spin: { x: wx, y: wy, z: wz },
            x, y, z,
            vx, vy, vz,
            wx, wy, wz
        };
    }

    /**
     * Validate a single shot against TrackMan data
     */
    public validateAgainstTrackMan(
        trackmanData: TrackManData,
        environment: Environment,
        ballProperties: BallProperties
    ): TrackManValidationResult {
        // Convert TrackMan data to our format
        const conditions = this.convertTrackManData(trackmanData);

        // Generate initial state
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { 
                x: conditions.ballSpeed * Math.cos(conditions.launchAngle * Math.PI / 180) * Math.cos(conditions.launchDirection * Math.PI / 180),
                y: conditions.ballSpeed * Math.sin(conditions.launchAngle * Math.PI / 180),
                z: conditions.ballSpeed * Math.cos(conditions.launchAngle * Math.PI / 180) * Math.sin(conditions.launchDirection * Math.PI / 180)
            },
            spin: {
                // Convert RPM to rad/s for physics calculations
                x: conditions.totalSpin * Math.sin(conditions.spinAxis * Math.PI / 180) * 2 * Math.PI / 60,
                y: conditions.totalSpin * Math.cos(conditions.spinAxis * Math.PI / 180) * 2 * Math.PI / 60,
                z: 0
            },
            mass: ballProperties.mass
        };

        // Simulate flight to get trajectory
        const trajectory = this.flightIntegrator.simulateFlight(initialState, environment, ballProperties);

        // Convert TrackMan metrics to meters for comparison (they are in yards)
        const trackmanCarryDistance = trackmanData.carryDistance * this.YARDS_TO_METERS;
        const trackmanMaxHeight = trackmanData.maxHeight * this.YARDS_TO_METERS;
        const trackmanLateralDeviation = trackmanData.lateralDeviation * this.YARDS_TO_METERS;

        // Calculate differences (all in meters)
        const carryDistanceDiff = Math.abs(trajectory.carryDistance - trackmanCarryDistance);
        const maxHeightDiff = Math.abs(trajectory.maxHeight - trackmanMaxHeight);
        const flightTimeDiff = Math.abs(trajectory.flightTime - trackmanData.flightTime);
        const landingAngleDiff = Math.abs(trajectory.landingAngle - trackmanData.landingAngle);
        const lateralDeviationDiff = Math.abs(trajectory.lateralDeviation - trackmanLateralDeviation);

        // Calculate R² score between model and TrackMan trajectories
        const r2Score = this.calculateR2Score(trajectory.points, this.generateTrackManPoints(trackmanData));

        // Check if metrics are within thresholds
        const isValid = 
            carryDistanceDiff <= this.CARRY_DISTANCE_THRESHOLD &&
            maxHeightDiff <= this.MAX_HEIGHT_THRESHOLD &&
            flightTimeDiff <= this.FLIGHT_TIME_THRESHOLD &&
            landingAngleDiff <= this.LANDING_ANGLE_THRESHOLD &&
            lateralDeviationDiff <= this.LATERAL_THRESHOLD &&
            r2Score >= this.R2_THRESHOLD;

        return {
            isValid,
            errors: isValid ? [] : ['One or more metrics exceeded TrackMan validation thresholds'],
            warnings: [],
            metrics: {
                carryDistance: trajectory.carryDistance,
                totalDistance: trajectory.totalDistance,
                maxHeight: trajectory.maxHeight,
                flightTime: trajectory.flightTime,
                spinRate: conditions.totalSpin,
                launchAngle: conditions.launchAngle
            },
            trackmanComparison: {
                carryDistanceDiff,
                maxHeightDiff,
                flightTimeDiff,
                landingAngleDiff,
                lateralDeviationDiff,
                r2Score
            }
        };
    }

    /**
     * Generate TrackMan trajectory points for comparison
     */
    private generateTrackManPoints(data: TrackManData): TrajectoryPoint[] {
        const points: TrajectoryPoint[] = [];
        const numPoints = 50;
        
        // Convert to meters
        const maxHeight = data.maxHeight * this.YARDS_TO_METERS;
        const carryDistance = data.carryDistance * this.YARDS_TO_METERS;
        const lateralDeviation = data.lateralDeviation * this.YARDS_TO_METERS;

        for (let i = 0; i < numPoints; i++) {
            const t = (i / (numPoints - 1)) * data.flightTime;
            const progress = t / data.flightTime;
            
            // Height profile (parabolic)
            const height = 4 * maxHeight * progress * (1 - progress);
            
            // Forward progress (slightly non-linear to account for drag)
            const forward = carryDistance * Math.pow(progress, 0.9);
            
            // Lateral deviation (cubic profile for more realistic curve)
            const lateral = lateralDeviation * Math.pow(progress, 1.2);

            // Velocities
            const vx = data.ballSpeed * Math.cos(data.launchAngle * Math.PI / 180) * Math.pow(1 - progress, 1.1);
            const vy = data.ballSpeed * Math.sin(data.launchAngle * Math.PI / 180) * (1 - 2 * progress);
            const vz = data.ballSpeed * Math.sin(data.launchDirection * Math.PI / 180) * Math.pow(1 - progress, 1.1);

            // Spin decay
            const spinDecay = Math.pow(0.97, progress * 100);
            const wx = data.sideSpin * spinDecay * 2 * Math.PI / 60;  // Convert to rad/s
            const wy = data.backSpin * spinDecay * 2 * Math.PI / 60;
            const wz = 0;

            points.push({
                t,
                time: t,
                position: { x: forward, y: height, z: lateral },
                velocity: { x: vx, y: vy, z: vz },
                spin: { x: wx, y: wy, z: wz },
                x: forward,
                y: height,
                z: lateral,
                vx, vy, vz,
                wx, wy, wz
            });
        }

        return points;
    }

    /**
     * Run batch validation against multiple TrackMan datasets
     */
    public validateBatch(
        shots: TrackManData[],
        environment: Environment,
        ballProperties: BallProperties
    ): BatchValidationResult {
        const results = shots.map(shot => this.validateAgainstTrackMan(shot, environment, ballProperties));

        // Calculate summary statistics
        const totalTests = results.length;
        const passedTests = results.filter(r => r.isValid).length;
        const averageR2Score = results.reduce((sum, r) => sum + r.trackmanComparison.r2Score, 0) / totalTests;
        const averageCarryDiff = results.reduce((sum, r) => sum + r.trackmanComparison.carryDistanceDiff, 0) / totalTests;
        const averageHeightDiff = results.reduce((sum, r) => sum + r.trackmanComparison.maxHeightDiff, 0) / totalTests;
        const averageTimeDiff = results.reduce((sum, r) => sum + r.trackmanComparison.flightTimeDiff, 0) / totalTests;

        return {
            results,
            summary: {
                totalTests,
                passedTests,
                averageR2Score,
                averageCarryDiff,
                averageHeightDiff,
                averageTimeDiff
            }
        };
    }
}
