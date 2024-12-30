import { create } from 'zustand'
import { convertAltitude } from '@/lib/utils/conversions'

interface Environment {
  altitude: number
  temperature: number
  humidity: number
  pressure: number
  density: number
}

interface Settings {
  altitudeUnit: 'feet' | 'meters'
  distanceUnit: 'yards' | 'meters'
}

interface Adjustments {
  adjustedYardage: number
  densityEffect: number
  altitudeEffect: number
  humidityEffect: number
  temperatureEffect: number
  totalEffect: number
}

interface CalculationParams {
  targetDistance: number
  environment: Environment
  settings: Settings
}

interface ShotCalculatorState {
  targetDistance: number
  adjustments: Adjustments | null
  isCalculating: boolean
  error: Error | null
  setTargetDistance: (distance: number) => void
  calculateShot: (params: CalculationParams) => void
}

export const useShotCalculator = create<ShotCalculatorState>((set, get) => ({
  targetDistance: 150,
  adjustments: null,
  isCalculating: false,
  error: null,

  setTargetDistance: (distance) => set({ targetDistance: distance }),

  calculateShot: (params) => {
    const { environment, settings } = params
    
    // Convert altitude if needed
    const altitudeInMeters = settings.altitudeUnit === 'feet'
      ? convertAltitude(environment.altitude, 'meters')
      : environment.altitude

    // Calculate individual effects
    const densityEffect = (environment.density - 1.225) * params.targetDistance * 0.1
    const altitudeEffect = altitudeInMeters * 0.00018 * params.targetDistance
    const humidityEffect = (environment.humidity - 50) * 0.0002 * params.targetDistance
    const temperatureEffect = (environment.temperature - 20) * 0.001 * params.targetDistance

    // Calculate total adjustment
    const totalEffect = densityEffect + altitudeEffect + humidityEffect + temperatureEffect
    const adjustedYardage = params.targetDistance + totalEffect

    // Update state with results
    set({
      adjustments: {
        adjustedYardage,
        densityEffect,
        altitudeEffect,
        humidityEffect,
        temperatureEffect,
        totalEffect
      }
    })
  }
}))
