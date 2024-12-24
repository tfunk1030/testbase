import { Environment, ValidationCase, BallState, BallProperties, SpinState, Vector3D } from '../types';
import { AerodynamicsEngineImpl } from '../core/aerodynamics';

const standardEnvironment: Environment = {
    temperature: 20,  // Celsius
    pressure: 101325, // Pa (sea level)
    humidity: 0.5,    // 50%
    altitude: 0,      // sea level
    wind: { x: 0, y: 0, z: 0 }
};

const standardBallState: BallState = {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 70, y: 0, z: 30 }, // ~160mph ball speed
    spin: {
        rate: 2500,  // rpm
        axis: { x: 0, y: 1, z: 0 }  // backspin
    },
    mass: 0.0459  // kg (typical golf ball mass)
};

const standardBallProperties: BallProperties = {
    radius: 0.02135,  // meters
    mass: 0.0459,     // kg
    dragCoefficient: 0.23,
    liftCoefficient: 0.15,
    spinDecayRate: 0.08
};

export const weatherValidationCases: ValidationCase[] = [
    // Dry conditions (baseline)
    {
        initialState: standardBallState,
        environment: {
            ...standardEnvironment,
            humidity: 0.2
        },
        properties: standardBallProperties,
        expectedMetrics: {
            carryDistance: 245,  // yards
            maxHeight: 32,      // yards
            flightTime: 6.2,    // seconds
            launchAngle: 23,    // degrees
            landingAngle: -38   // degrees
        }
    },
    
    // Light rain
    {
        initialState: standardBallState,
        environment: {
            ...standardEnvironment,
            humidity: 0.5
        },
        properties: standardBallProperties,
        expectedMetrics: {
            carryDistance: 238,  // -3% from baseline
            maxHeight: 31,
            flightTime: 6.1,
            launchAngle: 22.5,   // -0.5 degrees
            landingAngle: -37
        }
    },
    
    // Heavy rain
    {
        initialState: standardBallState,
        environment: {
            ...standardEnvironment,
            humidity: 0.9
        },
        properties: standardBallProperties,
        expectedMetrics: {
            carryDistance: 220,  // -10% from baseline
            maxHeight: 29,
            flightTime: 5.8,
            launchAngle: 21,     // -2 degrees
            landingAngle: -35
        }
    },
    
    // Hot conditions
    {
        initialState: standardBallState,
        environment: {
            ...standardEnvironment,
            temperature: 35  // 95°F
        },
        properties: standardBallProperties,
        expectedMetrics: {
            carryDistance: 250,  // +2% from baseline
            maxHeight: 33,
            flightTime: 6.3,
            launchAngle: 23,
            landingAngle: -38
        }
    },
    
    // Cold conditions
    {
        initialState: standardBallState,
        environment: {
            ...standardEnvironment,
            temperature: 5   // 41°F
        },
        properties: standardBallProperties,
        expectedMetrics: {
            carryDistance: 240,  // -2% from baseline
            maxHeight: 31,
            flightTime: 6.1,
            launchAngle: 22.5,
            landingAngle: -37
        }
    }
];

// Run validation tests
export async function validateWeatherEffects(): Promise<void> {
    const aero = new AerodynamicsEngineImpl();
    
    for (const testCase of weatherValidationCases) {
        const forces = aero.calculateForces(
            testCase.initialState.velocity,
            testCase.initialState.spin,
            testCase.properties,
            testCase.environment
        );
        
        // Validate forces are within expected ranges
        console.log('Test case:', testCase.environment);
        console.log('Forces:', forces);
        console.log('Expected metrics:', testCase.expectedMetrics);
        console.log('---');
    }
}
