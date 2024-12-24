// Vector in 3D space
export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

// Spin state
export interface SpinState {
    rate: number;  // RPM
    axis: Vector3D;
}

// Memory usage metrics
export interface MemoryUsage {
    total: number;
    used: number;
    free: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    gc: {
        collections: number;
        pauseTime: number;
        type: string;
    }[];
}

// Resource metrics
export interface ResourceMetrics {
    cpu: {
        usage: number;
        kernelTime: number;
        userTime: number;
    };
    memory: MemoryUsage;
    io: {
        reads: number;
        writes: number;
        bytesRead: number;
        bytesWritten: number;
    };
}

// Forces acting on the ball
export interface Forces {
    drag: Vector3D;
    lift: Vector3D;
    magnus: Vector3D;
    gravity: Vector3D;
}

// Ball properties
export interface BallProperties {
    mass: number;
    radius: number;
    area: number;
    dragCoefficient: number;
    liftCoefficient: number;
    magnusCoefficient: number;
    spinDecayRate: number;
}

// Ball state
export interface BallState {
    position: Vector3D;
    velocity: Vector3D;
    spin: SpinState;
    mass: number;  // kg
}

// Environment conditions
export interface Environment {
    temperature: number;  // Celsius
    pressure: number;     // Pa
    humidity: number;     // 0-1
    altitude: number;     // meters
    wind: Vector3D;      // m/s
}

// Trajectory point
export interface TrajectoryPoint {
    time: number;
    position: Vector3D;
    velocity: Vector3D;
    spin: SpinState;
    forces: Forces;
}

// Expected metrics for validation
export interface ValidationMetrics {
    carryDistance: number;  // meters
    maxHeight: number;      // meters
    flightTime: number;     // seconds
    launchAngle: number;    // degrees
    landingAngle: number;   // degrees
    spinRate: number;       // RPM
}

// Trajectory result
export interface TrajectoryResult {
    points: TrajectoryPoint[];
    metrics?: ValidationMetrics;
}

// Launch conditions
export interface LaunchConditions {
    ballSpeed: number;  // m/s
    launchAngle: number;  // degrees
    launchDirection: number;  // degrees
    spinRate: number;  // rpm
    spinAxis: Vector3D;  // normalized
}

// Validation case
export interface ValidationCase {
    initialState: BallState;
    environment: Environment;
    properties: BallProperties;
    expectedMetrics?: ValidationMetrics;
    expectedTrajectory?: TrajectoryResult;
    trajectory?: TrajectoryResult;
    clubType?: ClubType;
    aerodynamicsEngine: AerodynamicsEngine;
}

// Validation error
export interface ValidationError {
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
}

// Validation result
export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
    metrics?: ValidationMetrics;
    trajectory?: TrajectoryResult;
    detailedMetrics?: {
        carryDistanceError: number;
        maxHeightError: number;
        flightTimeError: number;
        launchAngleError: number;
        landingAngleError: number;
        spinRateError: number;
    };
}

// Dataset for training
export interface DataSet {
    inputs: {
        launchConditions: LaunchConditions;
        environment: Environment;
        ballProperties: BallProperties;
    }[];
    outputs: {
        trajectory: TrajectoryResult;
        metrics: ValidationMetrics;
    }[];
}

// Surface effects
export interface SurfaceEffects {
    roughness: number;  // Surface roughness factor (0-1)
    friction: number;   // Surface friction coefficient
    elasticity: number; // Coefficient of restitution
    slope: Vector3D;    // Surface slope (degrees)
}

// Aerodynamics engine
export interface AerodynamicsEngine {
    calculateForces(
        velocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        environment: Environment
    ): Forces;
}

// Club type
export type ClubType = 'driver' | 'iron' | 'wedge';

// Club specifications
export interface ClubSpecifications {
    type: ClubType;
    loft: number;         // degrees
    lieAngle: number;     // degrees
    length: number;       // inches
    weight: number;       // grams
    swingWeight: string;  // e.g., "D2"
    flex: string;        // e.g., "Regular", "Stiff"
}

// Club-specific launch conditions
export interface ClubLaunchConditions extends LaunchConditions {
    clubType: ClubType;
    clubSpeed: number;    // m/s
    attackAngle: number;  // degrees
    pathAngle: number;    // degrees
    faceAngle: number;    // degrees
    impactLocation: Vector3D;  // relative to club face center
}

// Club-specific validation case
export interface ClubValidationCase extends ValidationCase {
    clubSpecs: ClubSpecifications;
    launchConditions: ClubLaunchConditions;
}
