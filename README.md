# Golf Ball Flight Model

A high-performance physics-based golf ball trajectory simulation with professional-grade accuracy.

## Features

- Full 3D trajectory simulation
- Professional standard environmental effects
- Performance optimization with caching
- Data generation for training
- Validation against real-world data

## Installation

```bash
npm install golf-ball-flight-model
```

## Quick Start

```typescript
import { GolfBallFlightModel } from 'golf-ball-flight-model';

// Create model instance
const model = new GolfBallFlightModel();

// Define conditions
const launch = {
    ballSpeed: 160,
    launchAngle: 10.5,
    launchDirection: 0,
    totalSpin: 2800,
    spinAxis: 0
};

const environment = {
    temperature: 70,
    windSpeed: 0,
    windDirection: 0,
    altitude: 0,
    humidity: 50,
    pressure: 29.92
};

const ball = {
    compression: 90,
    diameter: 1.68,
    mass: 45.93,
    dimpleCount: 352,
    dimpleDepth: 0.01
};

// Calculate trajectory
const trajectory = model.calculateTrajectory(launch, environment, ball);

console.log(`Carry Distance: ${trajectory.carryDistance} yards`);
console.log(`Max Height: ${trajectory.maxHeight} yards`);
console.log(`Flight Time: ${trajectory.flightTime} seconds`);
```

## Professional Standards

The model adheres to professional golf standards:

- Temperature: 2 yards per 10 degrees
- Headwind: 1% per mph
- Tailwind: 0.5% per mph
- Crosswind: 2% per 5mph
- Altitude: 10% per 5000 feet

## API Reference

### GolfBallFlightModel

Main class for trajectory calculations.

#### calculateTrajectory(conditions, environment, ballProperties)

Calculate full ball trajectory with all data points.

```typescript
const trajectory = model.calculateTrajectory(launch, environment, ball);
```

#### quickEstimate(conditions, environment)

Fast estimation of key trajectory parameters.

```typescript
const estimate = model.quickEstimate(launch, environment);
```

#### batchProcess(conditions[], environment, ballProperties)

Process multiple trajectories efficiently.

```typescript
const trajectories = model.batchProcess([launch1, launch2], environment, ball);
```

#### generateTrainingData(clubType, numSamples)

Generate training data for specific club.

```typescript
const driverData = model.generateTrainingData('DRIVER', 1000);
```

#### validateModel(testCases)

Validate model against professional standards.

```typescript
const results = model.validateModel(testCases);
```

## Performance Optimization

The model includes several optimizations:

1. **Caching System**
   - Trajectory caching
   - Smart cache key generation
   - Automatic cache management

2. **Adaptive Time Steps**
   - Launch: 0.5ms steps
   - Peak: 2ms steps
   - Descent: 1ms steps

3. **Trajectory Simplification**
   - Douglas-Peucker algorithm
   - Shape preservation
   - Point reduction

4. **Quick Estimation**
   - Simplified regression model
   - Fast approximations
   - Batch processing

## Testing

Run the test suite:

```bash
npm test
```

Tests cover:
- Launch physics
- Flight integration
- Professional standards
- Performance
- Data generation

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
