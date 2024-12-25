# Flight Calculator Implementation Guide

## Overview of Simplified Model
The simplified flight calculator uses basic physics principles to model ball trajectory while maintaining good accuracy for typical use cases. Key simplifications include:

- Euler integration instead of more complex numerical methods
- Simplified aerodynamic calculations
- Basic environmental effects modeling
- Streamlined spin dynamics

## Core Components

### 1. Input Parameters
```typescript
interface BallState {
    position: Vector3D;    // Initial position (x,y,z)
    velocity: Vector3D;    // Initial velocity
    spin: {
        rate: number;      // Spin rate in rad/s
    };
    mass: number;         // Mass in kg
}

interface Environment {
    temperature: number;  // Temperature in Celsius
    pressure: number;    // Pressure in hPa
    wind: Vector3D;      // Wind velocity
}

interface BallProperties {
    mass: number;        // Mass in kg
    radius: number;      // Radius in meters
    area: number;        // Cross-sectional area
    dragCoefficient: number;
    liftCoefficient: number;
    magnusCoefficient: number;
    spinDecayRate: number;
}
```

## Step-by-Step Integration Guide

### 1. Initialize Flight Calculator

```typescript
// In your UI component file:
import { SimplifiedFlightIntegrator } from './simplified-flight-integrator';

class FlightCalculator {
    private flightIntegrator: SimplifiedFlightIntegrator;
    
    constructor() {
        this.flightIntegrator = new SimplifiedFlightIntegrator();
    }
}
```

### 2. Connect UI Inputs to Calculator

```typescript
// Map your existing UI inputs to the required parameters
async function handleCalculation(uiInputs: any) {
    // 1. Map UI inputs to BallState
    const initialState: BallState = {
        position: { x: 0, y: 0, z: 0 }, // Starting position
        velocity: {
            x: uiInputs.speed * Math.cos(uiInputs.launchAngle) * Math.cos(uiInputs.direction),
            y: uiInputs.speed * Math.sin(uiInputs.launchAngle),
            z: uiInputs.speed * Math.cos(uiInputs.launchAngle) * Math.sin(uiInputs.direction)
        },
        spin: {
            rate: uiInputs.spinRate
        },
        mass: uiInputs.ballMass
    };

    // 2. Map environmental conditions
    const environment: Environment = {
        temperature: uiInputs.temperature,
        pressure: uiInputs.pressure,
        wind: {
            x: uiInputs.windSpeed * Math.cos(uiInputs.windDirection),
            y: 0,
            z: uiInputs.windSpeed * Math.sin(uiInputs.windDirection)
        }
    };

    // 3. Set ball properties
    const properties: BallProperties = {
        mass: uiInputs.ballMass,
        radius: 0.0213, // Standard golf ball radius in meters
        area: Math.PI * 0.0213 * 0.0213, // πr²
        dragCoefficient: 0.47, // Typical golf ball drag coefficient
        liftCoefficient: 0.2, // Typical lift coefficient
        magnusCoefficient: 0.1, // Simplified magnus effect
        spinDecayRate: 0.05 // Simplified spin decay
    };

    return await this.flightIntegrator.simulateFlight(
        initialState,
        environment,
        properties
    );
}
```

### 3. Handle Calculator Output

```typescript
// Process trajectory results for display
function processResults(results: TrajectoryResult) {
    // Extract key metrics for display
    const metrics = {
        carry: results.metrics.carryDistance.toFixed(1),
        maxHeight: results.metrics.maxHeight.toFixed(1),
        flightTime: results.metrics.timeOfFlight.toFixed(2),
        finalSpeed: Math.sqrt(
            Math.pow(results.finalState.velocity.x, 2) +
            Math.pow(results.finalState.velocity.y, 2) +
            Math.pow(results.finalState.velocity.z, 2)
        ).toFixed(1)
    };

    // Update UI displays
    updateMetricsDisplay(metrics);
    
    // If you have trajectory visualization
    if (results.points.length > 0) {
        updateTrajectoryVisualization(results.points);
    }
}
```

### 4. Error Handling

```typescript
try {
    const results = await handleCalculation(uiInputs);
    processResults(results);
} catch (error) {
    // Handle specific error cases
    if (error.message.includes('Invalid ball properties')) {
        showError('Please check ball parameters');
    } else if (error.message.includes('Invalid environmental conditions')) {
        showError('Please check environmental inputs');
    } else {
        showError('An error occurred during calculation');
    }
}
```

## Implementation Considerations

### Performance Optimization
1. Cache results for similar input combinations
2. Use requestAnimationFrame for trajectory visualization updates
3. Implement debouncing for real-time input changes

```typescript
// Example debouncing implementation
let calculateTimeout: NodeJS.Timeout;

function debouncedCalculation(inputs: any) {
    clearTimeout(calculateTimeout);
    calculateTimeout = setTimeout(() => {
        handleCalculation(inputs)
            .then(processResults)
            .catch(handleError);
    }, 100);
}
```

### Accuracy vs Performance
- The simplified model uses a fixed timestep (dt = 0.001s)
- Adjust timestep for balance between accuracy and performance
- Consider reducing calculation frequency for real-time updates

### Memory Management
- Clear old trajectory data before new calculations
- Implement point reduction for long trajectories
- Use typed arrays for large datasets

```typescript
// Example point reduction for visualization
function reduceTrajectoryPoints(points: TrajectoryPoint[], maxPoints: number = 100): TrajectoryPoint[] {
    if (points.length <= maxPoints) return points;
    
    const step = Math.floor(points.length / maxPoints);
    return points.filter((_, index) => index % step === 0);
}
```

## Testing Implementation

1. Verify basic calculations:
```typescript
const testCase = {
    initialState: {
        position: {x: 0, y: 0, z: 0},
        velocity: {x: 70, y: 30, z: 0},
        spin: {rate: 2000},
        mass: 0.0459
    },
    environment: {
        temperature: 20,
        pressure: 1013.25,
        wind: {x: 0, y: 0, z: 0}
    },
    properties: {
        mass: 0.0459,
        radius: 0.0213,
        area: Math.PI * 0.0213 * 0.0213,
        dragCoefficient: 0.47,
        liftCoefficient: 0.2,
        magnusCoefficient: 0.1,
        spinDecayRate: 0.05
    }
};

const results = await flightIntegrator.simulateFlight(
    testCase.initialState,
    testCase.environment,
    testCase.properties
);

console.log('Carry Distance:', results.metrics.carryDistance);
console.log('Max Height:', results.metrics.maxHeight);
```

2. Validate against known shots
3. Test edge cases (extreme inputs)
4. Verify UI updates and visualizations

## Troubleshooting Common Issues

1. Unexpected Trajectories
- Verify input unit conversions (degrees to radians, etc.)
- Check wind vector calculations
- Validate initial velocity components

2. Performance Issues
- Reduce trajectory points for visualization
- Implement calculation caching
- Use web workers for computation

3. UI Responsiveness
- Implement debouncing
- Use async/await properly
- Handle loading states

4. Accuracy Concerns
- Adjust timestep (dt) value
- Verify environmental calculations
- Compare with real-world data

## Next Steps

1. Monitor performance in production
2. Gather user feedback
3. Implement additional features:
   - Shot shape predictions
   - Club-specific adjustments
   - Environmental presets
4. Optimize based on usage patterns
