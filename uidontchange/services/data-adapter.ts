// Data adapter to transform your research data to UI format
export class DataAdapter {
  // Convert research shot data to UI format
  static adaptShotData(researchData: any): any {
    return {
      distance: researchData.distance || 0,
      lateralOffset: researchData.lateralOffset || 0,
      height: researchData.height || 0,
      // Add more field mappings
    }
  }

  // Convert research weather data to UI format
  static adaptWeatherData(researchData: any): any {
    return {
      temperature: researchData.temp || 0,
      windSpeed: researchData.windSpeed || 0,
      windDirection: researchData.windDir || 0,
      // Add more field mappings
    }
  }

  // Convert research flight path data to UI format
  static adaptFlightPath(researchData: any[]): any[] {
    return researchData.map(point => ({
      x: point.distance || 0,
      y: point.height || 0,
      z: point.lateralOffset || 0,
      // Add more field mappings
    }))
  }

  // Convert club data to UI format
  static adaptClubData(researchData: any): any {
    return {
      name: researchData.clubName || '',
      distance: researchData.avgDistance || 0,
      loft: researchData.loftAngle || 0,
      // Add more field mappings
    }
  }
}
