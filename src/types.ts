export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

export interface SpinState {
    axis: Vector3D;
    rate: number;  // RPM
}

export interface BallState {
    position: Vector3D;
    velocity: Vector3D;
    spin: SpinState;
    mass: number;
}

export interface BallProperties {
    mass: number;          // kg
    radius: number;        // m
    area: number;          // m^2
    dragCoefficient: number;
    liftCoefficient: number;
    magnusCoefficient: number;
    spinDecayRate: number; // rad/s^2
    construction?: string; // Ball construction type (e.g., '2-piece', '3-piece')
}

export interface Environment {
    temperature: number;  // Celsius
    pressure: number;    // hPa
    humidity: number;    // %
    altitude: number;    // m
    wind: Vector3D;      // m/s
}

export interface Forces {
    drag: Vector3D;
    lift: Vector3D;
    magnus: Vector3D;
    gravity: Vector3D;
}

export interface TrajectoryPoint extends BallState {
    time: number;
    forces: Forces;
}

export interface TrajectoryResult {
    points: TrajectoryPoint[];
    finalState: BallState;
    metrics: TrajectoryMetrics;
}

export interface TrajectoryMetrics {
    carryDistance: number;
    totalDistance: number;
    maxHeight: number;
    timeOfFlight: number;
    spinRate: number;
    launchAngle: number;
    launchDirection: number;
    ballSpeed: number;
}

export interface ValidationMetrics extends TrajectoryMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    rmse?: number;
    mae?: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    trajectory: TrajectoryResult;
}

export interface ValidationCase {
    properties: BallProperties;
    initialState: BallState;
    environment: Environment;
    expectedMetrics: TrajectoryMetrics;
    aerodynamicsEngine?: IAerodynamicsEngine;
}

export interface IAerodynamicsEngine {
    calculateForces(
        velocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        environment: Environment,
        dt?: number,
        position?: Vector3D,
        prevTurbulence?: Vector3D
    ): Forces;
}

export interface MemoryUsage {
    heapTotal: number;
    heapUsed: number;
    external: number;
    gc: GCMetrics[];
}

export interface GCMetrics {
    type: string;
    duration: number;
    startTime: number;
    endTime: number;
}

export interface ResourceMetrics {
    timestamp: number;
    cpu: {
        usage: number;
        kernelTime: number;
        userTime: number;
    };
    memory: MemoryUsage;
    disk: {
        total: number;
        used: number;
        free: number;
    };
    network: {
        sent: number;
        received: number;
    };
    io: {
        reads: number;
        writes: number;
        readBytes: number;
        writeBytes: number;
    };
}

export interface LaunchConditions {
    ballSpeed: number;
    launchAngle: number;
    launchDirection: number;
    spinRate: number;
    spinAxis: Vector3D;
}

export interface DataSet {
    id: string;
    timestamp: number;
    properties: BallProperties;
    environment: Environment;
    trajectories: TrajectoryResult[];
}

export interface ThreadStats {
    id: number;
    status: 'idle' | 'busy';
    taskCount: number;
    cpuUsage: number;
}
