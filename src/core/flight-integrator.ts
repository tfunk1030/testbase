import { Vector3D, Environment, BallProperties, BallState, Forces, TrajectoryPoint, Trajectory, SurfaceEffects, LaunchConditions } from './types';
import { AerodynamicsEngine } from './aerodynamics';
import { EnvironmentalSystem } from './environmental-system';

export class FlightIntegrator {
    private readonly aerodynamics: AerodynamicsEngine;
    private readonly environment: EnvironmentalSystem;
    private readonly dt: number = 0.0005; // Reduced time step for better accuracy
    private readonly maxTime: number = 15; // Maximum simulation time in seconds
    private readonly groundLevel: number = 0; // Ground level in meters

    constructor() {
        this.aerodynamics = new AerodynamicsEngine();
        this.environment = new EnvironmentalSystem();
    }

    /**
     * Create trajectory point from state
     */
    private createTrajectoryPoint(state: BallState, t: number): TrajectoryPoint {
        return {
            position: state.position,
            velocity: state.velocity,
            spin: state.spin,
            time: t,
            x: state.position.x,
            y: state.position.y,
            z: state.position.z,
            vx: state.velocity.x,
            vy: state.velocity.y,
            vz: state.velocity.z,
            wx: state.spin.x,
            wy: state.spin.y,
            wz: state.spin.z,
            t
        };
    }

    /**
     * Update ball state based on forces using RK4 integration
     */
    private updateState(state: BallState, forces: Forces, dt: number): BallState {
        // RK4 integration for better accuracy
        const k1 = this.calculateDerivatives(state, forces);
        const k2 = this.calculateDerivatives(this.getStateAtK(state, k1, dt/2), forces);
        const k3 = this.calculateDerivatives(this.getStateAtK(state, k2, dt/2), forces);
        const k4 = this.calculateDerivatives(this.getStateAtK(state, k3, dt), forces);

        // Update position and velocity using RK4
        const newPosition: Vector3D = {
            x: state.position.x + (dt/6) * (k1.dx + 2*k2.dx + 2*k3.dx + k4.dx),
            y: state.position.y + (dt/6) * (k1.dy + 2*k2.dy + 2*k3.dy + k4.dy),
            z: state.position.z + (dt/6) * (k1.dz + 2*k2.dz + 2*k3.dz + k4.dz)
        };

        const newVelocity: Vector3D = {
            x: state.velocity.x + (dt/6) * (k1.dvx + 2*k2.dvx + 2*k3.dvx + k4.dvx),
            y: state.velocity.y + (dt/6) * (k1.dvy + 2*k2.dvy + 2*k3.dvy + k4.dvy),
            z: state.velocity.z + (dt/6) * (k1.dvz + 2*k2.dvz + 2*k3.dvz + k4.dvz)
        };

        // Calculate spin decay (air resistance reduces spin rate)
        const spinDecayRate = 0.985; // Adjusted for more realistic spin decay
        const newSpin: Vector3D = {
            x: state.spin.x * Math.pow(spinDecayRate, dt / 0.001),
            y: state.spin.y * Math.pow(spinDecayRate, dt / 0.001),
            z: state.spin.z * Math.pow(spinDecayRate, dt / 0.001)
        };

        return {
            position: newPosition,
            velocity: newVelocity,
            spin: newSpin,
            mass: state.mass
        };
    }

    /**
     * Calculate state derivatives for RK4 integration
     */
    private calculateDerivatives(state: BallState, forces: Forces): {
        dx: number; dy: number; dz: number;
        dvx: number; dvy: number; dvz: number;
    } {
        // Position derivatives (velocity)
        const dx = state.velocity.x;
        const dy = state.velocity.y;
        const dz = state.velocity.z;

        // Velocity derivatives (acceleration = F/m)
        const totalForce = {
            x: forces.drag.x + forces.lift.x + forces.magnus.x + forces.gravity.x,
            y: forces.drag.y + forces.lift.y + forces.magnus.y + forces.gravity.y,
            z: forces.drag.z + forces.lift.z + forces.magnus.z + forces.gravity.z
        };

        const dvx = totalForce.x / state.mass;
        const dvy = totalForce.y / state.mass;
        const dvz = totalForce.z / state.mass;

        return { dx, dy, dz, dvx, dvy, dvz };
    }

    /**
     * Get intermediate state for RK4 integration
     */
    private getStateAtK(state: BallState, k: {
        dx: number; dy: number; dz: number;
        dvx: number; dvy: number; dvz: number;
    }, dt: number): BallState {
        return {
            position: {
                x: state.position.x + k.dx * dt,
                y: state.position.y + k.dy * dt,
                z: state.position.z + k.dz * dt
            },
            velocity: {
                x: state.velocity.x + k.dvx * dt,
                y: state.velocity.y + k.dvy * dt,
                z: state.velocity.z + k.dvz * dt
            },
            spin: state.spin,  // Spin doesn't change for intermediate states
            mass: state.mass
        };
    }

    /**
     * Handle ground collision
     */
    private handleGroundCollision(state: BallState): { state: BallState; landingAngle?: number } {
        if (state.position.y <= this.groundLevel) {
            // Calculate landing angle
            const landingAngle = Math.atan2(-state.velocity.y, 
                Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.z * state.velocity.z)) * 180 / Math.PI;

            // Stop the simulation at ground contact
            return {
                state: {
                    position: { ...state.position, y: this.groundLevel },
                    velocity: { x: 0, y: 0, z: 0 },
                    spin: { x: 0, y: 0, z: 0 },
                    mass: state.mass
                },
                landingAngle
            };
        }
        return { state };
    }

    /**
     * Simulate flight path
     */
    public simulateFlight(
        initialState: BallState,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        let currentState = { ...initialState };
        let landingAngle = 0;
        const points: TrajectoryPoint[] = [
            this.createTrajectoryPoint(currentState, 0)
        ];

        let maxHeight = 0;
        let t = 0;

        while (t < this.maxTime) {
            // Calculate forces
            const forces = this.aerodynamics.calculateForces(
                currentState,
                environment,
                ballProperties
            );

            // Update state
            currentState = this.updateState(currentState, forces, this.dt);

            // Handle ground collision
            const { state: newState, landingAngle: newLandingAngle } = this.handleGroundCollision(currentState);
            if (newState !== currentState) {
                points.push(this.createTrajectoryPoint(newState, t + this.dt));
                currentState = newState;
                landingAngle = newLandingAngle || 0;
                break;
            }

            // Update maximum height
            maxHeight = Math.max(maxHeight, currentState.position.y);

            // Record point
            if (t % 0.01 < this.dt) { // Record every 0.01 seconds
                points.push(this.createTrajectoryPoint(currentState, t + this.dt));
            }

            t += this.dt;
        }

        // Calculate trajectory metrics
        const carryDistance = Math.sqrt(
            Math.pow(points[points.length - 1].position.x - points[0].position.x, 2) +
            Math.pow(points[points.length - 1].position.z - points[0].position.z, 2)
        );

        const totalDistance = carryDistance; // For now, total = carry (no roll)
        const flightTime = points[points.length - 1].t;
        const lateralDeviation = points[points.length - 1].position.z;

        // Calculate initial conditions from initial state
        const speed = Math.sqrt(
            initialState.velocity.x * initialState.velocity.x +
            initialState.velocity.y * initialState.velocity.y +
            initialState.velocity.z * initialState.velocity.z
        );

        const launchAngle = Math.atan2(initialState.velocity.y,
            Math.sqrt(initialState.velocity.x * initialState.velocity.x +
                initialState.velocity.z * initialState.velocity.z)) * 180 / Math.PI;

        const launchDirection = Math.atan2(initialState.velocity.z,
            initialState.velocity.x) * 180 / Math.PI;

        const spinMagnitude = Math.sqrt(
            initialState.spin.x * initialState.spin.x +
            initialState.spin.y * initialState.spin.y +
            initialState.spin.z * initialState.spin.z
        );

        const spinAxis = Math.atan2(initialState.spin.x,
            Math.sqrt(initialState.spin.y * initialState.spin.y +
                initialState.spin.z * initialState.spin.z)) * 180 / Math.PI;

        const initialConditions: LaunchConditions = {
            ballSpeed: speed,
            launchAngle,
            launchDirection,
            totalSpin: spinMagnitude,
            spinAxis
        };

        return {
            points,
            initialConditions,
            environment,
            ballProperties,
            maxHeight,
            carryDistance,
            totalDistance,
            flightTime,
            landingAngle,
            lateralDeviation
        };
    }

    /**
     * Simulate flight path (alias for simulateFlight)
     */
    public integrate(
        initialState: BallState,
        environment: Environment,
        ballProperties: BallProperties
    ): Trajectory {
        return this.simulateFlight(initialState, environment, ballProperties);
    }
}
