import { SpinState, BallProperties, Environment, Vector3D } from './types';
import { AerodynamicsEngineImpl } from './aerodynamics';

export interface SpinDecayValidationResult {
    isValid: boolean;
    finalSpinRate: number;
    spinDecayRate: number;
    errors?: string[];
    warnings?: string[];
}

export interface TrajectorySpinDecayResult {
    isValid: boolean;
    spinRates: number[];
    errors?: string[];
    warnings?: string[];
}

export class SpinDecayValidator {
    private readonly aero = new AerodynamicsEngineImpl();
    
    // Validation thresholds
    private readonly MAX_DECAY_RATE = 2000;  // rpm/s
    private readonly MIN_DECAY_RATE = 5;     // rpm/s
    private readonly DECAY_RATE_TOLERANCE = 0.20;  // 20%
    private readonly SPIN_DECAY_BASE = 100;  // rpm/s

    /**
     * Calculate spin decay rate based on aerodynamic conditions
     */
    private calculateSpinDecayRate(
        initialSpin: number,
        velocity: number,
        radius: number,
        environment: Environment
    ): number {
        // Calculate non-dimensional spin parameter
        const spinParameter = (radius * initialSpin * Math.PI / 15) / velocity;
        
        // Base decay rate adjusted for spin parameter
        let decayRate = this.SPIN_DECAY_BASE * (1 + spinParameter * 1.5);
        
        // Velocity effects - quadratic increase with velocity
        const velocityFactor = Math.pow(velocity / 45, 2);  // Normalized to typical driver speed
        decayRate *= (1 + velocityFactor);
        
        // Air density effects
        const rho = this.aero.calculateAirDensity(environment);
        const rhoSL = 1.225;  // sea level density
        decayRate *= Math.pow(rho / rhoSL, 0.8);  // Less sensitive to density
        
        return decayRate;
    }
    
    /**
     * Validate initial spin decay
     */
    public validateInitialSpinDecay(
        initialSpin: SpinState,
        velocity: Vector3D,
        properties: BallProperties,
        environment: Environment
    ): SpinDecayValidationResult {
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );

        // Calculate decay rate
        const decayRate = this.calculateSpinDecayRate(
            initialSpin.rate,
            speed,
            properties.radius,
            environment
        );

        // Simulate spin decay over a short time
        const dt = 0.01;  // 10ms
        const finalSpinRate = initialSpin.rate * Math.exp(-decayRate * dt);

        // Validate decay rate is within physical limits
        const isValid = decayRate > this.MIN_DECAY_RATE && decayRate < this.MAX_DECAY_RATE;

        return {
            isValid,
            finalSpinRate,
            spinDecayRate: decayRate,
            errors: isValid ? undefined : ['Spin decay rate outside physical limits']
        };
    }

    /**
     * Validate spin decay over a trajectory
     */
    public validateTrajectorySpinDecay(
        initialSpin: SpinState,
        properties: BallProperties,
        environment: Environment,
        timePoints: number[],
        velocities: Vector3D[]
    ): TrajectorySpinDecayResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const spinRates: number[] = [initialSpin.rate];

        // Validate input arrays
        if (timePoints.length !== velocities.length) {
            errors.push('Time points and velocities arrays must have the same length');
            return {
                isValid: false,
                spinRates: [initialSpin.rate],
                errors
            };
        }

        // Calculate spin decay at each time point
        for (let i = 1; i < timePoints.length; i++) {
            const dt = timePoints[i] - timePoints[i-1];
            const speed = Math.sqrt(
                velocities[i].x * velocities[i].x +
                velocities[i].y * velocities[i].y +
                velocities[i].z * velocities[i].z
            );

            const decayRate = this.calculateSpinDecayRate(
                spinRates[i-1],
                speed,
                properties.radius,
                environment
            );

            // Validate decay rate
            if (decayRate < this.MIN_DECAY_RATE || decayRate > this.MAX_DECAY_RATE) {
                errors.push(`Invalid decay rate at time ${timePoints[i]}`);
            }

            // Calculate new spin rate
            const newSpinRate = spinRates[i-1] * Math.exp(-decayRate * dt);
            spinRates.push(newSpinRate);
        }

        return {
            isValid: errors.length === 0,
            spinRates,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
}
