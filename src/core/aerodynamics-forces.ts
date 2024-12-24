import { Vector3D, Forces, BallProperties } from './types';
import { STANDARD_AIR_DENSITY, STANDARD_BALL_AREA } from './constants';

export class AerodynamicForces {
    /**
     * Calculate Reynolds number based on velocity
     * Implementation from advanced-aerodynamics.md Reynolds Number Analysis
     */
    private calculateReynoldsNumber(
        velocity: number,
        airDensity: number,
        airViscosity: number = 1.81e-5, // Standard air viscosity
        ballDiameter: number = 0.0427    // Standard ball diameter
    ): number {
        return (airDensity * velocity * ballDiameter) / airViscosity;
    }

    /**
     * Get drag coefficient based on Reynolds number
     * Data from advanced-aerodynamics.md Reynolds Number Ranges
     */
    private getDragCoefficient(reynoldsNumber: number): number {
        if (reynoldsNumber <= 110000) return 0.235;
        if (reynoldsNumber <= 120000) return 0.230;
        if (reynoldsNumber <= 130000) return 0.225;
        if (reynoldsNumber <= 140000) return 0.220;
        if (reynoldsNumber <= 150000) return 0.215;
        if (reynoldsNumber <= 160000) return 0.210;
        if (reynoldsNumber <= 170000) return 0.205;
        return 0.200;
    }

    /**
     * Calculate vortex shedding effect
     * Data from advanced-aerodynamics.md Vortex Shedding
     */
    private calculateVortexEffect(velocity: number): number {
        if (velocity <= 120) return 1.0;  // Strong effect
        if (velocity <= 140) return 0.8;  // Moderate effect
        if (velocity <= 160) return 0.6;  // Light effect
        return 0.4;                       // Minimal effect
    }

    /**
     * Calculate circulation strength based on spin rate
     * Data from advanced-aerodynamics.md Circulation Analysis
     */
    private calculateCirculation(spinRate: number): number {
        if (spinRate <= 2000) return 1.0;
        if (spinRate <= 2500) return 1.25;
        if (spinRate <= 3000) return 1.50;
        if (spinRate <= 3500) return 1.75;
        return 2.0;
    }

    /**
     * Calculate lift coefficient based on circulation
     * Data from advanced-aerodynamics.md Advanced Lift Mechanisms
     */
    private calculateLiftCoefficient(spinRate: number): number {
        const circulation = this.calculateCirculation(spinRate);
        return 0.21 * circulation;
    }

    /**
     * Calculate drag force vector
     */
    private calculateDragForce(
        velocity: Vector3D,
        airDensity: number,
        dragCoefficient: number
    ): Vector3D {
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );
        
        const dragMagnitude = 0.5 * airDensity * STANDARD_BALL_AREA * dragCoefficient * speed * speed;
        
        return {
            x: -dragMagnitude * velocity.x / speed,
            y: -dragMagnitude * velocity.y / speed,
            z: -dragMagnitude * velocity.z / speed
        };
    }

    /**
     * Calculate lift force vector
     */
    private calculateLiftForce(
        velocity: Vector3D,
        spinVector: Vector3D,
        airDensity: number,
        liftCoefficient: number
    ): Vector3D {
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );

        const liftMagnitude = 0.5 * airDensity * STANDARD_BALL_AREA * liftCoefficient * speed * speed;
        
        // Calculate lift direction (perpendicular to both velocity and spin axis)
        const crossProduct = {
            x: spinVector.y * velocity.z - spinVector.z * velocity.y,
            y: spinVector.z * velocity.x - spinVector.x * velocity.z,
            z: spinVector.x * velocity.y - spinVector.y * velocity.x
        };
        
        const crossMagnitude = Math.sqrt(
            crossProduct.x * crossProduct.x +
            crossProduct.y * crossProduct.y +
            crossProduct.z * crossProduct.z
        );
        
        return {
            x: liftMagnitude * crossProduct.x / crossMagnitude,
            y: liftMagnitude * crossProduct.y / crossMagnitude,
            z: liftMagnitude * crossProduct.z / crossMagnitude
        };
    }

    /**
     * Calculate all aerodynamic forces
     */
    public calculateForces(
        velocity: Vector3D,
        spinVector: Vector3D,
        airDensity: number = STANDARD_AIR_DENSITY,
        ballProperties: BallProperties
    ): Forces {
        // Calculate basic parameters
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );

        // Calculate Reynolds number and coefficients
        const reynoldsNumber = this.calculateReynoldsNumber(speed, airDensity);
        const dragCoefficient = this.getDragCoefficient(reynoldsNumber);
        const liftCoefficient = this.calculateLiftCoefficient(Math.sqrt(
            spinVector.x * spinVector.x +
            spinVector.y * spinVector.y +
            spinVector.z * spinVector.z
        ));

        // Apply vortex shedding effect
        const vortexEffect = this.calculateVortexEffect(speed);
        const adjustedDragCoeff = dragCoefficient * (1 + 0.1 * vortexEffect);

        // Calculate forces
        const drag = this.calculateDragForce(velocity, airDensity, adjustedDragCoeff);
        const lift = this.calculateLiftForce(velocity, spinVector, airDensity, liftCoefficient);

        return {
            drag,
            lift,
            magnus: lift,  // Magnus force is the same as lift force
            gravity: { x: 0, y: -9.81 * ballProperties.mass, z: 0 }
        };
    }
}
