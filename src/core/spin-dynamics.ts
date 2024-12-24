import { Vector3D, Environment, BallProperties, SpinState } from './types';

export class SpinDynamicsEngine {
    private readonly AIR_DENSITY_SL = 1.225; // kg/m^3 at sea level
    private readonly SPIN_DECAY_BASE = 0.08;  // Base decay rate per second
    private readonly AXIS_STABILITY = 0.95;   // Axis stability factor
    private readonly GYROSCOPIC_FACTOR = 0.15; // Gyroscopic stability factor
    private readonly REYNOLDS_CRITICAL = 150000; // Critical Reynolds number for transition
    private readonly MAGNUS_DECAY_FACTOR = 0.12; // Magnus effect decay factor
    private readonly VERTICAL_BIAS = 0.25;    // Tendency to become vertical

    /**
     * Calculate spin decay over time using physics-based model
     * Incorporates Reynolds number effects and environmental factors
     */
    private calculateSpinDecay(
        initialSpin: number,
        time: number,
        velocity: number,
        properties: BallProperties,
        environment: Environment
    ): number {
        // Calculate Reynolds number
        const airDensity = this.calculateAirDensity(environment);
        const viscosity = 1.81e-5 * Math.pow((environment.temperature + 273.15) / 288.15, 0.76);
        const Re = (airDensity * velocity * 2 * properties.radius) / viscosity;

        // Calculate non-dimensional spin parameter
        const spinParameter = (properties.radius * initialSpin * Math.PI / 15) / velocity;

        // Base decay rate from empirical data
        let decayRate = this.SPIN_DECAY_BASE * (1 + spinParameter * 0.8);

        // Reynolds number effect on decay rate
        if (Re < this.REYNOLDS_CRITICAL) {
            // Laminar flow - lower decay rate
            decayRate *= 0.85 * Math.pow(Re / this.REYNOLDS_CRITICAL, 0.2);
        } else {
            // Turbulent flow - higher decay rate
            decayRate *= 1.15 * Math.pow(Re / this.REYNOLDS_CRITICAL, 0.15);
        }

        // Air density effect
        const densityRatio = airDensity / this.AIR_DENSITY_SL;
        decayRate *= Math.pow(densityRatio, 0.6);

        // Temperature effect on air viscosity
        const tempRatio = (environment.temperature + 273.15) / 288.15;
        decayRate *= Math.pow(tempRatio, -0.1);

        // Humidity effect (minor impact)
        decayRate *= 1 - environment.humidity * 0.05;

        // Calculate decay using modified exponential model
        const timeConstant = 1 / decayRate;
        const decayFactor = Math.exp(-time / timeConstant);
        
        // Add non-linear effects for more realistic behavior
        const nonLinearFactor = 1 - 0.15 * (1 - decayFactor) * spinParameter;
        
        return initialSpin * decayFactor * nonLinearFactor;
    }

    /**
     * Calculate gyroscopic stability effects
     */
    private calculateGyroscopicEffects(
        spinRate: number,
        velocity: number,
        deltaTime: number
    ): number {
        // Gyroscopic stability increases with spin rate and decreases with velocity
        const stabilityParameter = (spinRate * Math.PI / 30) / (velocity + 1);
        const gyroscopicStability = Math.pow(
            this.AXIS_STABILITY,
            deltaTime * (1 - this.GYROSCOPIC_FACTOR * stabilityParameter)
        );
        
        // Add vertical tendency that increases with time
        const verticalTendency = this.VERTICAL_BIAS * (1 - Math.exp(-deltaTime / 2));
        
        return Math.max(0.5, Math.min(1, gyroscopicStability * (1 - verticalTendency)));
    }

    /**
     * Calculate Magnus effect decay
     */
    private calculateMagnusDecay(
        spinRate: number,
        velocity: number,
        time: number
    ): number {
        // Magnus effect decreases with time due to boundary layer changes
        const spinParameter = (spinRate * Math.PI / 30) / (velocity + 1);
        const magnusDecay = Math.exp(-this.MAGNUS_DECAY_FACTOR * time * spinParameter);
        return Math.max(0.4, magnusDecay);
    }

    /**
     * Calculate lift coefficient based on spin rate and Reynolds number
     * Data from spin-dynamics.md Magnus Effect Analysis
     */
    private calculateLiftCoefficient(
        spinRate: number,
        reynoldsNumber: number = 150000
    ): number {
        const liftCoefficients = [
            { spin: 2000, coef: 0.21 },
            { spin: 2500, coef: 0.25 },
            { spin: 3000, coef: 0.29 },
            { spin: 3500, coef: 0.32 },
            { spin: 4000, coef: 0.35 }
        ];

        // Find closest spin rate and interpolate
        const sorted = liftCoefficients.sort((a, b) => 
            Math.abs(a.spin - spinRate) - Math.abs(b.spin - spinRate)
        );
        
        return sorted[0].coef;
    }

    /**
     * Calculate side spin effects
     * Data from spin-dynamics.md Side Spin Effects
     */
    private calculateSideSpinEffects(sideSpin: number): {
        curveRate: number;  // degrees per second
        maxDeviation: number;  // yards
    } {
        const sideSpinEffects = [
            { spin: 500, rate: 0.8, deviation: 4 },
            { spin: 1000, rate: 1.6, deviation: 9 },
            { spin: 1500, rate: 2.4, deviation: 15 },
            { spin: 2000, rate: 3.2, deviation: 22 },
            { spin: 2500, rate: 4.0, deviation: 30 }
        ];

        // Find closest side spin and interpolate
        const sorted = sideSpinEffects.sort((a, b) => 
            Math.abs(a.spin - sideSpin) - Math.abs(b.spin - sideSpin)
        );
        
        return {
            curveRate: sorted[0].rate,
            maxDeviation: sorted[0].deviation
        };
    }

    /**
     * Calculate effective spin components based on axis tilt
     * Data from spin-dynamics.md Combined Spin Effects
     */
    private calculateEffectiveSpin(
        totalSpin: number,
        axisTilt: number
    ): {
        backSpin: number;
        sideSpin: number;
    } {
        // Convert axis tilt to radians
        const tiltRad = (axisTilt * Math.PI) / 180;

        return {
            backSpin: totalSpin * Math.cos(tiltRad),
            sideSpin: totalSpin * Math.sin(tiltRad)
        };
    }

    /**
     * Calculate environmental effects on spin
     * Data from spin-dynamics.md Environmental Impact
     */
    private calculateEnvironmentalEffects(
        environment: Environment
    ): {
        spinMaintenance: number;
        curveEffect: number;
    } {
        // Altitude effects
        const altitudeEffects = [
            { altitude: 0, maintenance: 1.00, curve: 1.00 },
            { altitude: 3000, maintenance: 0.92, curve: 0.91 },
            { altitude: 6000, maintenance: 0.84, curve: 0.83 },
            { altitude: 9000, maintenance: 0.77, curve: 0.75 }
        ];

        // Temperature effects
        const temperatureEffects = [
            { temp: 40, generation: 1.03, maintenance: 1.05 },
            { temp: 60, generation: 1.01, maintenance: 1.02 },
            { temp: 80, generation: 1.00, maintenance: 1.00 },
            { temp: 100, generation: 0.98, maintenance: 0.97 }
        ];

        // Find altitude effects
        const altEffect = altitudeEffects.sort((a, b) => 
            Math.abs(a.altitude - environment.altitude) - Math.abs(b.altitude - environment.altitude)
        )[0];

        // Find temperature effects
        const tempEffect = temperatureEffects.sort((a, b) => 
            Math.abs(a.temp - environment.temperature) - Math.abs(b.temp - environment.temperature)
        )[0];

        return {
            spinMaintenance: altEffect.maintenance * tempEffect.maintenance,
            curveEffect: altEffect.curve
        };
    }

    /**
     * Calculate spin loft
     * Formula from spin-dynamics.md Advanced Spin Calculations
     */
    private calculateSpinLoft(
        clubHeadSpeed: number,
        dynamicLoft: number,
        attackAngle: number,
        friction: number,
        ballCompression: number
    ): number {
        const spinLoft = dynamicLoft - attackAngle;
        const k = 0.0472; // Conversion factor
        
        return (clubHeadSpeed * spinLoft * friction) / (k * ballCompression);
    }

    /**
     * Update spin state based on time step and conditions
     */
    public updateSpinState(
        currentSpin: SpinState,
        properties: BallProperties,
        environment: Environment,
        velocity: { x: number; y: number; z: number },
        deltaTime: number
    ): SpinState {
        // Calculate current speed
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );

        // Calculate new spin rate with improved decay model
        const newSpinRate = this.calculateSpinDecay(
            currentSpin.rate,
            deltaTime,
            speed,
            properties,
            environment
        );

        // Calculate gyroscopic stability
        const gyroStability = this.calculateGyroscopicEffects(
            currentSpin.rate,
            speed,
            deltaTime
        );

        // Update spin axis with improved stability model
        const verticalBias = this.VERTICAL_BIAS * (1 - Math.exp(-deltaTime / 2));
        const newAxis = {
            x: currentSpin.axis.x * gyroStability,
            y: currentSpin.axis.y * gyroStability + verticalBias,
            z: currentSpin.axis.z * gyroStability
        };

        // Normalize the new axis
        const axisMagnitude = Math.sqrt(
            newAxis.x * newAxis.x +
            newAxis.y * newAxis.y +
            newAxis.z * newAxis.z
        );

        return {
            rate: newSpinRate,
            axis: {
                x: newAxis.x / axisMagnitude,
                y: newAxis.y / axisMagnitude,
                z: newAxis.z / axisMagnitude
            }
        };
    }

    /**
     * Calculate air density based on environmental conditions
     */
    private calculateAirDensity(environment: Environment): number {
        const T = environment.temperature + 273.15; // Convert to Kelvin
        const p = environment.pressure;
        const R = 287.058; // Specific gas constant for air in J/(kg·K)

        return p / (R * T);
    }

    /**
     * Process all spin dynamics
     */
    public processSpin(
        initialSpin: Vector3D,
        time: number,
        environment: Environment,
        ballProperties: BallProperties,
        axisTilt: number = 0
    ): {
        currentSpin: Vector3D;
        effectiveComponents: { backSpin: number; sideSpin: number };
        liftCoefficient: number;
        sideSpinEffects: { curveRate: number; maxDeviation: number };
    } {
        // Calculate total spin magnitude
        const totalSpin = Math.sqrt(
            initialSpin.x * initialSpin.x +
            initialSpin.y * initialSpin.y +
            initialSpin.z * initialSpin.z
        );

        // Calculate environmental effects
        const envEffects = this.calculateEnvironmentalEffects(environment);

        // Calculate decayed spin
        const decayedSpin = this.calculateSpinDecay(totalSpin, time, 0, ballProperties, environment) * envEffects.spinMaintenance;

        // Calculate effective spin components
        const effectiveComponents = this.calculateEffectiveSpin(decayedSpin, axisTilt);

        // Calculate lift coefficient
        const liftCoefficient = this.calculateLiftCoefficient(effectiveComponents.backSpin);

        // Calculate side spin effects
        const sideSpinEffects = this.calculateSideSpinEffects(effectiveComponents.sideSpin);

        // Apply curve effect from environment
        sideSpinEffects.maxDeviation *= envEffects.curveEffect;

        // Calculate new spin vector
        const spinRatio = decayedSpin / totalSpin;
        const currentSpin: Vector3D = {
            x: initialSpin.x * spinRatio,
            y: initialSpin.y * spinRatio,
            z: initialSpin.z * spinRatio
        };

        return {
            currentSpin,
            effectiveComponents,
            liftCoefficient,
            sideSpinEffects
        };
    }
}
