'use client'

import { useEnvironmental } from '@/lib/hooks/use-environmental'
import { useSettings } from '@/lib/settings-context'
import { 
  Thermometer, 
  Droplets, 
  Mountain, 
  Gauge, 
  ArrowUp,
  Wind
} from 'lucide-react'
import { useState, useEffect } from 'react'

export default function WeatherDashboard() {
  const { conditions } = useEnvironmental()
  const { formatTemperature, formatAltitude } = useSettings()

  // Use client-side only rendering to avoid hydration mismatch
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient || !conditions) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Loading conditions...</h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Current Conditions</h1>

      {/* Main Weather Card */}
      <div className="bg-gray-800 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-blue-400" />
          </div>
          <div className="text-center flex-1">
            <div className="text-4xl font-bold">
              {formatTemperature(conditions?.temperature ?? 0)}
            </div>
            <div className="text-gray-400 text-sm">
              Feels like {formatTemperature((conditions?.temperature ?? 0) + 2)}
            </div>
          </div>
          <div className="w-12"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Detailed Conditions */}
      <div className="grid grid-cols-2 gap-4">
        {/* Humidity */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Droplets className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm text-gray-400">Humidity</div>
          </div>
          <div className="mt-2 ml-11 text-lg font-medium">
            {conditions?.humidity?.toFixed(0)}%
          </div>
        </div>

        {/* Altitude */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Mountain className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm text-gray-400">Altitude</div>
          </div>
          <div className="mt-2 ml-11 text-lg font-medium">
            {formatAltitude(conditions?.altitude ?? 0)}
          </div>
        </div>

        {/* Pressure */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Gauge className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm text-gray-400">Pressure</div>
          </div>
          <div className="mt-2 ml-11 text-lg font-medium">
            {conditions?.pressure?.toFixed(0)} hPa
          </div>
        </div>

        {/* Air Density */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Wind className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm text-gray-400">Air Density</div>
          </div>
          <div className="mt-2 ml-11 text-lg font-medium">
            {conditions?.density?.toFixed(3)} kg/m³
          </div>
        </div>
      </div>
    </div>
  )
}
