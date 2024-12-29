export interface EnvironmentalConditions {
  temperature: number;      // in Fahrenheit
  humidity: number;        // percentage
  pressure: number;        // in hPa
  altitude: number;        // in feet
  windSpeed: number;       // in mph
  windDirection: number;   // in degrees (0-360)
  density: number;         // in kg/m³
}

export interface ShotAdjustments {
  distanceAdjustment: number;  // percentage
  trajectoryShift: number;     // in yards
  spinAdjustment: number;      // percentage
  launchAngleAdjustment: number; // in degrees
}

export class WeatherImpactCalculator {
  private static readonly STANDARD_TEMP = 59;  // °F
  private static readonly STANDARD_PRESSURE = 1013.25;  // hPa
  private static readonly STANDARD_DENSITY = 1.225;  // kg/m³

  static calculateAirDensity(conditions: Partial<EnvironmentalConditions>): number {
    const tempC = (conditions.temperature! - 32) * 5/9;
    const vaporPressure = this.calculateVaporPressure(conditions.temperature!, conditions.humidity!);
    const dryPressure = conditions.pressure! - vaporPressure;
    
    // Using the ideal gas law with corrections for humidity
    const density = (dryPressure * 100) / (287.05 * (tempC + 273.15)) +
                   (vaporPressure * 100) / (461.495 * (tempC + 273.15));
    
    return density;
  }

  static calculateVaporPressure(tempF: number, humidity: number): number {
    const tempC = (tempF - 32) * 5/9;
    // Magnus formula for saturation vapor pressure
    const saturationPressure = 6.1078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    return (humidity / 100) * saturationPressure;
  }

  static calculateWindEffect(windSpeed: number, windDirection: number, shotDirection: number): {
    headwind: number;
    crosswind: number;
  } {
    const relativeAngle = (windDirection - shotDirection) * Math.PI / 180;
    return {
      headwind: windSpeed * Math.cos(relativeAngle),
      crosswind: windSpeed * Math.sin(relativeAngle)
    };
  }

  static calculateShotAdjustments(
    conditions: EnvironmentalConditions,
    shotDirection: number = 0
  ): ShotAdjustments {
    const densityRatio = conditions.density / this.STANDARD_DENSITY;
    const wind = this.calculateWindEffect(conditions.windSpeed, conditions.windDirection, shotDirection);
    
    // Calculate distance adjustment based on air density and wind
    const densityEffect = (1 - densityRatio) * 100; // Percentage change
    const windEffect = -wind.headwind * 1.5; // Approximate 1.5% per mph headwind
    const distanceAdjustment = densityEffect + windEffect;

    // Calculate trajectory shift from crosswind
    const trajectoryShift = wind.crosswind * 2; // Approximate 2 yards per mph crosswind

    // Spin adjustment based on air density
    const spinAdjustment = (densityRatio - 1) * -50; // Less spin in thinner air

    // Launch angle adjustment for wind conditions
    const launchAngleAdjustment = wind.headwind * 0.1; // Slight adjustment for wind

    return {
      distanceAdjustment,
      trajectoryShift,
      spinAdjustment,
      launchAngleAdjustment
    };
  }

  static calculateAltitudeEffect(altitude: number): number {
    // Approximately 2% increase in distance per 1000ft of elevation
    return (altitude / 1000) * 2;
  }

  static getFlightTimeAdjustment(conditions: EnvironmentalConditions): number {
    const densityRatio = conditions.density / this.STANDARD_DENSITY;
    // Flight time increases in thinner air
    return 1 + ((1 - densityRatio) * 0.1);
  }

  static getRecommendedAdjustments(conditions: EnvironmentalConditions): string[] {
    const recommendations: string[] = [];
    const wind = this.calculateWindEffect(conditions.windSpeed, conditions.windDirection, 0);

    if (Math.abs(wind.headwind) > 5) {
      recommendations.push(wind.headwind > 0
        ? "Into wind: Club up and swing easier for better control"
        : "Downwind: Club down and be aware of reduced spin/control");
    }

    if (Math.abs(wind.crosswind) > 5) {
      recommendations.push("Significant crosswind: Allow for shot shape into the wind");
    }

    if (conditions.temperature < 50) {
      recommendations.push("Cold conditions: Ball will fly shorter, consider clubbing up");
    }

    if (conditions.humidity > 80) {
      recommendations.push("High humidity: Ball will fly slightly shorter");
    }

    if (conditions.altitude > 3000) {
      recommendations.push("High altitude: Ball will fly further, consider clubbing down");
    }

    return recommendations;
  }

  static getEnvironmentalSummary(conditions: EnvironmentalConditions): string {
    const adjustments = this.calculateShotAdjustments(conditions);
    const altitudeEffect = this.calculateAltitudeEffect(conditions.altitude);

    return `
      Playing conditions will affect your shots as follows:
      • Distance: ${adjustments.distanceAdjustment > 0 ? 'Increase' : 'Decrease'} by ${Math.abs(adjustments.distanceAdjustment).toFixed(1)}%
      • Ball flight: ${Math.abs(adjustments.trajectoryShift).toFixed(1)} yards ${adjustments.trajectoryShift > 0 ? 'right' : 'left'}
      • Altitude effect: +${altitudeEffect.toFixed(1)}% carry distance
      • Spin rate: ${adjustments.spinAdjustment > 0 ? 'Increased' : 'Decreased'} effect
    `.trim();
  }
}

export default WeatherImpactCalculator;
