import { Environment, Vector3D } from '../types';

interface WeatherEffects {
    distanceLoss: number;
    spinChange: number;
    launchChange: number;
    rollEffect: number;
    bounceEffect: number;
    spinRetention: number;
}

export class WeatherSystem {
    private readonly BASE_TEMPERATURE = 20; // Celsius
    private readonly BASE_HUMIDITY = 0.5;   // 50%

    /**
     * Calculate comprehensive weather effects on ball flight
     */
    public calculateWeatherEffects(environment: Environment): WeatherEffects {
        const rainEffects = this.calculateRainEffects(environment);
        const groundEffects = this.calculateGroundEffects(environment);
        const temperatureEffects = this.calculateTemperatureEffects(environment);

        return {
            distanceLoss: rainEffects.distanceLoss * temperatureEffects.distanceEffect,
            spinChange: rainEffects.spinChange * temperatureEffects.spinEffect,
            launchChange: rainEffects.launchChange,
            rollEffect: groundEffects.rollEffect,
            bounceEffect: groundEffects.bounceEffect,
            spinRetention: groundEffects.spinRetention
        };
    }

    /**
     * Calculate effects of rain on ball flight
     */
    private calculateRainEffects(environment: Environment) {
        const humidity = environment.humidity;
        
        // Scale effects based on humidity levels
        let distanceLoss = 0;
        let spinChange = 0;
        let launchChange = 0;

        if (humidity > 0.8) {  // Heavy rain
            distanceLoss = -0.09;  // -9%
            spinChange = -0.15;    // -15%
            launchChange = -2.5;   // -2.5 degrees
        } else if (humidity > 0.6) {  // Moderate rain
            distanceLoss = -0.055;  // -5.5%
            spinChange = -0.10;     // -10%
            launchChange = -1.5;    // -1.5 degrees
        } else if (humidity > 0.4) {  // Light rain
            distanceLoss = -0.03;   // -3%
            spinChange = -0.065;    // -6.5%
            launchChange = -0.75;   // -0.75 degrees
        }

        return { distanceLoss, spinChange, launchChange };
    }

    /**
     * Calculate effects of ground conditions
     */
    private calculateGroundEffects(environment: Environment) {
        const humidity = environment.humidity;
        
        // Base effects
        let rollEffect = 1.0;
        let bounceEffect = 1.0;
        let spinRetention = 0.85;  // Default 85%

        // Adjust based on humidity
        if (humidity > 0.8) {  // Wet
            rollEffect = 0.75;      // -25% roll
            bounceEffect = 0.6;     // Low bounce
            spinRetention = 0.75;   // 75% retention
        } else if (humidity > 0.6) {  // Soft
            rollEffect = 0.85;      // -15% roll
            bounceEffect = 0.8;     // Medium-low bounce
            spinRetention = 0.8;    // 80% retention
        } else if (humidity < 0.3) {  // Dry/Firm
            rollEffect = 1.2;       // +20% roll
            bounceEffect = 1.2;     // High bounce
            spinRetention = 0.9;    // 90% retention
        }

        return { rollEffect, bounceEffect, spinRetention };
    }

    /**
     * Calculate temperature effects on ball flight
     */
    private calculateTemperatureEffects(environment: Environment) {
        const tempDiff = environment.temperature - this.BASE_TEMPERATURE;
        
        // Calculate effects
        const distanceEffect = 1 + (tempDiff * 0.002);  // ±0.2% per °C
        const spinEffect = 1 - (tempDiff * 0.001);      // ∓0.1% per °C

        return { distanceEffect, spinEffect };
    }
}
