'use client'

import React, { useState, useEffect } from 'react'
import { Card } from './ui/card'
import { Wind, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

interface WindLayer {
  altitude: number
  speed: number
  direction: number
  temperature: number
  density: number
}

const WindProfileVisualizer = () => {
  const [windLayers, setWindLayers] = useState<WindLayer[]>([
    { altitude: 0, speed: 8, direction: 45, temperature: 72, density: 1.225 },
    { altitude: 50, speed: 10, direction: 50, temperature: 71, density: 1.223 },
    { altitude: 100, speed: 12, direction: 55, temperature: 70, density: 1.221 },
    { altitude: 150, speed: 14, direction: 60, temperature: 69, density: 1.219 },
    { altitude: 200, speed: 16, direction: 65, temperature: 68, density: 1.217 },
  ])

  const getWindArrowStyle = (direction: number) => {
    const rotation = direction - 90 // Adjust for arrow pointing right by default
    return {
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s ease-in-out'
    }
  }

  const getWindSpeedColor = (speed: number) => {
    if (speed < 5) return 'text-green-500'
    if (speed < 10) return 'text-yellow-500'
    if (speed < 15) return 'text-orange-500'
    return 'text-red-500'
  }

  const calculateDensityAltitude = (temperature: number, density: number) => {
    const standardDensity = 1.225 // kg/m³ at sea level
    const standardTemp = 59 // °F
    const tempDiff = temperature - standardTemp
    const densityRatio = density / standardDensity
    return Math.round((1 - densityRatio) * 1000)
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Wind Profile Analysis</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wind Profile Visualization */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Wind Layers</h3>
            <div className="space-y-6">
              {windLayers.map((layer, index) => (
                <div key={layer.altitude} className="relative flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg">
                  <div className="flex-shrink-0 w-16">
                    <div className="text-sm text-gray-400">
                      {layer.altitude}ft
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <Wind className={`w-5 h-5 ${getWindSpeedColor(layer.speed)}`} />
                      <div className="text-lg font-semibold">
                        {layer.speed} mph
                      </div>
                      <div 
                        className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center"
                        style={getWindArrowStyle(layer.direction)}
                      >
                        <ArrowRight className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-400">
                      <div>
                        Temperature: {layer.temperature}°F
                      </div>
                      <div>
                        Density Alt: {calculateDensityAltitude(layer.temperature, layer.density)}ft
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wind Effects Analysis */}
          <div className="space-y-6">
            <Card className="p-4 bg-gray-800">
              <h3 className="text-lg font-semibold mb-3">Shot Impact Analysis</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Carry Effect</div>
                    <div className="text-xl font-semibold text-blue-400">
                      {calculateCarryEffect(windLayers)}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Lateral Drift</div>
                    <div className="text-xl font-semibold text-blue-400">
                      {calculateLateralDrift(windLayers)} yards
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Layer-by-Layer Impact</h4>
                  <div className="space-y-2">
                    {windLayers.map((layer, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-400">{layer.altitude}ft:</span>
                        <span className="text-blue-400">
                          {calculateLayerImpact(layer)}% effect
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gray-800">
              <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
              <div className="space-y-3">
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Club Selection</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {getClubRecommendation(windLayers)}
                  </div>
                </div>
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Aim Adjustment</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {getAimAdjustment(windLayers)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Helper functions for calculations
function calculateCarryEffect(layers: WindLayer[]): number {
  const avgHeadwind = layers.reduce((sum, layer) => {
    const headwindComponent = layer.speed * Math.cos(layer.direction * Math.PI / 180)
    return sum + headwindComponent
  }, 0) / layers.length

  return Math.round((1 + avgHeadwind * 0.01) * 100)
}

function calculateLateralDrift(layers: WindLayer[]): number {
  const avgCrosswind = layers.reduce((sum, layer) => {
    const crosswindComponent = layer.speed * Math.sin(layer.direction * Math.PI / 180)
    return sum + crosswindComponent
  }, 0) / layers.length

  return Math.round(avgCrosswind * 0.5 * 10) / 10
}

function calculateLayerImpact(layer: WindLayer): number {
  const impact = (layer.speed * Math.cos(layer.direction * Math.PI / 180)) * 0.01
  return Math.round(impact * 100)
}

function getClubRecommendation(layers: WindLayer[]): string {
  const carryEffect = calculateCarryEffect(layers)
  if (carryEffect < 95) return "Club up one - reduced carry distance"
  if (carryEffect > 105) return "Club down one - increased carry distance"
  return "Standard club selection"
}

function getAimAdjustment(layers: WindLayer[]): string {
  const lateralDrift = calculateLateralDrift(layers)
  if (Math.abs(lateralDrift) < 1) return "No adjustment needed"
  const direction = lateralDrift > 0 ? "left" : "right"
  return `Aim ${Math.abs(lateralDrift)} yards ${direction}`
}

export default WindProfileVisualizer
