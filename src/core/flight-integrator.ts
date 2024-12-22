import { Vector3D, Environment, BallProperties, BallState, Forces, TrajectoryPoint, Trajectory, SurfaceEffects } from './types';
import { AerodynamicsEngine } from './aerodynamics';
import { EnvironmentalSystem } from './environmental-system';

export class FlightIntegrator {
    private readonly aerodynamics: AerodynamicsEngine;
    private readonly environment: EnvironmentalSystem;
    private readonly dt: number = 0.001; // Time step in seconds
    private readonly maxTime: number = 15; // Maximum simulation time in seconds
    private readonly groundLevel: number = 0; // Ground level in meters

    constructor() {
        this.aerodynamics = new AerodynamicsEngine();
        this.environment = new EnvironmentalSystem();
    }

    /**
     * Update ball state based on forces
     */
    private updateState(state: BallState, forces: Forces, dt: number): BallState {
        // Sum all forces
        const totalForce: Vector3D = {
            x: forces.drag.x + forces.lift.x + forces.magnus.x + forces.gravity.x,
            y: forces.drag.y + forces.lift.y + forces.magnus.y + forces.gravity.y,
            z: forces.drag.z + forces.lift.z + forces.magnus.z + forces.gravity.z
        };

        // Calculate acceleration (F = ma)
        const acceleration: Vector3D = {
            x: totalForce.x / state.mass,
            y: totalForce.y / state.mass,
            z: totalForce.z / state.mass
        };

        // Update velocity using acceleration
        const newVelocity: Vector3D = {
            x: state.velocity.x + acceleration.x * dt,
            y: state.velocity.y + acceleration.y * dt,
            z: state.velocity.z + acceleration.z * dt
        };

        // Update position using velocity
        const newPosition: Vector3D = {
            x: state.position.x + state.velocity.x * dt + 0.5 * acceleration.x * dt * dt,
            y: state.position.y + state.velocity.y * dt + 0.5 * acceleration.y * dt * dt,
            z: state.position.z + state.velocity.z * dt + 0.5 * acceleration.z * dt * dt
        };

        // Apply spin decay (simplified model)
        const spinDecayFactor = 0.995; // Adjust based on research
        const newSpin: Vector3D = {
            x: state.spin.x * spinDecayFactor,
            y: state.spin.y * spinDecayFactor,
            z: state.spin.z * spinDecayFactor
        };

        return {
            ...state,
            position: newPosition,
            velocity: newVelocity,
            spin: newSpin
        };
    }

    /**
     * Check if ball has hit the ground
     */
    private hasHitGround(position: Vector3D): boolean {
        return position.y <= this.groundLevel;
    }

    /**
     * Create trajectory point from current state
     */
    private createTrajectoryPoint(state: BallState, time: number): TrajectoryPoint {
        return {
            x: state.position.x,
            y: state.position.y,
            z: state.position.z,
            vx: state.velocity.x,
            vy: state.velocity.y,
            vz: state.velocity.z,
            wx: state.spin.x,
            wy: state.spin.y,
            wz: state.spin.z,
            t: time
        };
    }

    /**
     * Calculate final trajectory metrics
     */
    private calculateTrajectoryMetrics(points: TrajectoryPoint[]): Partial<Trajectory> {
        if (points.length === 0) {
            return {
                maxHeight: 0,
                carryDistance: 0,
                flightTime: 0
            };
        }

        const maxHeight = Math.max(...points.map(p => p.y));
        const carryDistance = Math.sqrt(
            Math.pow(points[points.length - 1].x - points[0].x, 2) +
            Math.pow(points[points.length - 1].z - points[0].z, 2)
        );
        const flightTime = points[points.length - 1].t;

        return {
            maxHeight,
            carryDistance,
            flightTime
        };
    }

    /**
     * Integrate flight path
     */
    public integrate(
        initialState: BallState,
        environment: Environment,
        ballProperties: BallProperties,
        surfaceEffects: SurfaceEffects
    ): Trajectory {
        let currentState = { ...initialState };
        let time = 0;
        const points: TrajectoryPoint[] = [this.createTrajectoryPoint(currentState, time)];

        while (time < this.maxTime && !this.hasHitGround(currentState.position)) {
            // Calculate forces
            const forces = this.aerodynamics.calculateForces(
                currentState.velocity,
                currentState.spin,
                environment,
                ballProperties,
                surfaceEffects
            );

            // Update state
            currentState = this.updateState(currentState, forces, this.dt);
            time += this.dt;

            // Record point (every 10th step to reduce data size)
            if (points.length % 10 === 0) {
                points.push(this.createTrajectoryPoint(currentState, time));
            }
        }

        // Add final point
        points.push(this.createTrajectoryPoint(currentState, time));

        // Calculate trajectory metrics
        const metrics = this.calculateTrajectoryMetrics(points);

        return {
            points,
            ...metrics
        } as Trajectory;
    }
}
