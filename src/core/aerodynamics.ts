import { Vector3D, Forces, Environment, BallProperties, SurfaceEffects } from './types';

export class AerodynamicsEngine {
    private readonly GRAVITY = 9.81; // m/s^2
    private readonly AIR_DENSITY = 1.225; // kg/m^3
    private readonly VISCOSITY = 1.81e-5; // kg/(m·s)
    private readonly BALL_MASS = 0.0459; // kg
    private readonly BALL_RADIUS = 0.02135; // m

    // Dimple pattern effects
    private readonly DIMPLE_PATTERNS = {
        icosahedral: { coverage: 0.85, effect: 1.0 },
        octahedral: { coverage: 0.82, effect: 0.95 },
        tetrahedral: { coverage: 0.80, effect: 0.90 },
        hybrid: { coverage: 0.83, effect: 0.97 }
    };

    /**
     * Calculate Reynolds number
     */
    private calculateReynolds(velocity: number, density: number, viscosity: number): number {
        return (density * velocity * 2 * this.BALL_RADIUS) / viscosity;
    }

    /**
     * Calculate drag coefficient
     */
    private calculateDragCoefficient(reynolds: number, spinRate: number): number {
        const baseCoeff = 0.47; // Base drag coefficient for a sphere
        const reynoldsEffect = 0.1 * Math.log10(reynolds / 1e5);
        const spinEffect = 0.05 * spinRate / 1000;
        return baseCoeff - reynoldsEffect + spinEffect;
    }

    /**
     * Calculate lift coefficient
     */
    private calculateLiftCoefficient(reynolds: number, spinRate: number): number {
        const baseCoeff = 0.25; // Base lift coefficient
        const reynoldsEffect = 0.05 * Math.log10(reynolds / 1e5);
        const spinEffect = 0.1 * spinRate / 1000;
        return baseCoeff + reynoldsEffect + spinEffect;
    }

    /**
     * Calculate forces acting on the ball
     */
    public calculateForces(
        velocity: Vector3D,
        spin: Vector3D,
        environment: Environment,
        ballProperties: BallProperties,
        surfaceEffects: SurfaceEffects
    ): Forces {
        // Calculate air properties
        const density = this.AIR_DENSITY * (1 - environment.altitude / 100000);
        const viscosity = this.VISCOSITY * Math.pow(environment.temperature / 293.15, 0.76);

        // Calculate velocity magnitude and direction
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );

        // Calculate spin magnitude
        const spinMagnitude = Math.sqrt(
            spin.x * spin.x +
            spin.y * spin.y +
            spin.z * spin.z
        );

        // Calculate Reynolds number
        const reynolds = this.calculateReynolds(speed, density, viscosity);

        // Calculate drag and lift coefficients
        const dragCoeff = this.calculateDragCoefficient(reynolds, spinMagnitude);
        const liftCoeff = this.calculateLiftCoefficient(reynolds, spinMagnitude);

        // Apply surface effects
        const pattern = this.DIMPLE_PATTERNS[ballProperties.dimplePattern as keyof typeof this.DIMPLE_PATTERNS];
        const surfaceDragMod = pattern.effect * surfaceEffects.dragModifier;
        const surfaceLiftMod = pattern.effect * surfaceEffects.liftModifier;

        // Calculate force magnitudes
        const area = Math.PI * this.BALL_RADIUS * this.BALL_RADIUS;
        const dynamicPressure = 0.5 * density * speed * speed;

        const dragMagnitude = dragCoeff * surfaceDragMod * area * dynamicPressure;
        const liftMagnitude = liftCoeff * surfaceLiftMod * area * dynamicPressure;
        const gravityMagnitude = this.BALL_MASS * this.GRAVITY;

        // Calculate force vectors
        const drag: Vector3D = {
            x: -dragMagnitude * velocity.x / speed,
            y: -dragMagnitude * velocity.y / speed,
            z: -dragMagnitude * velocity.z / speed
        };

        const lift: Vector3D = {
            x: liftMagnitude * spin.x / spinMagnitude,
            y: liftMagnitude * spin.y / spinMagnitude,
            z: liftMagnitude * spin.z / spinMagnitude
        };

        const magnus: Vector3D = {
            x: 0.5 * lift.x,
            y: 0.5 * lift.y,
            z: 0.5 * lift.z
        };

        const gravity: Vector3D = {
            x: 0,
            y: -gravityMagnitude,
            z: 0
        };

        return { drag, lift, magnus, gravity };
    }
}
