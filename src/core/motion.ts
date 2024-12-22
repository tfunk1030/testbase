import { BallState, Vector3D } from './types';
import { GRAVITY } from './constants';

export class MotionEngine {
    /**
     * Calculate spin decay based on research data
     * Spin(t) = S₀e^(-kt) where k is decay constant
     */
    private calculateSpinDecay(initialSpin: Vector3D, time: number): Vector3D {
        const k = 0.08; // Decay constant from research
        const decayFactor = Math.exp(-k * time);
        return {
            x: initialSpin.x * decayFactor,
            y: initialSpin.y * decayFactor,
            z: initialSpin.z * decayFactor
        };
    }

    /**
     * Calculate trajectory parameters at a given time
     * Using formulas from trajectory-physics.md
     */
    private calculateTrajectoryParams(
        v0: number,      // Initial velocity
        theta: number,   // Launch angle
        t: number,       // Time
        cl: number,      // Lift coefficient
        cd: number,      // Drag coefficient
        mass: number     // Ball mass
    ): { height: number; distance: number } {
        // Height(t) = v₀sin(θ)t - (g/2)t² + (CL/m)t²
        const height = v0 * Math.sin(theta) * t - 
                      (GRAVITY / 2) * t * t + 
                      (cl / mass) * t * t;

        // Distance(t) = v₀cos(θ)t - (CD/m)t²
        const distance = v0 * Math.cos(theta) * t - 
                        (cd / mass) * t * t;

        return { height, distance };
    }

    /**
     * Calculate landing angle based on final velocities
     */
    private calculateLandingAngle(velocity: Vector3D): number {
        return Math.atan2(-velocity.y, Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z));
    }

    /**
     * RK4 integration step
     */
    private rk4Step(
        state: BallState,
        dt: number,
        forces: (s: BallState) => Vector3D
    ): BallState {
        // k1 = f(t, y)
        const k1 = forces(state);
        
        // k2 = f(t + dt/2, y + dt*k1/2)
        const k2 = forces({
            ...state,
            position: {
                x: state.position.x + dt * k1.x / 2,
                y: state.position.y + dt * k1.y / 2,
                z: state.position.z + dt * k1.z / 2
            }
        });
        
        // k3 = f(t + dt/2, y + dt*k2/2)
        const k3 = forces({
            ...state,
            position: {
                x: state.position.x + dt * k2.x / 2,
                y: state.position.y + dt * k2.y / 2,
                z: state.position.z + dt * k2.z / 2
            }
        });
        
        // k4 = f(t + dt, y + dt*k3)
        const k4 = forces({
            ...state,
            position: {
                x: state.position.x + dt * k3.x,
                y: state.position.y + dt * k3.y,
                z: state.position.z + dt * k3.z
            }
        });
        
        // y(t + dt) = y(t) + dt*(k1 + 2k2 + 2k3 + k4)/6
        return {
            position: {
                x: state.position.x + dt * (k1.x + 2*k2.x + 2*k3.x + k4.x) / 6,
                y: state.position.y + dt * (k1.y + 2*k2.y + 2*k3.y + k4.y) / 6,
                z: state.position.z + dt * (k1.z + 2*k2.z + 2*k3.z + k4.z) / 6
            },
            velocity: state.velocity,
            spin: this.calculateSpinDecay(state.spin, state.time + dt),
            mass: state.mass,
            time: state.time + dt
        };
    }

    /**
     * Calculate motion using complete physics model
     */
    public calculateMotion(
        state: BallState,
        dt: number,
        forces: (s: BallState) => Vector3D
    ): BallState {
        // Use RK4 integration for accurate trajectory
        const newState = this.rk4Step(state, dt, forces);
        
        // Calculate trajectory parameters
        const v0 = Math.sqrt(
            state.velocity.x * state.velocity.x +
            state.velocity.y * state.velocity.y +
            state.velocity.z * state.velocity.z
        );
        const theta = Math.atan2(state.velocity.y, Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.z * state.velocity.z));
        
        // Store additional parameters (these will be used later)
        const params = this.calculateTrajectoryParams(
            v0,
            theta,
            newState.time,
            0.2, // Placeholder lift coefficient
            0.3, // Placeholder drag coefficient
            newState.mass // Ball mass
        );
        
        return {
            position: newState.position,
            velocity: newState.velocity,
            spin: newState.spin,
            mass: newState.mass,
            time: newState.time
        };
    }
}

import { Vector3D, BallState } from './types';

export class MotionCalculator {
    private readonly GRAVITY = -9.81; // m/s²

    /**
     * Calculate velocity magnitude
     */
    private calculateVelocityMagnitude(velocity: Vector3D): number {
        return Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );
    }

    /**
     * Calculate Reynolds number
     */
    private calculateReynoldsNumber(
        velocity: Vector3D,
        diameter: number,
        airDensity: number,
        viscosity: number
    ): number {
        const velocityMagnitude = this.calculateVelocityMagnitude(velocity);
        return (airDensity * velocityMagnitude * diameter) / viscosity;
    }

    /**
     * Calculate drag coefficient
     */
    private calculateDragCoefficient(reynoldsNumber: number): number {
        // Simplified drag coefficient calculation
        if (reynoldsNumber < 1e5) {
            return 0.5; // Laminar flow
        } else if (reynoldsNumber < 2e5) {
            return 0.1; // Transition region
        } else {
            return 0.3; // Turbulent flow
        }
    }

    /**
     * Calculate lift coefficient
     */
    private calculateLiftCoefficient(
        spinRate: number,
        velocity: Vector3D,
        diameter: number
    ): number {
        const velocityMagnitude = this.calculateVelocityMagnitude(velocity);
        const spinFactor = (spinRate * Math.PI * diameter) / (velocityMagnitude * 60);
        return 0.2 * spinFactor; // Simplified lift coefficient
    }

    /**
     * Update ball state
     */
    public updateState(
        currentState: BallState,
        forces: Vector3D,
        dt: number
    ): BallState {
        // Calculate acceleration
        const acceleration: Vector3D = {
            x: forces.x / currentState.mass,
            y: forces.y / currentState.mass + this.GRAVITY,
            z: forces.z / currentState.mass
        };

        // Update velocity
        const newVelocity: Vector3D = {
            x: currentState.velocity.x + acceleration.x * dt,
            y: currentState.velocity.y + acceleration.y * dt,
            z: currentState.velocity.z + acceleration.z * dt
        };

        // Update position
        const newPosition: Vector3D = {
            x: currentState.position.x + currentState.velocity.x * dt + 0.5 * acceleration.x * dt * dt,
            y: currentState.position.y + currentState.velocity.y * dt + 0.5 * acceleration.y * dt * dt,
            z: currentState.position.z + currentState.velocity.z * dt + 0.5 * acceleration.z * dt * dt
        };

        // Apply spin decay (simplified)
        const spinDecayFactor = Math.exp(-0.1 * dt); // Adjust decay rate as needed
        const newSpin: Vector3D = {
            x: currentState.spin.x * spinDecayFactor,
            y: currentState.spin.y * spinDecayFactor,
            z: currentState.spin.z * spinDecayFactor
        };

        return {
            position: newPosition,
            velocity: newVelocity,
            spin: newSpin,
            mass: currentState.mass,
            time: currentState.time + dt
        };
    }

    /**
     * Calculate impact angle
     */
    public calculateImpactAngle(finalState: BallState): number {
        const velocityMagnitude = this.calculateVelocityMagnitude(finalState.velocity);
        if (velocityMagnitude === 0) return 0;

        return Math.atan2(-finalState.velocity.y, Math.sqrt(
            finalState.velocity.x * finalState.velocity.x +
            finalState.velocity.z * finalState.velocity.z
        )) * (180 / Math.PI);
    }
}
