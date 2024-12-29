'use client'

import { usePremium } from '@/lib/premium-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useShotCalc } from '@/lib/shot-calc-context'
import WindDirectionCompass from '@/components/wind-direction-compass'

interface WindCalcResult {
  distanceEffect: number  // positive = plays longer, negative = plays shorter
  lateralEffect: number   // positive = aim right, negative = aim left
  totalDistance: number   // final playing distance including shot calc and wind effects
}

export default function WindAdjustment() {
  const { isPremium } = usePremium()
  const router = useRouter()
  const { shotCalcData } = useShotCalc()
  const [windDirection, setWindDirection] = useState(0)  // 0-360 degrees
  const [windSpeed, setWindSpeed] = useState(10)        // mph
  const [targetYardage, setTargetYardage] = useState(150)
  const shotDirection = 0  // Fixed at 0 degrees (North)
  const [result, setResult] = useState<WindCalcResult | null>(null)

  // Update target yardage when shot calc data changes
  useEffect(() => {
    if (shotCalcData.targetYardage) {
      setTargetYardage(shotCalcData.targetYardage)
    }
  }, [shotCalcData.targetYardage])

  useEffect(() => {
    if (!isPremium) {
      router.push('/')
    }
  }, [isPremium, router])

  const calculateWindEffect = () => {
    // Convert angles to radians
    const windRad = (windDirection * Math.PI) / 180
    const shotRad = (shotDirection * Math.PI) / 180

    // Calculate relative wind angle (wind direction relative to shot direction)
    const relativeAngle = windRad - shotRad

    // Calculate headwind/tailwind component (cosine of relative angle)
    const headwindComponent = Math.cos(relativeAngle) * windSpeed

    // Calculate crosswind component (sine of relative angle)
    const crosswindComponent = Math.sin(relativeAngle) * windSpeed

    // Approximate effects (these multipliers can be adjusted based on desired sensitivity)
    // Positive headwind (plays longer) should give positive distance effect
    const distanceEffect = headwindComponent * (targetYardage / 100)  // positive means plays longer
    const lateralEffect = crosswindComponent * (targetYardage / 150)   // positive means aim right

    // Calculate total playing distance including shot calc adjustment
    const totalDistance = (shotCalcData.adjustedDistance || targetYardage) + distanceEffect

    setResult({
      distanceEffect: Math.round(distanceEffect),
      lateralEffect: Math.round(lateralEffect),
      totalDistance: Math.round(totalDistance)
    })

    // Scroll to results
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleDirectionChange = (type: 'wind' | 'shot', degrees: number) => {
    if (type === 'wind') {
      setWindDirection(degrees)
    } else {
      // Do nothing since shot direction is fixed
    }
  }

  if (!isPremium) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Wind Calculator</h1>

      <div className="max-w-xl mx-auto space-y-6 bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700/50 shadow-xl">
        {/* Inputs */}
        <div className="space-y-6">
          {/* Compass with Direction Controls */}
          <div className="flex flex-col items-center">
            <div className="text-sm font-medium text-gray-400 mb-2 bg-gray-900/50 px-4 py-2 rounded-full">
              <span>
                <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1 shadow-lg shadow-blue-500/50"></span>
                Wind: {windDirection}°
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-4 opacity-75">
              Drag the blue handle to set wind direction
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-2xl"></div>
              <WindDirectionCompass
                windDirection={windDirection}
                shotDirection={shotDirection}
                onChange={(type, degrees) => {
                  if (type === 'wind') {
                    setWindDirection(degrees);
                  }
                }}
                size={280}
                lockShot={true}
              />
            </div>
          </div>

          {/* Wind Speed Input */}
          <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/50">
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-gray-400">Wind Speed</label>
              <span className="text-sm font-medium text-blue-400">{windSpeed} mph</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={windSpeed}
              onChange={(e) => setWindSpeed(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/50 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-blue-500/50"
            />
          </div>

          {/* Target Yardage Input */}
          <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/50">
            <label className="block text-sm font-medium text-gray-400 mb-1">Target Yardage</label>
            <input
              type="number"
              min="50"
              max="300"
              value={targetYardage}
              onChange={(e) => setTargetYardage(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800/50 rounded text-white border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateWindEffect}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 active:transform active:scale-[0.98]"
        >
          Calculate Wind Effect
        </button>
      </div>

      {/* Results Panel */}
      {result && (
        <div className="max-w-xl mx-auto mt-6 bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700/50 shadow-xl">
          <div className="space-y-4">
            <div className="text-xl text-gray-400">
              Play this shot{' '}
              <span className="text-2xl font-bold text-blue-400">
                {Math.round(result.totalDistance)} yards
              </span>
            </div>
            
            {result.lateralEffect !== 0 && (
              <div className="text-xl text-gray-400">
                Aim{' '}
                <span className="text-2xl font-bold text-emerald-400">
                  {Math.abs(result.lateralEffect)} yards {result.lateralEffect > 0 ? 'right' : 'left'}
                </span>
              </div>
            )}
          </div>

          {/* Detailed Effects */}
          <div className="grid grid-cols-2 gap-4 text-lg">
            <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/50">
              <div className="font-medium mb-2 text-gray-400">Weather Effect</div>
              {shotCalcData.adjustedDistance && shotCalcData.targetYardage ? (
                <div className={`font-semibold ${shotCalcData.adjustedDistance > shotCalcData.targetYardage ? 'text-emerald-400' : 'text-red-400'}`}>
                  {shotCalcData.adjustedDistance > shotCalcData.targetYardage ? '+' : '-'}
                  {Math.abs(Math.round(shotCalcData.adjustedDistance - shotCalcData.targetYardage))} yards
                </div>
              ) : (
                <div>No effect</div>
              )}
            </div>
            <div className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/50">
              <div className="font-medium mb-2 text-gray-400">Wind Effect</div>
              {result.distanceEffect !== 0 ? (
                <div className={`font-semibold ${result.distanceEffect > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.distanceEffect > 0 ? '+' : '-'}
                  {Math.abs(result.distanceEffect)} yards
                </div>
              ) : (
                <div>No effect</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
