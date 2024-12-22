import { Vector3D, Environment, BallProperties } from './types';

export class SpinDynamicsEngine {
    /**
     * Calculate spin decay over time
     * Data from spin-dynamics.md Spin Decay Patterns
     */
    private calculateSpinDecay(
        initialSpin: number,
        time: number
    ): number {
        // Decay rates from research data
        const decayRates = [
            { time: 1, rate: 0.92 },  // 8% decay after 1 sec
            { time: 2, rate: 0.847 }, // 15.3% decay after 2 sec
            { time: 3, rate: 0.779 }, // 22.1% decay after 3 sec
            { time: 4, rate: 0.717 }, // 28.3% decay after 4 sec
            { time: 5, rate: 0.659 }, // 34.1% decay after 5 sec
            { time: 6, rate: 0.607 }  // 39.3% decay after 6 sec
        ];

        // Find appropriate decay rate
        const timeIndex = Math.min(Math.floor(time), 6);
        const rate = decayRates[timeIndex]?.rate || 0.5;

        return initialSpin * rate;
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
        const decayedSpin = this.calculateSpinDecay(totalSpin, time) * envEffects.spinMaintenance;

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
