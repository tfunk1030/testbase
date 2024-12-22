import { Environment, BallProperties } from './types';

export class EnvironmentalSystem {
    // Constants
    private readonly STANDARD_TEMPERATURE = 70; // °F
    private readonly STANDARD_PRESSURE = 29.92; // inHg
    private readonly STANDARD_HUMIDITY = 50; // %
    private readonly STANDARD_ALTITUDE = 0; // feet
    private readonly GAS_CONSTANT = 287.058; // J/(kg·K)
    private readonly MOLAR_MASS_AIR = 0.0289644; // kg/mol

    /**
     * Calculate temperature effect on air density
     * Data from environmental-physics.md Temperature Impact
     */
    private calculateTemperatureDensityRatio(temperature: number): number {
        const tempEffects = [
            { temp: 40, ratio: 1.06 },
            { temp: 50, ratio: 1.04 },
            { temp: 60, ratio: 1.02 },
            { temp: 70, ratio: 1.00 },
            { temp: 80, ratio: 0.98 },
            { temp: 90, ratio: 0.96 },
            { temp: 100, ratio: 0.94 }
        ];

        // Find closest temperature and interpolate
        const sorted = tempEffects.sort((a, b) => 
            Math.abs(a.temp - temperature) - Math.abs(b.temp - temperature)
        );
        
        return sorted[0].ratio;
    }

    /**
     * Calculate altitude effect on air density
     * Data from environmental-physics.md Altitude Effects
     */
    private calculateAltitudeDensityRatio(altitude: number): number {
        const altitudeEffects = [
            { alt: 0, ratio: 1.000 },
            { alt: 1000, ratio: 0.971 },
            { alt: 2000, ratio: 0.942 },
            { alt: 3000, ratio: 0.915 },
            { alt: 4000, ratio: 0.888 },
            { alt: 5000, ratio: 0.862 },
            { alt: 6000, ratio: 0.837 }
        ];

        // Find closest altitude and interpolate
        const sorted = altitudeEffects.sort((a, b) => 
            Math.abs(a.alt - altitude) - Math.abs(b.alt - altitude)
        );
        
        return sorted[0].ratio;
    }

    /**
     * Calculate humidity effect on air density
     * Data from environmental-physics.md Relative Humidity Effects
     */
    private calculateHumidityEffect(humidity: number): number {
        const humidityEffects = [
            { humidity: 0, change: 0.001 },
            { humidity: 20, change: 0.000 },
            { humidity: 40, change: -0.001 },
            { humidity: 60, change: -0.002 },
            { humidity: 80, change: -0.003 },
            { humidity: 100, change: -0.004 }
        ];

        // Find closest humidity and interpolate
        const sorted = humidityEffects.sort((a, b) => 
            Math.abs(a.humidity - humidity) - Math.abs(b.humidity - humidity)
        );
        
        return 1 + sorted[0].change;
    }

    /**
     * Calculate pressure effect on air density
     * Data from environmental-physics.md Pressure Effects
     */
    private calculatePressureRatio(pressure: number): number {
        const pressureEffects = [
            { pressure: 28.0, ratio: 0.937 },
            { pressure: 29.0, ratio: 0.970 },
            { pressure: 29.92, ratio: 1.000 },
            { pressure: 30.5, ratio: 1.019 },
            { pressure: 31.0, ratio: 1.036 }
        ];

        // Find closest pressure and interpolate
        const sorted = pressureEffects.sort((a, b) => 
            Math.abs(a.pressure - pressure) - Math.abs(b.pressure - pressure)
        );
        
        return sorted[0].ratio;
    }

    /**
     * Calculate ball temperature effects
     * Data from environmental-physics.md Ball Temperature Impact
     */
    private calculateBallTempEffects(
        temperature: number,
        ballProperties: BallProperties
    ): {
        compressionChange: number;
        corChange: number;
        distanceEffect: number;
    } {
        const tempEffects = [
            { temp: 40, compression: 5, cor: -0.010, distance: -0.025 },
            { temp: 50, compression: 3, cor: -0.006, distance: -0.015 },
            { temp: 60, compression: 1, cor: -0.002, distance: -0.005 },
            { temp: 70, compression: 0, cor: 0.000, distance: 0.000 },
            { temp: 80, compression: -1, cor: 0.002, distance: 0.005 },
            { temp: 90, compression: -2, cor: 0.004, distance: 0.010 },
            { temp: 100, compression: -3, cor: 0.006, distance: 0.015 }
        ];

        // Find closest temperature and interpolate
        const sorted = tempEffects.sort((a, b) => 
            Math.abs(a.temp - temperature) - Math.abs(b.temp - temperature)
        );

        // Apply ball construction sensitivity
        const sensitivity = {
            '2-piece': 0.8,
            '3-piece': 1.0,
            '4-piece': 1.2,
            '5-piece': 1.4
        }[ballProperties.construction] || 1.0;

        return {
            compressionChange: sorted[0].compression,
            corChange: sorted[0].cor,
            distanceEffect: sorted[0].distance * sensitivity
        };
    }

    /**
     * Calculate air density using ideal gas law
     * Formula from environmental-physics.md Mathematical Models
     */
    private calculateAirDensity(
        pressure: number,    // inHg
        temperature: number, // °F
        humidity: number,    // %
        altitude: number     // feet
    ): number {
        // Convert to SI units
        const pressurePa = pressure * 3386.39;    // inHg to Pa
        const tempK = (temperature - 32) * 5/9 + 273.15; // °F to K

        // Basic density calculation ρ = (P * M) / (R * T)
        let density = (pressurePa * this.MOLAR_MASS_AIR) / (this.GAS_CONSTANT * tempK);

        // Apply altitude and humidity corrections
        density *= this.calculateAltitudeDensityRatio(altitude);
        density *= this.calculateHumidityEffect(humidity);

        return density;
    }

    /**
     * Calculate distance adjustment
     * Formula from environmental-physics.md Distance Adjustment
     */
    private calculateDistanceAdjustment(
        actualDensity: number,
        baselineDensity: number
    ): number {
        return Math.sqrt(baselineDensity / actualDensity);
    }

    /**
     * Process all environmental effects
     */
    public processEnvironment(
        environment: Environment,
        ballProperties: BallProperties
    ): {
        airDensity: number;
        distanceMultiplier: number;
        ballEffects: {
            compressionChange: number;
            corChange: number;
            distanceEffect: number;
        };
    } {
        // Calculate individual effects
        const tempRatio = this.calculateTemperatureDensityRatio(environment.temperature);
        const pressureRatio = this.calculatePressureRatio(environment.pressure);
        const humidityEffect = this.calculateHumidityEffect(environment.humidity);
        const altitudeRatio = this.calculateAltitudeDensityRatio(environment.altitude);

        // Calculate actual air density
        const airDensity = this.calculateAirDensity(
            environment.pressure,
            environment.temperature,
            environment.humidity,
            environment.altitude
        );

        // Calculate baseline density
        const baselineDensity = this.calculateAirDensity(
            this.STANDARD_PRESSURE,
            this.STANDARD_TEMPERATURE,
            this.STANDARD_HUMIDITY,
            this.STANDARD_ALTITUDE
        );

        // Calculate ball temperature effects
        const ballEffects = this.calculateBallTempEffects(
            environment.temperature,
            ballProperties
        );

        // Calculate total distance multiplier
        const densityDistanceEffect = this.calculateDistanceAdjustment(
            airDensity,
            baselineDensity
        );
        const distanceMultiplier = densityDistanceEffect * (1 + ballEffects.distanceEffect);

        return {
            airDensity,
            distanceMultiplier,
            ballEffects
        };
    }
}
