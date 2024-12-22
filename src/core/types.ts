export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

export interface LaunchConditions {
    ballSpeed: number;
    launchAngle: number;
    launchDirection: number;
    totalSpin: number;
    spinAxis: number;
}

export interface Environment {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    altitude: number;
    humidity: number;
    pressure: number;
    timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';
}

export interface BallProperties {
    mass: number;
    diameter: number;
    dimpleCount: number;
    dimpleShape: 'circular' | 'hexagonal' | 'triangular';
    dimplePattern: 'icosahedral' | 'octahedral' | 'tetrahedral' | 'hybrid';
    edgeProfile: 'sharp' | 'rounded' | 'smooth';
    surfaceTexture: 'smooth' | 'textured' | 'rough';
    construction: '2-piece' | '3-piece' | '4-piece' | '5-piece';
    dimpleCoverage: number;
    dimpleDepth: number;
    compression: number;
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
    spin: Vector3D;
    mass: number;
}

export interface TrajectoryPoint {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    wx: number;
    wy: number;
    wz: number;
    t: number;
}

export interface Trajectory {
    points: TrajectoryPoint[];
    maxHeight: number;
    carryDistance: number;
    flightTime: number;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface DataSet {
    trajectories: Trajectory[];
    conditions: LaunchConditions[];
    environment: Environment;
    ballProperties: BallProperties;
}

export interface SurfaceEffects {
    dragModifier: number;
    liftModifier: number;
}

export interface ValidationCase {
    conditions: LaunchConditions;
    environment: Environment;
    ballProperties: BallProperties;
    baseConditions?: LaunchConditions;
    baseEnvironment?: Environment;
}
