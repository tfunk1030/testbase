'use client'

import { WeatherImpactCalculator } from './weather-impact-calculator'

export type EnvironmentalConditions = {
  temperature: number  // °F
  humidity: number    // 0-1
  pressure: number    // hPa
  altitude: number    // feet
  density: number     // kg/m³
  windSpeed: number   // m/s
  windDirection: number // degrees
}

interface SubscriberCallback {
  (conditions: EnvironmentalConditions): void
}

interface WindEffect {
  headwind: number;
  crosswind: number;
}

// Mock service for UI development
class EnvironmentalService {
  private static instance: EnvironmentalService
  private subscribers: Set<SubscriberCallback> = new Set()
  private currentConditions: EnvironmentalConditions = {
    temperature: 70,
    humidity: 60,
    pressure: 1013.25,
    altitude: 100,
    density: 1.225,
    windSpeed: 5,
    windDirection: 0
  }
  private updateInterval: NodeJS.Timeout | null = null

  private constructor() {}

  public static getInstance(): EnvironmentalService {
    if (!EnvironmentalService.instance) {
      EnvironmentalService.instance = new EnvironmentalService()
    }
    return EnvironmentalService.instance
  }

  public subscribe(callback: SubscriberCallback): () => void {
    this.subscribers.add(callback)
    callback(this.currentConditions)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.currentConditions))
  }

  public startMonitoring(): void {
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => this.updateConditions(), 1000)
    }
  }

  public stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  // Mock data updates for UI development
  private updateConditions(): void {
    const timeScale = Date.now() / (1000 * 60 * 60 * 24)
    this.currentConditions = {
      temperature: 70 + Math.sin(timeScale * Math.PI * 2) * 10,
      humidity: 60 + Math.sin(timeScale * Math.PI * 2 + 1) * 20,
      altitude: 100 + Math.sin(timeScale * Math.PI * 2 + 2) * 10,
      pressure: 1013.25 + Math.sin(timeScale * Math.PI * 2 + 3) * 10,
      windSpeed: Math.abs(Math.sin(timeScale * Math.PI * 2 + 4) * 15),
      windDirection: (timeScale * 360) % 360,
      density: 1.225
    }
    this.notifySubscribers()
  }

  public getConditions(): EnvironmentalConditions {
    return { ...this.currentConditions }
  }

  // Mock calculations for UI development
  public async calculateWindEffect(shotDirection: number): Promise<WindEffect> {
    const relativeAngle = (this.currentConditions.windDirection - shotDirection) * Math.PI / 180
    return {
      headwind: this.currentConditions.windSpeed * Math.cos(relativeAngle),
      crosswind: this.currentConditions.windSpeed * Math.sin(relativeAngle)
    }
  }

  public async calculateAltitudeEffect(): Promise<number> {
    return (this.currentConditions.altitude / 1000) * 2
  }
}

export const environmentalService = EnvironmentalService.getInstance();
