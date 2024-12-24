import { FlightModel } from '../core/flight-model';
import { BallState, Environment, BallProperties } from '../core/types';
import { AerodynamicsEngineImpl } from '../core/aerodynamics';

describe('FlightModel', () => {
    let flightModel: FlightModel;

    beforeEach(() => {
        flightModel = new FlightModel(new AerodynamicsEngineImpl());
    });

    it('calculates trajectory for a standard golf shot', async () => {
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 70, y: 30, z: 0 },
            spin: {
                rate: 2500,
                axis: { x: 0, y: 0, z: 1 }
            },
            mass: 0.0459
        };

        const environment: Environment = {
            wind: { x: 0, y: 0, z: 0 },
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.02135,        // m
            area: Math.PI * 0.02135 * 0.02135,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };

        const trajectory = await flightModel.simulateFlight(initialState, environment, properties);

        expect(trajectory.points.length).toBeGreaterThan(0);
        expect(trajectory.metrics).toBeDefined();
        expect(trajectory.metrics?.carryDistance).toBeGreaterThan(0);
        expect(trajectory.metrics?.maxHeight).toBeGreaterThan(0);
    });

    it('handles wind effects correctly', async () => {
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 70, y: 30, z: 0 },
            spin: {
                rate: 2500,
                axis: { x: 0, y: 0, z: 1 }
            },
            mass: 0.0459
        };

        const environment: Environment = {
            wind: { x: 5, y: 0, z: 2 },
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.02135,        // m
            area: Math.PI * 0.02135 * 0.02135,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };

        const trajectory = await flightModel.simulateFlight(initialState, environment, properties);

        expect(trajectory.points.length).toBeGreaterThan(0);
        const finalPoint = trajectory.points[trajectory.points.length - 1];
        expect(finalPoint.position.z).not.toBe(0); // Wind should cause lateral movement
    });

    it('handles different spin rates', async () => {
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 70, y: 30, z: 0 },
            spin: {
                rate: 3000,
                axis: { x: 0, y: 0, z: 1 }
            },
            mass: 0.0459
        };

        const environment: Environment = {
            wind: { x: 0, y: 0, z: 0 },
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.02135,        // m
            area: Math.PI * 0.02135 * 0.02135,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };

        const trajectory = await flightModel.simulateFlight(initialState, environment, properties);

        expect(trajectory.points.length).toBeGreaterThan(0);
        expect(trajectory.metrics?.spinRate).toBe(3000);
    });

    it('validates input parameters', async () => {
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 70, y: 30, z: 0 },
            spin: {
                rate: 2500,
                axis: { x: 0, y: 0, z: 1 }
            },
            mass: -1 // Invalid mass
        };

        const environment: Environment = {
            wind: { x: -2, y: 1, z: 3 },
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.02135,        // m
            area: Math.PI * 0.02135 * 0.02135,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };

        await expect(flightModel.simulateFlight(initialState, environment, properties))
            .rejects.toThrow('Invalid initial state: mass must be positive');
    });
});
