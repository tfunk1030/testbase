import { create } from 'zustand'
import { convertAltitude } from '@/lib/utils/conversions'

interface Environment {
  altitude: number
  temperature: number
  humidity: number
  pressure: number
  density: number
  wind: {
    speed: number
    direction: number
  }
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
  windSpeed: number
  windDirection: number
  adjustments: Adjustments | null
  isCalculating: boolean
  error: Error | null
  setTargetDistance: (distance: number) => void
  setWindSpeed: (speed: number) => void
  setWindDirection: (direction: number) => void
  calculateShot: (params: CalculationParams) => Promise<void>
}

export const useShotCalculator = create<ShotCalculatorState>((set) => ({
  targetDistance: 150,
  windSpeed: 0,
  windDirection: 0,
  adjustments: null,
  isCalculating: false,
  error: null,

  setTargetDistance: (distance) => set({ targetDistance: distance }),
  setWindSpeed: (speed) => set({ windSpeed: speed }),
  setWindDirection: (direction) => set({ windDirection: direction }),

  calculateShot: async (params: CalculationParams) => {
    try {
      set({ isCalculating: true, error: null });

      const response = await fetch('/api/shot-calculator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDistance: params.targetDistance,
          environment: params.environment,
          settings: params.settings
        }),
      });

      if (!response.ok) {
        throw new Error('Calculation failed');
      }

      const adjustments = await response.json();
      set({ adjustments, isCalculating: false });
    } catch (error) {
      console.error('Shot calculation error:', error);
      set({ 
        error: error as Error, 
        isCalculating: false,
        adjustments: {
          adjustedYardage: params.targetDistance,
          densityEffect: 0,
          altitudeEffect: 0,
          humidityEffect: 0,
          temperatureEffect: 0,
          totalEffect: 0
        }
      });
    }
  }
}));
