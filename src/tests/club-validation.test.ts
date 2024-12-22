import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { FlightIntegrator } from '../core/flight-integrator';
import { TrackmanValidation } from '../core/trackman-validation';
import { 
    ClubValidationCase,
    ClubSpecifications,
    ClubLaunchConditions,
    Environment,
    BallProperties,
    ClubType
} from '../core/types';

describe('ClubValidation', () => {
    let flightIntegrator: FlightIntegrator;
    let aerodynamicsEngine: AerodynamicsEngineImpl;
    let validator: TrackmanValidation;

    beforeEach(() => {
        aerodynamicsEngine = new AerodynamicsEngineImpl();
        flightIntegrator = new FlightIntegrator();
        validator = new TrackmanValidation(aerodynamicsEngine, flightIntegrator);
    });

    // Standard environment
    const environment: Environment = {
        wind: { x: 0, y: 0, z: 0 },
        temperature: 20,
        pressure: 101325,
        humidity: 0.5,
        altitude: 0
    };

    // Ball properties adjusted for different club types
    const getClubBallProperties = (clubType: ClubType): BallProperties => {
        const base = {
            mass: 0.0459,
            radius: 0.02135
        };

        switch (clubType) {
            case 'driver':
                return {
                    ...base,
                    dragCoefficient: 0.25,
                    liftCoefficient: 0.27,
                    magnusCoefficient: 0.32,
                    spinDecayRate: 0.04,
                    area: Math.PI * 0.02135 * 0.02135
                };
            case 'iron':
                return {
                    ...base,
                    dragCoefficient: 0.28,
                    liftCoefficient: 0.31,
                    magnusCoefficient: 0.35,
                    spinDecayRate: 0.05,
                    area: Math.PI * 0.02135 * 0.02135
                };
            case 'wedge':
                return {
                    ...base,
                    dragCoefficient: 0.31,
                    liftCoefficient: 0.35,
                    magnusCoefficient: 0.38,
                    spinDecayRate: 0.06,
                    area: Math.PI * 0.02135 * 0.02135
                };
            default:
                return {
                    ...base,
                    dragCoefficient: 0.28,
                    liftCoefficient: 0.31,
                    magnusCoefficient: 0.35,
                    spinDecayRate: 0.05,
                    area: Math.PI * 0.02135 * 0.02135
                };
        }
    };

    // Test cases for different club types
    describe('Driver shots', () => {
        const driverSpecs: ClubSpecifications = {
            type: 'driver',
            loft: 10.5,
            lieAngle: 56,
            length: 45.5,
            weight: 320,
            swingWeight: "D2",
            flex: "Stiff"
        };

        const driverLaunch: ClubLaunchConditions = {
            clubType: 'driver',
            ballSpeed: 75,
            launchAngle: 12,
            launchDirection: 0,
            spinRate: 2700,
            spinAxis: { x: 0, y: 0, z: 1 },
            clubSpeed: 50,
            attackAngle: -1.5,
            pathAngle: 0,
            faceAngle: 0,
            impactLocation: { x: 0, y: 0, z: 0 }
        };

        it('validates typical driver shot', async () => {
            const engine = new AerodynamicsEngineImpl();
            const testCase: ClubValidationCase = {
                clubSpecs: {
                    type: 'driver',
                    loft: 10.5,
                    length: 45.5,
                    weight: 198,
                    flex: 'stiff',
                    lieAngle: 58,
                    swingWeight: 'D2'
                },
                launchConditions: {
                    clubType: 'driver',
                    ballSpeed: 75,
                    launchAngle: 12,
                    launchDirection: 0,
                    spinRate: 2700,
                    spinAxis: { x: 0, y: 0, z: 1 },
                    clubSpeed: 50,
                    attackAngle: -1.5,
                    pathAngle: 0,
                    faceAngle: 0,
                    impactLocation: { x: 0, y: 0, z: 0 }
                },
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: { 
                        x: 75 * Math.cos(12 * Math.PI / 180),  // m/s
                        y: 75 * Math.sin(12 * Math.PI / 180),  // m/s
                        z: 0 
                    },
                    spin: {
                        rate: 2700,
                        axis: { x: 0, y: 1, z: 0 }
                    },
                    mass: 0.0459
                },
                environment: {
                    temperature: 20,
                    pressure: 101325,
                    humidity: 0.5,
                    altitude: 0,
                    wind: { x: 0, y: 0, z: 0 }
                },
                properties: getClubBallProperties('driver'),
                expectedMetrics: {
                    carryDistance: 108,  // meters
                    maxHeight: 33,       // meters
                    flightTime: 0.18,    // seconds
                    launchAngle: 19,     // degrees
                    landingAngle: -23,   // degrees
                    spinRate: 2700       // rpm
                },
                aerodynamicsEngine: engine
            };

            const result = await validator.validateClubMetrics(testCase);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Iron shots', () => {
        const iron7Specs: ClubSpecifications = {
            type: 'iron',
            loft: 31,
            lieAngle: 62.5,
            length: 37,
            weight: 280,
            swingWeight: "D1",
            flex: "Regular"
        };

        const iron7Launch: ClubLaunchConditions = {
            clubType: 'iron',
            ballSpeed: 50,
            launchAngle: 18,
            launchDirection: 0,
            spinRate: 6500,
            spinAxis: { x: 0, y: 0, z: 1 },
            clubSpeed: 35,
            attackAngle: -4,
            pathAngle: 0,
            faceAngle: 0,
            impactLocation: { x: 0, y: 0, z: 0 }
        };

        it('validates typical 7-iron shot', async () => {
            const testCase: ClubValidationCase = {
                clubSpecs: iron7Specs,
                launchConditions: iron7Launch,
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: { 
                        x: 60 * Math.cos(18 * Math.PI / 180),  // m/s
                        y: 60 * Math.sin(18 * Math.PI / 180),  // m/s
                        z: 0 
                    },
                    spin: {
                        rate: 6500,
                        axis: { x: 0, y: 1, z: 0 }
                    },
                    mass: 0.0459
                },
                environment,
                properties: getClubBallProperties('iron'),
                expectedMetrics: {
                    carryDistance: 82,   // meters
                    maxHeight: 34,       // meters
                    flightTime: 0.19,    // seconds
                    launchAngle: 19,     // degrees
                    landingAngle: -24,   // degrees
                    spinRate: 6500       // rpm
                },
                aerodynamicsEngine
            };

            const result = await validator.validateClubMetrics(testCase);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Wedge shots', () => {
        const pitchingWedgeSpecs: ClubSpecifications = {
            type: 'wedge',
            loft: 46,
            lieAngle: 64,
            length: 35.5,
            weight: 285,
            swingWeight: "D3",
            flex: "Wedge"
        };

        const wedgeLaunch: ClubLaunchConditions = {
            clubType: 'wedge',
            ballSpeed: 40,
            launchAngle: 28,
            launchDirection: 0,
            spinRate: 8500,
            spinAxis: { x: 0, y: 0, z: 1 },
            clubSpeed: 30,
            attackAngle: -5,
            pathAngle: 0,
            faceAngle: 0,
            impactLocation: { x: 0, y: 0, z: 0 }
        };

        it('validates typical pitching wedge shot', async () => {
            const testCase: ClubValidationCase = {
                clubSpecs: pitchingWedgeSpecs,
                launchConditions: wedgeLaunch,
                initialState: {
                    position: { x: 0, y: 0, z: 0 },
                    velocity: { 
                        x: 45 * Math.cos(28 * Math.PI / 180),  // m/s
                        y: 45 * Math.sin(28 * Math.PI / 180),  // m/s
                        z: 0 
                    },
                    spin: {
                        rate: 8500,
                        axis: { x: 0, y: 1, z: 0 }
                    },
                    mass: 0.0459
                },
                environment,
                properties: getClubBallProperties('wedge'),
                expectedMetrics: {
                    carryDistance: 67,   // meters
                    maxHeight: 54,       // meters
                    flightTime: 0.24,    // seconds
                    launchAngle: 33,     // degrees
                    landingAngle: -41,   // degrees
                    spinRate: 8500       // rpm
                },
                aerodynamicsEngine
            };

            const result = await validator.validateClubMetrics(testCase);
            expect(result.isValid).toBe(true);
        });
    });
});
