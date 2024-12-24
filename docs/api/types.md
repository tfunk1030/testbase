# Golf Ball Flight Model Type Documentation

## Core Types

### Vector3D
Represents a 3D vector used for positions, velocities, and directions.

```typescript
interface Vector3D {
    x: number;
    y: number;
    z: number;
}
```

### BallState
Represents the complete state of a golf ball at a point in time.

```typescript
interface BallState {
    position: Vector3D;  // meters
    velocity: Vector3D;  // m/s
    spin: SpinState;
    mass: number;       // kg
}
```

### SpinState
Describes the spin characteristics of the ball.

```typescript
interface SpinState {
    rate: number;    // rpm
    axis: Vector3D;  // normalized vector
}
```

### Environment
Describes the environmental conditions for the simulation.

```typescript
interface Environment {
    temperature: number;  // Celsius (-10 to 40)
    pressure: number;    // Pa (95000 to 105000)
    humidity: number;    // 0 to 1
    altitude: number;    // meters (0 to 3000)
    wind: Vector3D;      // m/s (max 20)
}
```

### BallProperties
Physical properties of the golf ball.

```typescript
interface BallProperties {
    mass: number;          // kg (0.0456 to 0.0512)
    radius: number;        // meters (0.0213 to 0.0214)
    dragCoefficient: number;  // 0.15 to 0.28
    liftCoefficient: number;  // 0.15 to 0.25
    spinDecayRate: number;    // rpm/s (5 to 15)
}
```

### LaunchConditions
Initial conditions typically measured by launch monitors.

```typescript
interface LaunchConditions {
    ballSpeed: number;       // m/s
    launchAngle: number;     // degrees
    launchDirection: number; // degrees
    spinRate: number;        // rpm
    spinAxis: Vector3D;      // normalized
}
```

### TrajectoryPoint
A single point in the ball's trajectory.

```typescript
interface TrajectoryPoint {
    time: number;        // seconds
    position: Vector3D;  // meters
    velocity: Vector3D;  // m/s
    spin: SpinState;     // current spin state
    forces: {
        drag: Vector3D;    // Newtons
        lift: Vector3D;    // Newtons
        magnus: Vector3D;  // Newtons
        gravity: Vector3D; // Newtons
    };
}
```

### TrajectoryResult
Complete results of a trajectory simulation.

```typescript
interface TrajectoryResult {
    points: TrajectoryPoint[];
    metrics: TrajectoryMetrics;
    validation?: ValidationResult;
}
```

### TrajectoryMetrics
Key metrics from the trajectory simulation.

```typescript
interface TrajectoryMetrics {
    carryDistance: number;  // meters
    maxHeight: number;      // meters
    flightTime: number;     // seconds
    launchAngle: number;    // degrees
    landingAngle: number;   // degrees
    spinRetention: number;  // percentage
    apex: Vector3D;         // position at max height
}
```

### ValidationResult
Results from comparing simulation to real-world data.

```typescript
interface ValidationResult {
    isValid: boolean;
    detailedMetrics?: {
        carryDistanceError: number;  // percentage
        maxHeightError: number;      // percentage
        flightTimeError: number;     // percentage
        spinRateError: number;       // percentage
        trajectoryRSquared: number;  // 0 to 1
    };
    errorMessages?: string[];
}
```

### DataSet
Collection of input/output pairs for validation.

```typescript
interface DataSet {
    inputs: Array<{
        launchConditions: LaunchConditions;
        environment: Environment;
        ballProperties: BallProperties;
    }>;
    outputs: Array<{
        trajectory: TrajectoryPoint[];
        metrics: TrajectoryMetrics;
    }>;
}
```

## Error Types

### ValidationError
Thrown when input validation fails.

```typescript
class ValidationError extends Error {
    constructor(message: string, public field?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}
```

### SimulationError
Thrown when the simulation encounters an error.

```typescript
class SimulationError extends Error {
    constructor(message: string, public step?: number) {
        super(message);
        this.name = 'SimulationError';
    }
}
```

## Type Guards

```typescript
function isValidVector3D(v: any): v is Vector3D {
    return typeof v === 'object' &&
           typeof v.x === 'number' &&
           typeof v.y === 'number' &&
           typeof v.z === 'number';
}

function isValidSpinState(s: any): s is SpinState {
    return typeof s === 'object' &&
           typeof s.rate === 'number' &&
           isValidVector3D(s.axis);
}

function isValidBallState(b: any): b is BallState {
    return typeof b === 'object' &&
           isValidVector3D(b.position) &&
           isValidVector3D(b.velocity) &&
           isValidSpinState(b.spin) &&
           typeof b.mass === 'number';
}
```

## Constants

```typescript
const CONSTANTS = {
    GRAVITY: -9.81,            // m/s^2
    AIR_DENSITY_SL: 1.225,     // kg/m^3 at sea level
    MIN_MASS: 0.0456,          // kg
    MAX_MASS: 0.0512,          // kg
    MIN_RADIUS: 0.0213,        // m
    MAX_RADIUS: 0.0214,        // m
    MIN_CD: 0.15,              // drag coefficient
    MAX_CD: 0.28,
    MIN_CL: 0.15,              // lift coefficient
    MAX_CL: 0.25,
    MIN_SPIN_DECAY: 5,         // rpm/s
    MAX_SPIN_DECAY: 15,
    MIN_TEMP: -10,             // Celsius
    MAX_TEMP: 40,
    MIN_PRESSURE: 95000,       // Pa
    MAX_PRESSURE: 105000,
    MIN_HUMIDITY: 0,           // percentage
    MAX_HUMIDITY: 100,
    MIN_ALTITUDE: 0,           // meters
    MAX_ALTITUDE: 3000,
    MAX_WIND: 20               // m/s
};
```
