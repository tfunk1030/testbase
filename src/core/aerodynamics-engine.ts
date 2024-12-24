import { AerodynamicsEngine } from './aerodynamics';
import { Vector3D, Forces, Environment, BallProperties, SpinState } from './types';
import { WindEffectsEngine } from './wind-effects';

export class AerodynamicsEngineImpl implements AerodynamicsEngine {
    private readonly rho = 1.225;  // kg/m^3 air density at sea level
    private readonly g = 9.81;     // m/s^2 gravitational acceleration
    private readonly windEffects = new WindEffectsEngine();

    calculateForces(
        velocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        environment: Environment,
        dt?: number,
        position?: Vector3D,
        prevTurbulence?: Vector3D
    ): Forces {
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
        const viscosity = this.calculateViscosity(environment);
        const reynolds = this.calculateReynoldsNumber(speed, properties.radius * 2, viscosity);

        // Calculate drag coefficient
        const dragCoeff = this.calculateDragCoefficient(reynolds);

        // Calculate drag force
        const area = Math.PI * properties.radius * properties.radius;
        const dragMagnitude = 0.5 * this.rho * dragCoeff * area * speed * speed;

        // Calculate drag force components
        const dragForce = {
            x: speed > 0 ? -dragMagnitude * velocity.x / speed : 0,
            y: speed > 0 ? -dragMagnitude * velocity.y / speed : 0,
            z: speed > 0 ? -dragMagnitude * velocity.z / speed : 0
        };

        // Calculate Magnus force (spin effects)
        let magnusForce = { x: 0, y: 0, z: 0 };
        if (spin && speed > 0) {
            const magnusCoeff = this.calculateMagnusCoefficient(reynolds, spin.rate, speed, properties.radius * 2);
            const magnusMagnitude = 0.5 * this.rho * magnusCoeff * area * speed * speed;

            // Calculate spin axis
            const spinAxis = {
                x: spin.axis.x,
                y: spin.axis.y,
                z: spin.axis.z
            };

            // Calculate Magnus force direction (cross product of velocity and spin axis)
            magnusForce = {
                x: magnusMagnitude * (velocity.y * spinAxis.z - velocity.z * spinAxis.y) / speed,
                y: magnusMagnitude * (velocity.z * spinAxis.x - velocity.x * spinAxis.z) / speed,
                z: magnusMagnitude * (velocity.x * spinAxis.y - velocity.y * spinAxis.x) / speed
            };
        }

        // Calculate gravity force
        const gravityForce = {
            x: 0,
            y: 0,
            z: -properties.mass * this.g
        };

        // Calculate wind effects if position and dt are provided
        let windForce = { x: 0, y: 0, z: 0 };
        if (position && dt) {
            windForce = this.windEffects.calculateWindForces(
                velocity,
                position,
                environment,
                dt,
                prevTurbulence
            );
        }

        // Sum all forces
        return {
            x: dragForce.x + magnusForce.x + gravityForce.x + windForce.x,
            y: dragForce.y + magnusForce.y + gravityForce.y + windForce.y,
            z: dragForce.z + magnusForce.z + gravityForce.z + windForce.z
        };
    }

    private calculateViscosity(environment: Environment): number {
        const T = environment.temperature;
        return 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4);
    }

    private calculateReynoldsNumber(speed: number, diameter: number, viscosity: number): number {
        return speed * diameter / viscosity;
    }

    private calculateDragCoefficient(reynolds: number): number {
        // Simplified drag coefficient calculation
        if (reynolds < 1e5) {
            return 0.47; // Subcritical flow
        } else if (reynolds < 3.5e5) {
            return 0.47 - (reynolds - 1e5) * (0.47 - 0.07) / (3.5e5 - 1e5); // Transition
        } else {
            return 0.07; // Supercritical flow
        }
    }

    private calculateMagnusCoefficient(reynolds: number, spinRate: number, speed: number, diameter: number): number {
        // Calculate spin parameter
        const spinParameter = Math.PI * spinRate * diameter / (speed * 60); // RPM to rad/s conversion
        
        // Base Magnus coefficient
        let magnusCoeff = 0.25; // Base coefficient

        // Reynolds number effect
        if (reynolds > 1e5) {
            magnusCoeff *= 0.5; // Reduced effect in supercritical regime
        }

        // Spin rate effect (saturates at high spin rates)
        magnusCoeff *= Math.min(1.0, spinParameter / 0.5);

        return magnusCoeff;
    }
}
