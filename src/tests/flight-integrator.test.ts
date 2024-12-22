import { FlightIntegrator } from '../core/flight-integrator';
import { AerodynamicsEngineImpl } from '../core/aerodynamics';
import { BallState, Environment, BallProperties } from '../core/types';

describe('FlightIntegrator', () => {
    let flightIntegrator: FlightIntegrator;
    let aerodynamicsEngine: AerodynamicsEngineImpl;

    beforeEach(() => {
        flightIntegrator = new FlightIntegrator();
        aerodynamicsEngine = new AerodynamicsEngineImpl();
    });

    it('should simulate basic flight trajectory', async () => {
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

        const trajectory = await flightIntegrator.simulateFlight(
            initialState,
            environment,
            properties,
            aerodynamicsEngine
        );

        expect(trajectory.points.length).toBeGreaterThan(0);
        expect(trajectory.metrics).toBeDefined();
        expect(trajectory.metrics?.carryDistance).toBeGreaterThan(0);
        expect(trajectory.metrics?.maxHeight).toBeGreaterThan(0);
        expect(trajectory.metrics?.flightTime).toBeGreaterThan(0);
    });

    it('should handle zero initial velocity', async () => {
        const initialState: BallState = {
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            spin: {
                rate: 0,
                axis: { x: 0, y: 1, z: 0 }
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

        const trajectory = await flightIntegrator.simulateFlight(
            initialState,
            environment,
            properties,
            aerodynamicsEngine
        );

        expect(trajectory.points.length).toBeGreaterThan(0);
        expect(trajectory.metrics).toBeDefined();
        expect(Math.abs(trajectory.metrics?.carryDistance || 0)).toBeLessThan(1e-10);
        expect(Math.abs(trajectory.metrics?.maxHeight || 0)).toBeLessThan(1e-10);
    });

    it('should handle wind effects', async () => {
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

        const trajectory = await flightIntegrator.simulateFlight(
            initialState,
            environment,
            properties,
            aerodynamicsEngine
        );

        // Wind should affect final position
        const finalPoint = trajectory.points[trajectory.points.length - 1];
        expect(finalPoint.position.z).not.toBe(0); // Wind should cause lateral movement
    });
});

function calculateTotalEnergy(point: any): number {
    const mass = 0.0459; // kg
    const g = 9.81; // m/s^2
    const radius = 0.0214; // meters

    // Kinetic energy: 1/2 * m * v^2
    const velocity = Math.sqrt(
        point.velocity.x * point.velocity.x +
        point.velocity.y * point.velocity.y +
        point.velocity.z * point.velocity.z
    );
    const kineticEnergy = 0.5 * mass * velocity * velocity;

    // Potential energy: m * g * h
    const potentialEnergy = mass * g * point.position.y;

    // Rotational energy: 1/2 * I * ω^2
    // Assuming ball is a solid sphere: I = 2/5 * m * r^2
    const momentOfInertia = (2/5) * mass * radius * radius;
    const angularVelocity = point.spin.rate * 2 * Math.PI / 60; // Convert RPM to rad/s
    const rotationalEnergy = 0.5 * momentOfInertia * angularVelocity * angularVelocity;

    return kineticEnergy + potentialEnergy + rotationalEnergy;
}
