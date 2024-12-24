import { TrackmanValidation } from '../core/trackman-validation';
import { FlightIntegrator } from '../core/flight-integrator';
import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { BallState, Environment, BallProperties, ValidationCase, ValidationMetrics } from '../core/types';

describe('TrackmanValidation', () => {
    let flightIntegrator: FlightIntegrator;
    let aerodynamicsEngine: AerodynamicsEngineImpl;
    let validator: TrackmanValidation;
    let testCase: ValidationCase;

    beforeEach(() => {
        aerodynamicsEngine = new AerodynamicsEngineImpl();
        flightIntegrator = new FlightIntegrator();
        validator = new TrackmanValidation(aerodynamicsEngine, flightIntegrator);
        
        testCase = {
            initialState: {
                position: { x: 0, y: 0, z: 0 },
                velocity: { x: 35, y: 15, z: 0 },
                spin: { rate: 1500, axis: { x: 0, y: 0, z: 1 } },
                mass: 0.0459
            },
            environment: {
                wind: { x: 0, y: 0, z: 0 },
                temperature: 20,
                pressure: 101325,
                humidity: 0.5,
                altitude: 0
            },
            properties: {
                mass: 0.0459,
                radius: 0.02135,
                area: Math.PI * 0.02135 * 0.02135,
                dragCoefficient: 0.23,
                liftCoefficient: 0.15,
                magnusCoefficient: 0.12,
                spinDecayRate: 100
            },
            expectedMetrics: {
                carryDistance: 120,
                maxHeight: 22,
                flightTime: 0.15,
                launchAngle: 12,
                landingAngle: -14,
                spinRate: 2700
            },
            aerodynamicsEngine: aerodynamicsEngine
        };
    });

    it('validates a correct test case', async () => {
        const testCase: ValidationCase = {
            initialState: {
                position: { x: 0, y: 0, z: 0 },
                velocity: { 
                    x: 55 * Math.cos(18 * Math.PI / 180),  // m/s
                    y: 55 * Math.sin(18 * Math.PI / 180),  // m/s
                    z: 0 
                },
                spin: {
                    rate: 2700,
                    axis: { x: 0, y: 1, z: 0 }
                },
                mass: 0.0459 // kg, standard golf ball mass
            },
            environment: {
                temperature: 20,
                pressure: 101325,
                humidity: 0.5,
                altitude: 0,
                wind: { x: 0, y: 0, z: 0 }
            },
            properties: {
                mass: 0.0459, // kg
                radius: 0.02135, // meters
                area: Math.PI * 0.02135 * 0.02135,
                dragCoefficient: 0.47,
                liftCoefficient: 0.2,
                magnusCoefficient: 0.25,
                spinDecayRate: 0.1
            },
            expectedMetrics: {
                carryDistance: 108, // meters
                maxHeight: 33, // meters
                flightTime: 0.18, // seconds
                launchAngle: 19, // degrees
                landingAngle: -23, // degrees
                spinRate: 2700 // rpm
            },
            aerodynamicsEngine: new AerodynamicsEngineImpl()
        };

        const result = await validator.validateCase(testCase);
        expect(result.isValid).toBe(true);
    });

    it('detects invalid metrics', async () => {
        const invalidTestCase: ValidationCase = {
            ...testCase,
            initialState: {
                ...testCase.initialState,
                velocity: { 
                    x: 45 * Math.cos(28 * Math.PI / 180),  // m/s
                    y: 45 * Math.sin(28 * Math.PI / 180),  // m/s
                    z: 0 
                },
            },
            expectedMetrics: {
                carryDistance: 67,  // meters
                maxHeight: 54,       // meters
                flightTime: 0.24,    // seconds
                launchAngle: 33,     // degrees
                landingAngle: -41,   // degrees
                spinRate: 8500       // rpm
            }
        };

        const result = await validator.validateCase(invalidTestCase);
        expect(result.isValid).toBe(false);
    });

    it('validates multiple test cases', async () => {
        const testCases = [
            {
                ...testCase,
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: { 
                        x: 55 * Math.cos(19 * Math.PI / 180),  // m/s
                        y: 55 * Math.sin(19 * Math.PI / 180),  // m/s
                        z: 0 
                    },
                    spin: {
                        axis: { x: 0, y: 1, z: 0 },
                        rate: 2700
                    },
                    mass: 0.0459  // kg (standard golf ball mass)
                },
                expectedMetrics: {
                    carryDistance: 108,  // meters
                    maxHeight: 33,       // meters
                    flightTime: 0.18,    // seconds
                    launchAngle: 19,     // degrees
                    landingAngle: -23,   // degrees
                    spinRate: 2700       // rpm
                }
            }
        ];
        const results = await validator.validateBatch(testCases);
        expect(results.every(r => r.isValid)).toBe(true);
    });

    it('validates multiple test cases with new metrics', async () => {
        const standardBall: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.0214,        // m
            area: Math.PI * 0.0214 * 0.0214,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };

        const testCases: ValidationCase[] = [
            {
                properties: standardBall,
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: { x: 0, y: 0, z: 45 },
                    spin: { axis: { x: 0, y: 0, z: 1 }, rate: 2700 },
                    mass: 0.0459
                },
                environment: {
                    temperature: 20,
                    pressure: 101325,
                    humidity: 0.5,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                },
                expectedMetrics: {
                    carryDistance: 108,
                    maxHeight: 33,
                    flightTime: 0.18,
                    launchAngle: 19,
                    landingAngle: -23,
                    spinRate: 2700
                }
            },
            {
                properties: standardBall,
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: { x: 0, y: 0, z: 40 },
                    spin: { axis: { x: 0, y: 0, z: 1 }, rate: 6500 },
                    mass: 0.0459
                },
                environment: {
                    temperature: 20,
                    pressure: 101325,
                    humidity: 0.5,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                },
                expectedMetrics: {
                    carryDistance: 82,
                    maxHeight: 34,
                    flightTime: 0.19,
                    launchAngle: 19,
                    landingAngle: -24,
                    spinRate: 6500
                }
            }
        ];

        const results = await validator.validateBatch(testCases);
        expect(results.every(r => r.isValid)).toBe(true);
    });
});
