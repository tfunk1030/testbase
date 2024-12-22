import { Environment, Vector3D } from './types';

export class WindEffectsEngine {
    private readonly SURFACE_ROUGHNESS = 0.03;  // Typical golf course roughness length
    private readonly REFERENCE_HEIGHT = 10;     // Standard wind measurement height (meters)
    private readonly POWER_LAW_EXPONENT = 0.143; // Open terrain exponent

    /**
     * Calculate wind velocity at a given height
     * Uses power law profile for wind speed variation with height
     */
    public calculateWindAtHeight(
        baseWind: Vector3D,
        height: number,
        environment: Environment
    ): Vector3D {
        // Handle ground level
        if (height <= 0) {
            return { x: 0, y: 0, z: 0 };
        }

        // Calculate wind profile coefficient
        const heightRatio = height / this.REFERENCE_HEIGHT;
        const windFactor = Math.pow(heightRatio, this.POWER_LAW_EXPONENT);

        // Calculate turbulence intensity based on height and terrain
        const turbulenceIntensity = this.calculateTurbulenceIntensity(height, Math.sqrt(baseWind.x * baseWind.x + baseWind.y * baseWind.y + baseWind.z * baseWind.z));

        // Add turbulent fluctuations
        const turbulenceFactor = 1 + this.generateTurbulentFluctuation(height, Math.sqrt(baseWind.x * baseWind.x + baseWind.y * baseWind.y + baseWind.z * baseWind.z), 0.1) * turbulenceIntensity;

        // Calculate wind shear effect
        const shearAngle = this.calculateWindShear(height);

        // Apply wind shear rotation
        const cosShear = Math.cos(shearAngle);
        const sinShear = Math.sin(shearAngle);

        return {
            x: baseWind.x * windFactor * turbulenceFactor * cosShear,
            y: baseWind.y * windFactor * turbulenceFactor,
            z: baseWind.z * windFactor * turbulenceFactor * cosShear + 
               baseWind.x * windFactor * turbulenceFactor * sinShear
        };
    }

    /**
     * Calculate turbulence intensity at given height
     */
    private calculateTurbulenceIntensity(height: number, windSpeed: number): number {
        const roughnessLength = 0.03; // Typical for golf course terrain
        const vonKarmanConstant = 0.41;
        const referenceHeight = 10; // meters

        // Calculate friction velocity using log law
        const frictionVelocity = (vonKarmanConstant * windSpeed) / 
            Math.log(referenceHeight / roughnessLength);

        // Calculate turbulence intensity using empirical relationship
        return frictionVelocity / windSpeed * 
            (1.0 - 0.5 * Math.exp(-height / referenceHeight));
    }

    /**
     * Calculate temporal correlation of turbulent fluctuations
     */
    private calculateTemporalCorrelation(dt: number, windSpeed: number): number {
        const timeScale = 3.0; // Integral time scale in seconds
        const correlation = Math.exp(-dt / (timeScale * (1.0 + 0.1 * windSpeed)));
        
        // Apply low-pass filter to smooth rapid fluctuations
        return correlation * (1.0 - Math.exp(-5.0 * dt / timeScale));
    }

    /**
     * Generate turbulent wind fluctuation
     */
    public generateTurbulentFluctuation(
        height: number, 
        windSpeed: number, 
        dt: number,
        previousFluctuation?: number
    ): number {
        const intensity = this.calculateTurbulenceIntensity(height, windSpeed);
        const correlation = this.calculateTemporalCorrelation(dt, windSpeed);

        // Generate new random component
        const randomComponent = (Math.random() * 2 - 1) * intensity * windSpeed;

        // If no previous fluctuation, return new random component
        if (previousFluctuation === undefined) {
            return randomComponent;
        }

        // Combine previous and new fluctuations using temporal correlation
        return correlation * previousFluctuation + (1 - correlation) * randomComponent;
    }

    /**
     * Calculate wind shear angle based on height
     */
    private calculateWindShear(height: number): number {
        // Wind direction typically turns clockwise with height
        // Typical rotation is about 20° over the lowest 100m
        return (Math.PI / 9) * Math.min(height / 100, 1);
    }

    /**
     * Calculate crosswind effect on ball trajectory
     */
    public calculateCrosswindEffect(
        velocity: Vector3D,
        wind: Vector3D,
        spinRate: number
    ): number {
        // Calculate relative wind vector
        const relativeWind = {
            x: wind.x - velocity.x,
            y: wind.y - velocity.y,
            z: wind.z - velocity.z
        };

        // Calculate crosswind component (perpendicular to velocity)
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
        if (speed === 0) return 0;

        const dotProduct = (velocity.x * relativeWind.x + velocity.y * relativeWind.y + velocity.z * relativeWind.z) / speed;
        const crosswind = Math.sqrt(
            Math.pow(relativeWind.x - velocity.x * dotProduct / speed, 2) +
            Math.pow(relativeWind.y - velocity.y * dotProduct / speed, 2) +
            Math.pow(relativeWind.z - velocity.z * dotProduct / speed, 2)
        );

        // Calculate spin-dependent crosswind sensitivity
        // Higher spin rates make the ball more sensitive to crosswind
        const spinFactor = 1 + (spinRate / 3000) * 0.5;

        return crosswind * spinFactor;
    }

    /**
     * Calculate wind forces acting on the ball
     */
    public calculateWindForces(
        velocity: Vector3D,
        position: Vector3D,
        environment: Environment,
        dt: number,
        prevTurbulence?: Vector3D
    ): Vector3D {
        // Calculate wind at current height
        const windAtHeight = this.calculateWindAtHeight(environment.wind, position.z, environment);

        // Calculate relative velocity (ball velocity - wind velocity)
        const relativeVelocity = {
            x: velocity.x - windAtHeight.x,
            y: velocity.y - windAtHeight.y,
            z: velocity.z - windAtHeight.z
        };

        // Calculate wind force magnitude (simplified model)
        const rho = 1.225; // air density at sea level
        const Cd = 0.1;    // wind force coefficient
        const area = Math.PI * 0.02135 * 0.02135; // ball cross-sectional area
        const relSpeed = Math.sqrt(
            relativeVelocity.x * relativeVelocity.x +
            relativeVelocity.y * relativeVelocity.y +
            relativeVelocity.z * relativeVelocity.z
        );

        const forceMagnitude = 0.5 * rho * Cd * area * relSpeed * relSpeed;

        // Calculate force components
        return {
            x: relSpeed > 0 ? -forceMagnitude * relativeVelocity.x / relSpeed : 0,
            y: relSpeed > 0 ? -forceMagnitude * relativeVelocity.y / relSpeed : 0,
            z: relSpeed > 0 ? -forceMagnitude * relativeVelocity.z / relSpeed : 0
        };
    }
}
