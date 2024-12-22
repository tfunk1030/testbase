import { Vector3D, Forces, Environment, BallProperties, SurfaceEffects } from './types';

export class AerodynamicsEngine {
    private readonly GRAVITY = 9.81; // m/s^2
    private readonly AIR_DENSITY = 1.225; // kg/m^3 at sea level
    private readonly VISCOSITY = 1.81e-5; // kg/(m·s)

    // Dimple pattern effects
    private readonly DIMPLE_PATTERNS = {
        icosahedral: { coverage: 0.85, effect: 1.0 },
        octahedral: { coverage: 0.82, effect: 0.95 },
        tetrahedral: { coverage: 0.80, effect: 0.90 },
        hybrid: { coverage: 0.83, effect: 0.97 }
    } as const;

    /**
     * Get dimple effect for a pattern
     */
    private getDimpleEffect(pattern: string): number {
        switch (pattern) {
            case 'icosahedral':
                return this.DIMPLE_PATTERNS.icosahedral.effect;
            case 'octahedral':
                return this.DIMPLE_PATTERNS.octahedral.effect;
            case 'tetrahedral':
                return this.DIMPLE_PATTERNS.tetrahedral.effect;
            case 'hybrid':
                return this.DIMPLE_PATTERNS.hybrid.effect;
            default:
                return 1.0;
        }
    }

    /**
     * Calculate Reynolds number
     */
    private calculateReynolds(velocity: number, density: number, viscosity: number, diameter: number): number {
        return (density * velocity * diameter) / viscosity;
    }

    /**
     * Calculate drag coefficient based on Reynolds number and spin rate
     */
    private calculateDragCoefficient(reynoldsNumber: number, spinRate: number): number {
        // Base drag coefficient for a golf ball (typical range: 0.2 - 0.5)
        let cd = 0.21;  // Reduced from 0.25 for better carry distance

        // Adjust for Reynolds number effects
        if (reynoldsNumber < 40000) {
            // Laminar flow regime
            cd = 0.35;  // Reduced from 0.45
        } else if (reynoldsNumber < 100000) {
            // Transitional regime
            cd = 0.28;  // Reduced from 0.35
        } else {
            // Turbulent regime
            cd = 0.21;  // Reduced from 0.25
        }

        // Add spin effects (increased drag due to backspin)
        const spinFactor = Math.min(spinRate / 3500, 1.2);  // Adjusted from 3000 and 1.5
        cd += 0.04 * spinFactor;  // Reduced from 0.05

        return cd;
    }

    /**
     * Calculate lift coefficient based on spin rate and Reynolds number
     */
    private calculateLiftCoefficient(spinRate: number, reynoldsNumber: number): number {
        // Base lift coefficient (typical range: 0.1 - 0.3)
        let cl = 0.18;  // Increased from 0.15 for better height

        // Adjust for spin rate (more spin = more lift)
        const spinFactor = Math.min(spinRate / 2200, 1.4);  // Adjusted from 2500 and 1.2
        cl *= spinFactor;

        // Reynolds number effects on lift
        if (reynoldsNumber < 50000) {
            cl *= 0.85;  // Increased from 0.8 for better lift at low speeds
        } else if (reynoldsNumber > 200000) {
            cl *= 1.25;  // Increased from 1.2 for better lift at high speeds
        }

        return cl;
    }

    /**
     * Calculate Magnus force coefficient based on spin axis and rate
     */
    private calculateMagnusCoefficient(spinAxis: number, spinRate: number): number {
        // Base Magnus coefficient (typical range: 0.1 - 0.25)
        const baseCm = 0.18;  // Increased from 0.15 for better side spin effects

        // Adjust for spin rate
        const spinFactor = Math.min(spinRate / 1800, 1.2);  // Adjusted from 2000 and 1.0

        // Adjust for spin axis (maximum effect at 90 degrees)
        const axisFactor = Math.sin(spinAxis * Math.PI / 180);

        return baseCm * spinFactor * axisFactor;
    }

    /**
     * Calculate forces acting on the ball
     */
    public calculateForces(
        state: { velocity: Vector3D; spin: Vector3D; mass: number },
        environment: Environment,
        ballProperties: BallProperties
    ): Forces {
        // Calculate velocity magnitude
        const velocity = Math.sqrt(
            state.velocity.x * state.velocity.x +
            state.velocity.y * state.velocity.y +
            state.velocity.z * state.velocity.z
        );

        // Calculate spin magnitude in rad/s
        const spinRate = Math.sqrt(
            state.spin.x * state.spin.x +
            state.spin.y * state.spin.y +
            state.spin.z * state.spin.z
        );

        // Prevent division by zero
        if (velocity < 0.1) {
            return {
                drag: { x: 0, y: 0, z: 0 },
                lift: { x: 0, y: 0, z: 0 },
                magnus: { x: 0, y: 0, z: 0 },
                gravity: { x: 0, y: -this.GRAVITY * state.mass, z: 0 }
            };
        }

        // Get dimple effect from ball properties
        const dimpleEffect = this.getDimpleEffect(ballProperties.dimplePattern);

        // Calculate Reynolds number
        const reynolds = this.calculateReynolds(
            velocity,
            this.AIR_DENSITY,
            this.VISCOSITY,
            ballProperties.diameter
        );

        // Calculate drag coefficient
        const cd = this.calculateDragCoefficient(reynolds, spinRate);

        // Calculate lift coefficient
        const cl = this.calculateLiftCoefficient(spinRate, reynolds);

        // Calculate Magnus coefficient
        const cm = this.calculateMagnusCoefficient(45, spinRate); // Assuming a 45-degree spin axis

        // Calculate reference area
        const area = Math.PI * Math.pow(ballProperties.diameter / 2, 2);

        // Calculate dynamic pressure
        const dynamicPressure = 0.5 * this.AIR_DENSITY * velocity * velocity;

        // Calculate drag force magnitude
        const dragMagnitude = cd * dynamicPressure * area;

        // Calculate lift force magnitude
        const liftMagnitude = cl * dynamicPressure * area;

        // Calculate Magnus force magnitude
        const magnusMagnitude = cm * dynamicPressure * area;

        // Calculate unit vectors
        const velocityUnit = {
            x: state.velocity.x / velocity,
            y: state.velocity.y / velocity,
            z: state.velocity.z / velocity
        };

        // Calculate spin axis unit vector
        const spinMagnitude = Math.max(0.1, spinRate); // Prevent division by zero
        const spinUnit = {
            x: state.spin.x / spinMagnitude,
            y: state.spin.y / spinMagnitude,
            z: state.spin.z / spinMagnitude
        };

        // Calculate lift direction (cross product of velocity and spin)
        const liftDirection = {
            x: velocityUnit.y * spinUnit.z - velocityUnit.z * spinUnit.y,
            y: velocityUnit.z * spinUnit.x - velocityUnit.x * spinUnit.z,
            z: velocityUnit.x * spinUnit.y - velocityUnit.y * spinUnit.x
        };

        // Normalize lift direction
        const liftMag = Math.sqrt(
            liftDirection.x * liftDirection.x +
            liftDirection.y * liftDirection.y +
            liftDirection.z * liftDirection.z
        );

        if (liftMag > 0.001) {
            liftDirection.x /= liftMag;
            liftDirection.y /= liftMag;
            liftDirection.z /= liftMag;
        }

        // Calculate forces
        const drag = {
            x: -dragMagnitude * velocityUnit.x,
            y: -dragMagnitude * velocityUnit.y,
            z: -dragMagnitude * velocityUnit.z
        };

        const lift = {
            x: liftMagnitude * liftDirection.x,
            y: liftMagnitude * liftDirection.y,
            z: liftMagnitude * liftDirection.z
        };

        const magnus = {
            x: magnusMagnitude * spinUnit.x,
            y: magnusMagnitude * spinUnit.y,
            z: magnusMagnitude * spinUnit.z
        };

        // Gravity force
        const gravity = {
            x: 0,
            y: -this.GRAVITY * state.mass,
            z: 0
        };

        return { drag, lift, magnus, gravity };
    }
}
