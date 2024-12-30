import { create } from 'zustand'
import { Environment } from '@/types'

interface WindEnvironment extends Environment {
  wind: {
    speed: number;
    direction: number;
    gust: number;
  };
}

interface WindAdjustments {
  standard: {
    adjustedYardage: number;
    densityEffect: number;
    altitudeEffect: number;
    humidityEffect: number;
    temperatureEffect: number;
    totalEffect: number;
  };
  wind: {
    carry: number;
    direction: number;
    heightEffect: number;
    gustEffect: number;
    totalWindEffect: number;
  };
  total: {
    distance: number;
    adjustment: number;
    direction: number;
  };
}

interface WindCalculatorState {
  targetDistance: number;
  adjustments: WindAdjustments | null;
  isCalculating: boolean;
  error: Error | null;
  setTargetDistance: (distance: number) => void;
  calculateWindShot: (params: {
    targetDistance: number;
    environment: WindEnvironment;
    settings: {
      altitudeUnit: 'feet' | 'meters';
      distanceUnit: 'yards' | 'meters';
      speedUnit: 'mph' | 'ms';
    };
  }) => Promise<void>;
}

export const useWindCalculator = create<WindCalculatorState>((set) => ({
  targetDistance: 150,
  adjustments: null,
  isCalculating: false,
  error: null,

  setTargetDistance: (distance) => set({ targetDistance: distance }),

  calculateWindShot: async (params) => {
    try {
      set({ isCalculating: true, error: null });

      const response = await fetch('/api/wind-calculator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Wind calculation failed');
      }

      const adjustments = await response.json();
      set({ adjustments, isCalculating: false });
    } catch (error) {
      console.error('Wind calculation error:', error);
      set({ 
        error: error as Error, 
        isCalculating: false,
        adjustments: null
      });
    }
  }
}));
