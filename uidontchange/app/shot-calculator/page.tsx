'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useEnvironmental } from '@/lib/hooks/use-environmental'
import { useClubSettings } from '@/lib/club-settings-context'
import { usePremium } from '@/lib/premium-context'
import { useSettings } from '@/lib/settings-context'
import { useShotCalc } from '@/lib/shot-calc-context'
import { 
  Target, 
  Wind, 
  Thermometer, 
  Droplets, 
  Mountain, 
  Gauge,
  Lock
} from 'lucide-react'

export default function DistanceCalculator() {
  const { conditions } = useEnvironmental()
  const { getRecommendedClub, clubs } = useClubSettings()
  const { isPremium, setShowUpgradeModal } = usePremium()
  const { settings, convertDistance, formatDistance, formatTemperature, formatAltitude, convertAltitude } = useSettings()
  const { setShotCalcData } = useShotCalc()
  const [targetYardage, setTargetYardage] = useState(150)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  // Calculate all adjustments in one memoized function
  const calculateAdjustments = useCallback(() => {
    if (!conditions) return null;

    const altitudeInMeters = settings.altitudeUnit === 'feet' 
      ? convertAltitude(conditions.altitude, 'meters')
      : conditions.altitude

    const densityEffect = (conditions.density - 1.225) * targetYardage * 0.1
    const altitudeEffect = altitudeInMeters * 0.00018 * targetYardage
    const humidityEffect = (conditions.humidity - 50) * 0.0002 * targetYardage
    const temperatureEffect = (conditions.temperature - 20) * 0.001 * targetYardage

    const totalEffect = densityEffect + altitudeEffect + humidityEffect + temperatureEffect
    const adjustedYardage = targetYardage + totalEffect

    return {
      adjustedYardage,
      densityEffect,
      altitudeEffect,
      humidityEffect,
      temperatureEffect,
      totalEffect
    }
  }, [conditions, targetYardage, settings.altitudeUnit, convertAltitude])

  // Memoize the results
  const adjustments = useMemo(() => calculateAdjustments(), [calculateAdjustments])

  // Update context only when needed
  useEffect(() => {
    // Prevent multiple updates in the same render cycle
    const now = Date.now()
    if (lastUpdate && now - lastUpdate < 100) return;

    if (conditions && adjustments) {
      setLastUpdate(now)
      setShotCalcData({
        targetYardage,
        elevation: conditions.altitude,
        temperature: conditions.temperature,
        humidity: conditions.humidity,
        pressure: conditions.pressure,
        adjustedDistance: adjustments.adjustedYardage
      })
    }
  }, [conditions, adjustments, targetYardage, setShotCalcData, lastUpdate])

  const recommendedClub = useMemo(() => 
    adjustments ? getRecommendedClub(adjustments.adjustedYardage) : null, 
    [adjustments, getRecommendedClub]
  )

  if (!conditions) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-800 rounded mb-4"></div>
          <div className="h-8 bg-gray-800 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  const formatAdjustment = (yards: number) => {
    const value = settings.distanceUnit === 'meters' 
      ? convertDistance(Math.abs(yards), 'meters')
      : Math.abs(yards)
    
    return `${yards >= 0 ? '+' : '-'}${Math.round(value)} ${
      settings.distanceUnit === 'yards' ? 'yds' : 'm'
    }`
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Shot Calculator</h1>

      {/* Target Distance Input */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="text-sm text-gray-400 mb-2">Target Distance</div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={settings.distanceUnit === 'yards' ? '50' : '45'}
            max={settings.distanceUnit === 'yards' ? '300' : '275'}
            value={targetYardage}
            onChange={(e) => setTargetYardage(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/50 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-blue-500/50"
          />
          <div className="text-2xl font-bold w-32 text-right">
            {formatDistance(targetYardage)}
          </div>
        </div>
      </div>

      {/* Environmental Adjustments */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Shot Adjustments</h2>
        
        <div className="space-y-4">
          {/* Air Density */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Gauge className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm">Air Density</div>
                <div className="text-xs text-gray-400">
                  {conditions.density.toFixed(3)} kg/m³
                </div>
              </div>
            </div>
            <div className={`${(adjustments?.densityEffect ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatAdjustment(adjustments?.densityEffect ?? 0)}
            </div>
          </div>

          {/* Altitude */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Mountain className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm">Altitude</div>
                <div className="text-xs text-gray-400">
                  {formatAltitude(conditions.altitude)}
                </div>
              </div>
            </div>
            <div className="text-blue-400">
              {adjustments && formatAdjustment(adjustments.altitudeEffect)}
            </div>
          </div>

          {/* Temperature */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Thermometer className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm">Temperature</div>
                <div className="text-xs text-gray-400">
                  {formatTemperature(conditions.temperature)}
                </div>
              </div>
            </div>
            <div className={`${(adjustments?.temperatureEffect ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatAdjustment(adjustments?.temperatureEffect ?? 0)}
            </div>
          </div>

          {/* Humidity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Droplets className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm">Humidity</div>
                <div className="text-xs text-gray-400">
                  {conditions.humidity.toFixed(0)}%
                </div>
              </div>
            </div>
            <div className={`${(adjustments?.humidityEffect ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatAdjustment(adjustments?.humidityEffect ?? 0)}
            </div>
          </div>

          <div className="h-px bg-gray-700 my-4" />

          {/* Total Adjustment */}
          <div className="flex items-center justify-between font-medium">
            <div>Total Adjustment</div>
            <div className={`${(adjustments?.totalEffect ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatAdjustment(adjustments?.totalEffect ?? 0)}
            </div>
          </div>

          {/* Adjusted Distance */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">Playing Distance</div>
            <div className="text-lg font-bold">
              {adjustments && formatDistance(adjustments.adjustedYardage)}
            </div>
          </div>
        </div>
      </div>

      {/* Club Recommendation */}
      {recommendedClub && (
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Recommended Club</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-xl font-medium">{recommendedClub.name}</div>
                <div className="text-sm text-gray-400">
                  Normal carry: {formatDistance(recommendedClub.normalYardage)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Feature Teaser */}
      {!isPremium && (
        <div className="bg-gray-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Wind className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium">Wind Analysis</h3>
              <p className="text-sm text-gray-400">
                Upgrade to get precise wind adjustments
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Upgrade to Premium
          </button>
        </div>
      )}
    </div>
  )
}
