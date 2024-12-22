export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

export interface LaunchConditions {
    ballSpeed: number;      // m/s
    launchAngle: number;    // degrees
    launchDirection: number;// degrees
    totalSpin: number;      // rpm
    spinAxis: number;       // degrees
}

export interface Environment {
    temperature: number;    // Celsius
    pressure: number;       // hPa
    humidity: number;       // percentage
    altitude: number;       // meters
    windSpeed: number;      // m/s
    windDirection: number;  // degrees
    timeOfDay?: string;    // 'morning' | 'afternoon' | 'evening'
}

export interface BallProperties {
    mass: number;          // kg
    diameter: number;      // m
    dragCoefficient?: number;
    liftCoefficient?: number;
    spinDecayRate?: number;
    compressionRatio?: number;
    momentOfInertia?: number;
    dimplePattern: string;
    coverMaterial?: string;
    dimpleCount: number;
    dimpleShape: 'circular' | 'hexagonal' | 'triangular';
    edgeProfile: 'sharp' | 'rounded' | 'smooth';
    surfaceTexture: 'smooth' | 'textured' | 'rough';
    construction: '2-piece' | '3-piece' | '4-piece' | '5-piece';
    dimpleCoverage: number;
    dimpleDepth: number;
    compression: number;
}

export interface BallState {
    position: Vector3D;
    velocity: Vector3D;
    spin: Vector3D;
    mass: number;
}

export interface TrajectoryPoint {
    position: Vector3D;
    velocity: Vector3D;
    spin: Vector3D;
    time: number;
    // Flattened coordinates for convenience
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
    initialConditions: LaunchConditions;
    environment: Environment;
    ballProperties: BallProperties;
    maxHeight: number;
    carryDistance: number;
    totalDistance: number;
    flightTime: number;
    landingAngle: number;
    lateralDeviation: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    metrics: {
        carryDistance: number;
        totalDistance: number;
        maxHeight: number;
        flightTime: number;
        spinRate: number;
        launchAngle: number;
    };
}

export interface DataSet {
    conditions: LaunchConditions[];
    environment: Environment;
    ballProperties: BallProperties;
}

export interface SurfaceEffects {
    friction: number;
    restitution: number;
    rollResistance: number;
    bounceAngle: number;
    dragModifier: number;
    liftModifier: number;
}

export interface Forces {
    drag: Vector3D;
    lift: Vector3D;
    magnus: Vector3D;
    gravity: Vector3D;
}

export interface ValidationCase {
    conditions: LaunchConditions;
    environment: Environment;
    ballProperties: BallProperties;
    baseConditions?: LaunchConditions;
    baseEnvironment?: Environment;
}
