import { BallState, Vector3D } from './types';

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
     * Calculate landing angle
     */
    private calculateLandingAngle(velocity: Vector3D): number {
        const horizontalSpeed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.z * velocity.z
        );
        return Math.atan2(-velocity.y, horizontalSpeed) * (180 / Math.PI);
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
            mass: currentState.mass
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
