# Golf Ball Flight Model API Documentation

## Overview

The Golf Ball Flight Model is a professional-grade physics engine for simulating golf ball trajectories. It provides high-accuracy predictions while maintaining a 40% tolerance for real-world variations.

## Key Features

- Advanced aerodynamics modeling
- Environmental effects (temperature, humidity, altitude)
- Spin dynamics and decay
- Turbulence modeling
- Real-world validation against TrackMan data
- Comprehensive error handling
- Performance optimization with caching

## Installation

```bash
npm install golf-ball-flight-model
```

## Quick Start

```typescript
import { FlightModel } from 'golf-ball-flight-model';

// Create a flight model instance
const model = new FlightModel();

// Define environment conditions
const environment = {
    temperature: 20,    // Celsius
    pressure: 101325,   // Pa (sea level)
    humidity: 0.5,      // 50%
    altitude: 0,        // meters
    wind: { x: 0, y: 0, z: 0 }  // m/s
};

// Define ball properties
const ballProperties = {
    mass: 0.0459,      // kg
    radius: 0.02135,   // meters
    dragCoefficient: 0.23,
    liftCoefficient: 0.15,
    spinDecayRate: 0.08
};

// Define launch conditions
const launchConditions = {
    ballSpeed: 70,     // m/s
    launchAngle: 12,   // degrees
    launchDirection: 0, // degrees
    spinRate: 2500,    // rpm
    spinAxis: { x: 0, y: 1, z: 0 }  // backspin
};

// Simulate the shot
const trajectory = await model.simulateShot(
    launchConditions,
    environment,
    ballProperties
);

console.log(trajectory.metrics);  // Display flight metrics
```

## API Reference

### Class: FlightModel

The main class for simulating golf ball trajectories.

#### Methods

##### simulateFlight(initialState, environment, ballProperties)
Simulates a golf shot with precise initial conditions.

Parameters:
- `initialState: BallState` - Initial ball state
  - `position: Vector3D` - Initial position (meters)
  - `velocity: Vector3D` - Initial velocity (m/s)
  - `spin: SpinState` - Initial spin state
  - `mass: number` - Ball mass (kg)
- `environment: Environment` - Environmental conditions
- `ballProperties: BallProperties` - Ball physical properties

Returns: `Promise<TrajectoryResult>`

##### simulateShot(launchConditions, environment, ballProperties)
Simulates a golf shot using launch monitor-style inputs.

Parameters:
- `launchConditions: LaunchConditions`
  - `ballSpeed: number` - Initial ball speed (m/s)
  - `launchAngle: number` - Launch angle (degrees)
  - `launchDirection: number` - Launch direction (degrees)
  - `spinRate: number` - Initial spin rate (rpm)
  - `spinAxis: Vector3D` - Spin axis (normalized)
- `environment: Environment`
- `ballProperties: BallProperties`

Returns: `Promise<TrajectoryResult>`

##### validateDataset(dataset)
Validates simulation results against real-world data.

Parameters:
- `dataset: DataSet` - Collection of input/output pairs

Returns: `Promise<ValidationResult[]>`

### Types

#### Environment
```typescript
interface Environment {
    temperature: number;  // Celsius
    pressure: number;     // Pa
    humidity: number;     // 0-1
    altitude: number;     // meters
    wind: Vector3D;      // m/s
}
```

#### BallProperties
```typescript
interface BallProperties {
    mass: number;          // kg
    radius: number;        // meters
    dragCoefficient: number;
    liftCoefficient: number;
    spinDecayRate: number; // rpm/s
}
```

#### TrajectoryResult
```typescript
interface TrajectoryResult {
    points: TrajectoryPoint[];
    metrics: {
        carryDistance: number;  // meters
        maxHeight: number;      // meters
        flightTime: number;     // seconds
        launchAngle: number;    // degrees
        landingAngle: number;   // degrees
    };
}
```

## Validation

The model maintains a 40% tolerance for all metrics when compared to real-world data. This tolerance accounts for:
- Environmental variations
- Equipment differences
- Measurement uncertainties
- Player variability

## Performance Considerations

### Memory Usage
- Use the built-in caching system for repeated simulations
- Clear cache periodically for long-running applications
- Monitor memory usage in production environments

### Computation Time
- Batch similar shots together for better performance
- Use lower precision for rapid approximations
- Consider hardware capabilities for parallel processing

## Error Handling

The API uses TypeScript for compile-time type checking and includes runtime validation:

```typescript
try {
    const trajectory = await model.simulateShot(
        launchConditions,
        environment,
        ballProperties
    );
} catch (error) {
    if (error instanceof ValidationError) {
        console.error('Invalid input:', error.message);
    } else {
        console.error('Simulation error:', error);
    }
}
```

## Best Practices

1. Input Validation
   - Always validate user inputs before simulation
   - Use provided range constants for boundaries
   - Handle validation errors appropriately

2. Environmental Conditions
   - Use realistic environmental values
   - Consider altitude effects on air density
   - Account for wind variations with height

3. Performance Optimization
   - Implement caching for repeated scenarios
   - Use batch processing for multiple simulations
   - Monitor and optimize memory usage

4. Error Handling
   - Implement proper error handling
   - Log validation failures for debugging
   - Provide meaningful error messages

## Examples

### Basic Shot Simulation
```typescript
const model = new FlightModel();

// Driver shot
const driverShot = await model.simulateShot({
    ballSpeed: 75,
    launchAngle: 10.5,
    launchDirection: 0,
    spinRate: 2700,
    spinAxis: { x: 0, y: 1, z: 0 }
}, environment, ballProperties);

console.log(`Carry distance: ${driverShot.metrics.carryDistance} meters`);
```

### Environmental Effects
```typescript
// Hot day at altitude
const environment = {
    temperature: 35,    // Hot day
    pressure: 85000,    // Higher altitude
    humidity: 0.3,      // Dry conditions
    altitude: 1500,     // meters
    wind: { x: 2, y: 0, z: 1 }  // Light crosswind
};

const trajectory = await model.simulateShot(
    launchConditions,
    environment,
    ballProperties
);
```

### Validation
```typescript
const dataset = {
    inputs: [{
        launchConditions,
        environment,
        ballProperties
    }],
    outputs: [{
        trajectory: realWorldTrajectory,
        metrics: realWorldMetrics
    }]
};

const validationResults = await model.validateDataset(dataset);
console.log('Validation passed:', validationResults[0].isValid);
```
