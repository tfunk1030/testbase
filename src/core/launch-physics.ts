import { 
    LaunchConditions, 
    BallState, 
    Environment, 
    Vector3D,
    SpinState
} from '../types';

export class LaunchPhysics {
    /**
     * Convert launch conditions to initial ball state
     */
    public static convertToInitialState(
        conditions: LaunchConditions,
        initialHeight: number = 0
    ): BallState {
        const speed = conditions.ballSpeed;
        const launchAngleRad = conditions.launchAngle * Math.PI / 180;
        const directionRad = conditions.launchDirection * Math.PI / 180;

        // Convert launch angle and direction to velocity components
        const velocity: Vector3D = {
            x: speed * Math.cos(launchAngleRad) * Math.cos(directionRad),
            y: speed * Math.sin(launchAngleRad),
            z: speed * Math.cos(launchAngleRad) * Math.sin(directionRad)
        };

        // Normalize spin axis if not already normalized
        const spinAxisMagnitude = Math.sqrt(
            conditions.spinAxis.x * conditions.spinAxis.x +
            conditions.spinAxis.y * conditions.spinAxis.y +
            conditions.spinAxis.z * conditions.spinAxis.z
        );

        const spin: SpinState = {
            rate: conditions.spinRate,
            axis: {
                x: conditions.spinAxis.x / spinAxisMagnitude,
                y: conditions.spinAxis.y / spinAxisMagnitude,
                z: conditions.spinAxis.z / spinAxisMagnitude
            }
        };

        return {
            position: {
                x: 0,
                y: initialHeight,
                z: 0
            },
            velocity,
            spin,
            mass: 0.0456 // Default golf ball mass in kg
        };
    }

    /**
     * Calculate relative wind vector based on ball velocity and environment
     */
    public static calculateRelativeWind(
        ballVelocity: Vector3D,
        environment: Environment
    ): Vector3D {
        return {
            x: ballVelocity.x - environment.wind.x,
            y: ballVelocity.y - environment.wind.y,
            z: ballVelocity.z - environment.wind.z
        };
    }

    /**
     * Calculate the magnitude of a vector
     */
    public static calculateMagnitude(vector: Vector3D): number {
        return Math.sqrt(
            vector.x * vector.x +
            vector.y * vector.y +
            vector.z * vector.z
        );
    }

    /**
     * Normalize a vector
     */
    public static normalizeVector(vector: Vector3D): Vector3D {
        const magnitude = this.calculateMagnitude(vector);
        if (magnitude === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        return {
            x: vector.x / magnitude,
            y: vector.y / magnitude,
            z: vector.z / magnitude
        };
    }

    /**
     * Calculate cross product of two vectors
     */
    public static crossProduct(a: Vector3D, b: Vector3D): Vector3D {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        };
    }

    /**
     * Calculate dot product of two vectors
     */
    public static dotProduct(a: Vector3D, b: Vector3D): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
}
