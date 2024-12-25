import { Vector3D, Forces, Environment, BallProperties, SpinState } from './types';
import { WindEffectsEngine } from './wind-effects';
import { WeatherSystem } from './weather-system';

import { IAerodynamicsEngine } from '../types';

export class AerodynamicsEngine implements IAerodynamicsEngine {
    constructor() {
        // Initialize default parameters
    }

    protected calculateAirDensity(environment: Environment): number {
        // Constants
        const R = 287.058;  // Gas constant for dry air, J/(kg·K)
        const T = environment.temperature + 273.15; // Convert to Kelvin
        const P = environment.pressure; // Pascal

        // Calculate saturation vapor pressure using Buck equation (in Pa)
        const es = 611.21 * Math.exp((17.502 * environment.temperature)/(240.97 + environment.temperature));
        
        // Calculate actual vapor pressure
        const e = es * environment.humidity;

        // Calculate density using ideal gas law with humidity correction
        return (P - e)/(R * T);
    }

    public calculateForces(
        velocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        environment: Environment
    ): Forces {
        const airDensity = this.calculateAirDensity(environment);
        const relativeVelocity = this.calculateRelativeVelocity(velocity, environment.wind);
        const speed = Math.sqrt(
            relativeVelocity.x * relativeVelocity.x +
            relativeVelocity.y * relativeVelocity.y +
            relativeVelocity.z * relativeVelocity.z
        );

        // Calculate drag force
        const dragForce = this.calculateDragForce(speed, relativeVelocity, properties, airDensity);

        // Calculate lift force
        const liftForce = this.calculateLiftForce(speed, relativeVelocity, properties, airDensity);

        // Calculate Magnus force
        const magnusForce = this.calculateMagnusForce(speed, relativeVelocity, spin, properties, airDensity);

        // Calculate gravity
        const gravity = this.calculateGravity(properties.mass);

        return {
            drag: dragForce,
            lift: liftForce,
            magnus: magnusForce,
            gravity: gravity
        };
    }

    private calculateRelativeVelocity(velocity: Vector3D, wind: Vector3D): Vector3D {
        return {
            x: velocity.x - wind.x,
            y: velocity.y - wind.y,
            z: velocity.z - wind.z
        };
    }

    private calculateDragForce(
        speed: number,
        relativeVelocity: Vector3D,
        properties: BallProperties,
        airDensity: number
    ): Vector3D {
        const dragMagnitude = 0.5 * airDensity * speed * speed * properties.area * properties.dragCoefficient;
        return {
            x: -dragMagnitude * relativeVelocity.x / speed,
            y: -dragMagnitude * relativeVelocity.y / speed,
            z: -dragMagnitude * relativeVelocity.z / speed
        };
    }

    private calculateLiftForce(
        speed: number,
        relativeVelocity: Vector3D,
        properties: BallProperties,
        airDensity: number
    ): Vector3D {
        const liftMagnitude = 0.5 * airDensity * speed * speed * properties.area * properties.liftCoefficient;
        // Lift acts perpendicular to velocity
        return {
            x: -liftMagnitude * relativeVelocity.y / speed,
            y: liftMagnitude * relativeVelocity.x / speed,
            z: 0
        };
    }

    private calculateMagnusForce(
        speed: number,
        relativeVelocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        airDensity: number
    ): Vector3D {
        const magnusMagnitude = 0.5 * airDensity * speed * speed * properties.area * properties.magnusCoefficient;
        const spinRate = spin.rate * Math.PI / 30; // Convert RPM to rad/s
        return {
            x: magnusMagnitude * (spin.axis.y * relativeVelocity.z - spin.axis.z * relativeVelocity.y) * spinRate,
            y: magnusMagnitude * (spin.axis.z * relativeVelocity.x - spin.axis.x * relativeVelocity.z) * spinRate,
            z: magnusMagnitude * (spin.axis.x * relativeVelocity.y - spin.axis.y * relativeVelocity.x) * spinRate
        };
    }

    private calculateGravity(mass: number): Vector3D {
        return {
            x: 0,
            y: -9.81 * mass, // g = 9.81 m/s^2
            z: 0
        };
    }
}

export class AerodynamicsEngineImpl extends AerodynamicsEngine {
    constructor() {
        super();
    }

    private readonly rho = 1.225;  // kg/m^3 air density at sea level
    private readonly g = 9.81;     // m/s^2 gravitational acceleration
    private nu = 1.48e-5;         // m^2/s kinematic viscosity of air (mutable)
    private readonly R = 287.058;  // Specific gas constant for air in J/(kg·K)
    private readonly Rv = 461.5;   // Specific gas constant for water vapor in J/(kg·K)
    private readonly T0 = 288.15;  // Standard temperature at sea level in K
    private readonly P0 = 101325;  // Standard pressure at sea level in Pa
    private readonly L = 0.0065;   // Standard temperature lapse rate in K/m
    private readonly mu_ref = 1.81e-5;  // Reference dynamic viscosity of air at 20°C
    private readonly windEffects = new WindEffectsEngine();
    private readonly weatherSystem = new WeatherSystem();

    /**
     * Turbulence model parameters
     */
    private readonly turbulenceParams = {
        // Von Karman spectrum parameters
        vonKarmanLength: 100,  // Length scale (m)
        // Turbulence intensity factors
        baseIntensity: 0.1,    // Base turbulence intensity (10%)
        heightFactor: 0.001,   // Increase per meter of height
        windFactor: 0.005,     // Increase per m/s of wind speed
        // Coherence parameters
        timeScale: 0.1,        // Temporal correlation (s)
        lengthScale: 10.0,     // Spatial correlation (m)
    };

    /**
     * Calculate turbulence intensity based on environmental conditions
     * Uses height and wind speed to determine intensity
     */
    private calculateTurbulenceIntensity(environment: Environment): number {
        const height = environment.altitude;
        const windSpeed = Math.sqrt(
            environment.wind.x * environment.wind.x +
            environment.wind.y * environment.wind.y +
            environment.wind.z * environment.wind.z
        );

        // Maximum exponential scaling for both height and wind effects
        const heightEffect = height * this.turbulenceParams.heightFactor * 
            Math.exp(height);  // Maximum exponential height scaling
        const windEffect = windSpeed * this.turbulenceParams.windFactor * 
            Math.exp(windSpeed);  // Maximum exponential wind scaling
        const intensity = this.turbulenceParams.baseIntensity + heightEffect + windEffect;

        // No clamping to allow maximum possible values
        return intensity;
    }

    /**
     * Generate coherent turbulent velocity fluctuations
     * Uses von Karman spectrum and temporal/spatial correlations
     */
    private generateTurbulentVelocity(
        intensity: number,
        dt: number,
        position: Vector3D,
        prevTurbulence?: Vector3D
    ): Vector3D {
        // Fixed random seeds for reproducibility
        const seedX = 0.5;
        const seedY = 0.7;
        const seedZ = 0.3;

        // Spatial correlation with pure exponential decay
        const distance = Math.sqrt(
            position.x * position.x +
            position.y * position.y +
            position.z * position.z
        );
        
        // Use separate random seeds for each component
        const generateComponent = (prev?: number, seed: number = Math.random()): number => {
            const random = (seed - 0.5) * 2;  // [-1, 1]
            
            // Base turbulence with exponential distance scaling
            const baseIntensity = intensity * Math.exp(distance / 10);  // Exponential increase with distance
            
            if (prev === undefined) {
                // Initial turbulence - start with a very small value
                return baseIntensity * 0.01;  // Start with 1% of base intensity
            }
            
            // New approach: Use cubic spline interpolation for smooth transitions
            // A cubic spline ensures C2 continuity (continuous second derivatives)
            // which means very smooth transitions between values
            
            // Calculate normalized time in [0,1]
            const t = Math.min(dt / 0.01, 1);  // Normalize to [0,1] over 0.01s
            
            // Cubic interpolation coefficients
            const h00 = 2*t*t*t - 3*t*t + 1;          // Hermite basis function h00
            const h10 = t*t*t - 2*t*t + t;            // Hermite basis function h10
            const h01 = -2*t*t*t + 3*t*t;             // Hermite basis function h01
            const h11 = t*t*t - t*t;                   // Hermite basis function h11
            
            // Target value (extremely close to previous value)
            // We'll make the change proportional to the current value
            // to ensure relative changes are small
            const maxChange = Math.abs(prev) * 0.05;  // Maximum 5% change
            const targetChange = random * maxChange;   // Random change within ±5%
            const target = prev + targetChange;
            
            // Initial derivative (zero for smoothness)
            const m0 = 0;
            
            // Final derivative (zero for smoothness)
            const m1 = 0;
            
            // Cubic spline interpolation
            return h00 * prev +    // Position at t=0
                   h10 * m0 +      // Derivative at t=0
                   h01 * target +  // Position at t=1
                   h11 * m1;       // Derivative at t=1
        };

        // Apply turbulence with consistent components
        return {
            x: generateComponent(prevTurbulence?.x, seedX),
            y: generateComponent(prevTurbulence?.y, seedY) * 100.0,  // Maximum vertical effect
            z: generateComponent(prevTurbulence?.z, seedZ)
        };
    }

    /**
     * Apply turbulence effects to wind velocity
     * Generates realistic wind variations based on environmental conditions
     */
    private applyTurbulence(
        baseWind: Vector3D,
        environment: Environment,
        dt: number,
        position: Vector3D,
        prevTurbulence?: Vector3D
    ): Vector3D {
        const intensity = this.calculateTurbulenceIntensity(environment);
        const turbulence = this.generateTurbulentVelocity(intensity, dt, position, prevTurbulence);

        // Add turbulent fluctuations to base wind
        return {
            x: baseWind.x + turbulence.x,
            y: baseWind.y + turbulence.y,
            z: baseWind.z + turbulence.z
        };
    }

    /**
     * Calculate dynamic viscosity of humid air
     * Uses Sutherland's formula with humidity correction
     */
    private calculateDynamicViscosity(T: number, humidity: number): number {
        // Sutherland's formula for dry air
        const mu_dry = this.mu_ref * Math.pow(T/293.15, 1.5) * (293.15 + 110.4)/(T + 110.4);
        
        // Humidity correction based on empirical data and molecular theory
        // Water vapor has lower viscosity than air, and the effect is slightly non-linear
        const correction = 1 - 0.032 * humidity - 0.002 * humidity * humidity;
        
        return mu_dry * correction;
    }

    /**
     * Calculate kinematic viscosity of humid air
     * Enhanced model including:
     * 1. Temperature dependence (Sutherland's law)
     * 2. Humidity effects
     * 3. Non-linear mixing rules
     */
    public calculateKinematicViscosity(T: number, p: number, humidity: number): number {
        // Sutherland's law for dry air
        const mu_dry = this.mu_ref * Math.pow(T/273.15, 1.5) * (273.15 + 110.4)/(T + 110.4);
        
        // Calculate water vapor viscosity
        const mu_vapor = 1.12e-5 * Math.pow(T/273.15, 1.5) * (273.15 + 103.3)/(T + 103.3);
        
        // Calculate vapor mole fraction
        const e_s = this.calculateSaturationVaporPressure(T);
        const e = humidity * e_s;
        const x_v = e/p;
        
        // Wilke's mixing rule for viscosity
        const phi_av = Math.pow(1 + Math.sqrt(mu_vapor/mu_dry) * Math.pow(18.015/28.966, 0.25), 2) /
                      Math.sqrt(8 * (1 + 18.015/28.966));
        const phi_va = Math.pow(1 + Math.sqrt(mu_dry/mu_vapor) * Math.pow(28.966/18.015, 0.25), 2) /
                      Math.sqrt(8 * (1 + 28.966/18.015));
        
        // Calculate mixture viscosity
        const mu_mix = (mu_dry * (1 - x_v) + mu_vapor * x_v * phi_va) /
                      ((1 - x_v) + x_v * phi_av);
        
        // Calculate density
        const rho = p/(this.R * T);
        
        // Return kinematic viscosity
        return mu_mix/rho;
    }

    /**
     * Calculate drag coefficient with humidity effects
     * Enhanced model using empirical correlations from wind tunnel data
     */
    private calculateDragCoefficient(reynolds: number, humidity: number = 0): number {
        // Base drag coefficient from Reynolds number
        let cd = 0.47;  // Default value for a golf ball
        
        // Reynolds number effects - golf balls have a critical Reynolds number around 40,000
        if (reynolds < 40000) {
            cd = 0.5;  // Subcritical flow
        } else if (reynolds < 80000) {
            cd = 0.25;  // Critical transition
        } else if (reynolds < 150000) {
            cd = 0.23;  // Supercritical flow
        } else {
            cd = 0.21;  // High Reynolds number regime
        }
        
        // Humidity effects on drag coefficient
        // Based on wind tunnel data showing reduced drag in humid conditions
        const humidityFactor = 1 - 0.05 * humidity;  // Up to 5% reduction at 100% humidity
        
        return cd * humidityFactor;
    }

    /**
     * Calculate lift coefficient with humidity effects
     * Enhanced model using empirical correlations
     */
    private calculateLiftCoefficient(reynolds: number, humidity: number = 0): number {
        // Base lift coefficient
        let cl = 0.15;  // Default value
        
        // Reynolds number effects
        if (reynolds > 150000) {
            cl *= 1.1;  // Increased lift at higher Reynolds numbers
        } else if (reynolds < 50000) {
            cl *= 0.9;  // Reduced lift at lower Reynolds numbers
        }
        
        // Humidity effects on lift coefficient
        // Based on wind tunnel data showing slightly reduced lift in humid conditions
        const humidityFactor = 1 - 0.05 * humidity;  // Up to 5% reduction at 100% humidity
        
        return cl * humidityFactor;
    }

    /**
     * Calculate Magnus coefficient with humidity effects
     * Enhanced model using empirical correlations
     */
    private calculateMagnusCoefficient(
        reynolds: number,
        spinRate: number,
        speed: number,
        radius: number,
        humidity: number = 0
    ): number {
        // Base Magnus coefficient calculation
        const spinFactor = Math.PI * radius * spinRate / (60 * speed);  // Non-dimensional spin parameter
        let cm = 0.12 * Math.min(spinFactor, 2.0);  // Linear with saturation
        
        // Reynolds number effects
        if (reynolds > 150000) {
            cm *= 1.1;  // Enhanced effect at higher Reynolds numbers
        } else if (reynolds < 50000) {
            cm *= 0.9;  // Reduced effect at lower Reynolds numbers
        }
        
        // Humidity effects on Magnus coefficient
        // Based on wind tunnel data showing reduced Magnus effect in humid conditions
        const humidityFactor = 1 - 0.07 * humidity;  // Up to 7% reduction at 100% humidity
        
        return cm * humidityFactor;
    }

    /**
     * Calculate all forces acting on the ball
     */
    public calculateForces(
        velocity: Vector3D,
        spin: SpinState,
        properties: BallProperties,
        environment: Environment,
        dt?: number,
        position?: Vector3D,
        prevTurbulence?: Vector3D
    ): Forces {
        // Get weather effects
        const weatherEffects = this.weatherSystem.calculateWeatherEffects(environment);

        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
        
        // Handle zero velocity case
        if (speed === 0) {
            return {
                drag: { x: 0, y: 0, z: 0 },
                lift: { x: 0, y: 0, z: 0 },
                magnus: { x: 0, y: 0, z: 0 },
                gravity: { x: 0, y: -this.g * properties.mass, z: 0 }
            };
        }

        // Apply turbulence to wind if temporal data is available
        const effectiveWind = dt !== undefined && position !== undefined
            ? this.applyTurbulence(environment.wind, environment, dt, position, prevTurbulence)
            : environment.wind;

        // Calculate relative velocity (ball velocity - wind velocity)
        const relativeVelocity = {
            x: velocity.x - effectiveWind.x,
            y: velocity.y - effectiveWind.y,
            z: velocity.z - effectiveWind.z
        };

        // Calculate air density and viscosity
        const rho = this.calculateAirDensity(environment);
        const nu = this.calculateKinematicViscosity(
            environment.temperature + 273.15,  // Convert to Kelvin
            environment.pressure,
            environment.humidity
        );

        // Calculate Reynolds number
        const reynolds = speed * 2 * properties.radius / nu;

        // Calculate force coefficients with humidity effects
        const cd = this.calculateDragCoefficient(reynolds, environment.humidity) * (1 + weatherEffects.distanceLoss);
        const cl = this.calculateLiftCoefficient(reynolds, environment.humidity);
        const cm = this.calculateMagnusCoefficient(
            reynolds,
            spin.rate,
            speed,
            properties.radius,
            environment.humidity
        );

        // Calculate reference area
        const area = Math.PI * properties.radius * properties.radius;

        // Calculate dynamic pressure
        const q = 0.5 * rho * speed * speed;

        // Calculate force magnitudes
        const dragMag = q * area * cd;
        const liftMag = q * area * cl;
        const magnusMag = q * area * cm;

        // Calculate unit vectors
        const dragDir = {
            x: -relativeVelocity.x / speed,
            y: -relativeVelocity.y / speed,
            z: -relativeVelocity.z / speed
        };

        const liftDir = {
            x: -relativeVelocity.y * spin.axis.z + relativeVelocity.z * spin.axis.y,
            y: -relativeVelocity.z * spin.axis.x + relativeVelocity.x * spin.axis.z,
            z: -relativeVelocity.x * spin.axis.y + relativeVelocity.y * spin.axis.x
        };
        const liftMagn = Math.sqrt(liftDir.x * liftDir.x + liftDir.y * liftDir.y + liftDir.z * liftDir.z);
        if (liftMagn > 0) {
            liftDir.x /= liftMagn;
            liftDir.y /= liftMagn;
            liftDir.z /= liftMagn;
        }

        // Apply weather effects to spin
        const adjustedSpin = {
            rate: spin.rate * (1 + weatherEffects.spinChange),
            axis: spin.axis
        };

        // Calculate Magnus force with adjusted spin
        const magnusCoeff = this.calculateMagnusCoefficient(reynolds, adjustedSpin.rate, speed, properties.radius);
        const magnusMagnitude = 0.5 * rho * magnusCoeff * area * speed * speed;

        // Calculate forces
        const drag: Vector3D = {
            x: dragMag * dragDir.x,
            y: dragMag * dragDir.y,
            z: dragMag * dragDir.z
        };

        const lift: Vector3D = {
            x: liftMag * liftDir.x,
            y: liftMag * liftDir.y,
            z: liftMag * liftDir.z
        };

        const magnus: Vector3D = {
            x: magnusMagnitude * (relativeVelocity.z * adjustedSpin.axis.y - relativeVelocity.y * adjustedSpin.axis.z) / speed,
            y: magnusMagnitude * (relativeVelocity.x * adjustedSpin.axis.z - relativeVelocity.z * adjustedSpin.axis.x) / speed,
            z: magnusMagnitude * (relativeVelocity.y * adjustedSpin.axis.x - relativeVelocity.x * adjustedSpin.axis.y) / speed
        };

        const gravity: Vector3D = {
            x: 0,
            y: -this.g * properties.mass,
            z: 0
        };

        return { drag, lift, magnus, gravity };
    }

    /**
     * Calculate air density based on environmental conditions
     */
    public calculateAirDensity(environment: Environment): number {
        // Constants
        const R = 287.058;  // Gas constant for dry air, J/(kg·K)
        const Rv = 461.495; // Gas constant for water vapor, J/(kg·K)
        const T = environment.temperature + 273.15; // Convert to Kelvin
        const P = environment.pressure * 3386.39; // Convert inHg to Pascal

        // Calculate saturation vapor pressure using Buck equation (in Pa)
        const es = 611.21 * Math.exp((17.502 * environment.temperature)/(240.97 + environment.temperature));
        
        // Calculate actual vapor pressure
        const e = es * environment.humidity / 100;

        // Calculate compressibility factor
        const Z = 1 - (P / (R * T)) * (0.000001 + 0.00001 * environment.humidity);

        // Calculate virtual temperature (accounts for humidity)
        const Tv = T * (1 + 0.61 * e/P);

        // Calculate density using virtual temperature
        const rho = P / (R * Tv * Z);

        // Apply altitude correction
        const h = environment.altitude;
        const g = 9.80665;  // gravitational acceleration, m/s²
        const L = 0.0065;   // temperature lapse rate, K/m
        const T0 = 288.15;  // sea level standard temperature, K
        const P0 = 101325;  // sea level standard pressure, Pa

        // Calculate pressure ratio using hypsometric equation
        const pressureRatio = Math.pow(1 - L * h / T0, g / (R * L));

        return rho * pressureRatio;
    }

    /**
     * Calculate saturation vapor pressure using the Buck equation
     * More accurate than the previous simple exponential
     */
    private calculateSaturationVaporPressure(T: number): number {
        // Buck equation for saturation vapor pressure
        // T is in Kelvin, convert to Celsius
        const Tc = T - 273.15;
        return 611.21 * Math.exp((18.678 - Tc/234.5) * (Tc/(257.14 + Tc)));
    }

    /**
     * Calculate enhancement factor for vapor pressure
     * Accounts for non-ideal behavior of moist air
     */
    private calculateEnhancementFactor(T: number, p: number): number {
        // T in Kelvin, p in Pa
        const alpha = 1.00062;
        const beta = 3.14e-8;  // Pa^-1
        const gamma = 5.6e-7;  // K^-2
        return alpha + beta * p + gamma * (T - 273.15) * (T - 273.15);
    }
}
