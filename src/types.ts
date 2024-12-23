export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

export interface SpinState {
    rate: number;  // RPM
    axis: Vector3D;
}

export interface Forces {
    drag: Vector3D;
    lift: Vector3D;
    magnus: Vector3D;
    gravity: Vector3D;
}

export interface BallState {
    position: Vector3D;
    velocity: Vector3D;
    spin: SpinState;
    mass: number;  // kg
}

export interface Environment {
    temperature: number;  // Celsius
    pressure: number;     // Pa
    humidity: number;     // 0-1
    altitude: number;     // meters
    wind: Vector3D;      // m/s
}

export interface BallProperties {
    mass: number;          // kg
    radius: number;        // m
    dragCoefficient: number;
    liftCoefficient: number;
    spinDecayRate: number; // rad/s^2
}

export interface TrajectoryPoint {
    time: number;
    position: Vector3D;
    velocity: Vector3D;
    spin: SpinState;
    forces: Vector3D;
}

export interface ValidationMetrics {
    carryDistance: number;  // meters
    maxHeight: number;      // meters
    flightTime: number;     // seconds
    launchAngle: number;    // degrees
    landingAngle: number;   // degrees
    spinRate: number;       // RPM
}

export interface TrajectoryResult {
    points: TrajectoryPoint[];
    metrics?: ValidationMetrics;
}

export interface LaunchConditions {
    ballSpeed: number;  // m/s
    launchAngle: number;  // degrees
    launchDirection: number;  // degrees
    spinRate: number;  // rpm
    spinAxis: Vector3D;  // normalized
}

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

export interface ValidationError {
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
}

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

export interface SurfaceEffects {
    roughness: number;  // Surface roughness factor (0-1)
    friction: number;   // Surface friction coefficient
    elasticity: number; // Coefficient of restitution
    slope: Vector3D;    // Surface slope (degrees)
}

export interface AerodynamicsEngine {
    calculateForces(
        velocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        environment: Environment
    ): Forces;
}

export type ClubType = 'driver' | 'iron' | 'wedge';

export interface ClubSpecifications {
    type: ClubType;
    loft: number;         // degrees
    lieAngle: number;     // degrees
    length: number;       // inches
    weight: number;       // grams
    swingWeight: string;  // e.g., "D2"
    flex: string;        // e.g., "Regular", "Stiff"
}

export interface ClubLaunchConditions extends LaunchConditions {
    clubType: ClubType;
    clubSpeed: number;    // m/s
    attackAngle: number;  // degrees
    pathAngle: number;    // degrees
    faceAngle: number;    // degrees
    impactLocation: Vector3D;  // relative to club face center
}

export interface ClubValidationCase extends ValidationCase {
    clubSpecs: ClubSpecifications;
    launchConditions: ClubLaunchConditions;
}

export interface PerformanceMetrics {
    executionTime: number;   // ms
    memoryUsage: number;     // bytes
    trajectoryPoints: number;
    cacheHits: number;
    cacheMisses: number;
    batchSize: number;
    averageStepSize: number; // s
}

export interface ProfileMetrics {
    executionTime: number;
    memoryUsage: {
        initial: number;
        final: number;
        peak: number;
        average: number;
    };
    trajectoryPoints: number;
    averageStepSize: number;
    cacheHits?: number;
    cacheMisses?: number;
    cacheSize?: number;
    cacheEvictions?: number;
    batchSize?: number;
    batchSizeAdjustments?: number;
    averageBatchSize?: number;
}

export interface ProfileOptions {
    maxParallelTasks?: number;
    adaptiveBatching?: boolean;
    minBatchSize?: number;
    maxBatchSize?: number;
    targetExecutionTime?: number;
}

export interface OptimizationResult {
    trajectory: TrajectoryResult;
    metric: number;
    conditions: LaunchConditions;
}

export interface HardwareProfile {
    cpuModel: string;
    cpuCount: number;
    cpuSpeed: number;
    totalMemory: number;
    freeMemory: number;
    platform: string;
    arch: string;
}

export interface PerformanceReport {
    timestamp: string;
    hardware: HardwareProfile;
    batchPerformance: {
        optimalBatchSize: number;
        maxThroughput: number;
        averageTimePerShot: number;
        averageMemoryPerShot: number;
    };
    memoryHealth: {
        hasLeak: boolean;
        memoryGrowth: number;
        averageGrowthRate: number;
    };
    cacheEfficiency: {
        hits: number;
        misses: number;
        hitRate: number;
    };
    recommendations: string[];
}
