import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { Vector3D, SpinState, Environment, BallProperties } from '../core/types';

describe('AerodynamicsEngine', () => {
    let engine: AerodynamicsEngineImpl;

    beforeEach(() => {
        engine = new AerodynamicsEngineImpl();
    });

    it('calculates forces correctly for standard conditions', () => {
        const velocity: Vector3D = { x: 70, y: 30, z: 0 };
        const spin: SpinState = {
            rate: 2500,
            axis: { x: 0, y: 0, z: 1 }
        };
        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.0214,        // m
            area: Math.PI * 0.0214 * 0.0214,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };
        const environment: Environment = {
            wind: { x: 0, y: 0, z: 0 },
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const forces = engine.calculateForces(velocity, spin, properties, environment);

        // Verify drag force
        expect(forces.drag.x).toBeLessThan(0);
        expect(forces.drag.y).toBeLessThan(0);
        expect(Math.abs(forces.drag.z)).toBeLessThan(1e-10);

        // Verify lift force
        expect(forces.lift.y).toBeGreaterThan(0);
        expect(Math.abs(forces.lift.x)).toBeLessThan(Math.abs(forces.lift.y));
        expect(Math.abs(forces.lift.z)).toBeLessThan(Math.abs(forces.lift.y));

        // Verify Magnus force
        expect(forces.magnus.y).toBeGreaterThan(0);
        expect(Math.abs(forces.magnus.x)).toBeLessThan(Math.abs(forces.magnus.y));
        expect(Math.abs(forces.magnus.z)).toBeLessThan(Math.abs(forces.magnus.y));

        // Verify gravity
        expect(forces.gravity.x).toBe(0);
        expect(forces.gravity.y).toBeLessThan(0);
        expect(forces.gravity.z).toBe(0);
    });

    it('handles zero velocity correctly', () => {
        const velocity: Vector3D = { x: 0, y: 0, z: 0 };
        const spin: SpinState = {
            rate: 2500,
            axis: { x: 0, y: 0, z: 1 }
        };
        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.0214,        // m
            area: Math.PI * 0.0214 * 0.0214,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };
        const environment: Environment = {
            wind: { x: 0, y: 0, z: 0 },
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const forces = engine.calculateForces(velocity, spin, properties, environment);

        // Only gravity should be non-zero
        expect(forces.drag.x).toBe(0);
        expect(forces.drag.y).toBe(0);
        expect(forces.drag.z).toBe(0);

        expect(forces.lift.x).toBe(0);
        expect(forces.lift.y).toBe(0);
        expect(forces.lift.z).toBe(0);

        expect(forces.magnus.x).toBe(0);
        expect(forces.magnus.y).toBe(0);
        expect(forces.magnus.z).toBe(0);

        expect(forces.gravity.x).toBe(0);
        expect(forces.gravity.y).toBeLessThan(0);
        expect(forces.gravity.z).toBe(0);
    });

    it('handles wind effects correctly', () => {
        const velocity: Vector3D = { x: 70, y: 30, z: 0 };
        const spin: SpinState = {
            rate: 2500,
            axis: { x: 0, y: 0, z: 1 }
        };
        const properties: BallProperties = {
            mass: 0.0459,          // kg
            radius: 0.0214,        // m
            area: Math.PI * 0.0214 * 0.0214,  // m^2
            dragCoefficient: 0.23,
            liftCoefficient: 0.15,
            magnusCoefficient: 0.12,
            spinDecayRate: 100     // rpm/s
        };
        const environment: Environment = {
            wind: { x: -10, y: 0, z: 10 }, 
            temperature: 20,
            pressure: 101325,
            humidity: 0.5,
            altitude: 0
        };

        const forces = engine.calculateForces(velocity, spin, properties, environment);

        // Verify forces with wind
        expect(Math.abs(forces.drag.x)).toBeGreaterThan(0);
        expect(Math.abs(forces.drag.y)).toBeGreaterThan(0);
        expect(Math.abs(forces.drag.z)).toBeGreaterThan(0);
        expect(forces.lift.y).toBeGreaterThan(0);
        expect(forces.magnus.y).toBeGreaterThan(0);

        // Compare with no wind case
        const noWindForces = engine.calculateForces(
            velocity,
            spin,
            properties,
            { ...environment, wind: { x: 0, y: 0, z: 0 } }
        );

        // Verify that forces are different with wind
        expect(Math.abs(forces.drag.x)).not.toBeCloseTo(Math.abs(noWindForces.drag.x), 5);
        expect(Math.abs(forces.drag.z)).not.toBeCloseTo(Math.abs(noWindForces.drag.z), 5);

        // Gravity should be unaffected by wind
        expect(forces.gravity).toEqual(noWindForces.gravity);
    });
});
