'use client'

import React, { useEffect, useState } from 'react'
import { Card } from './ui/card'
import { usePremium } from '@/lib/premium-context'
import { useEnvironmental } from '@/lib/hooks/use-environmental'
import { useSettings } from '@/lib/settings-context'
import { Wind, Target, ArrowUp, Thermometer } from 'lucide-react'

const defaultShotData = {
  conditions: {
    temperature: '20°C',
    humidity: '50%',
    pressure: '1013 hPa',
    altitude: '0 m',
    wind: {
      speed: '0 mph',
      direction: 0
    }
  },
  shot: {
    intendedYardage: 150,
    adjustedYardage: 150,
    actualYardage: 150,
    suggestedClub: "7 Iron",
    alternateClub: "6 Iron",
    flightPath: {
      apex: "82 ft",
      landingAngle: "45°",
      carry: "148 yards",
      total: "150 yards"
    },
    spinRate: 2800,
    launchAngle: 16.5,
    ballSpeed: 115,
    smashFactor: 1.48
  }
}

export default function ShotAnalysis() {
  const { isPremium } = usePremium()
  const { conditions } = useEnvironmental()
  const { formatTemperature, formatAltitude } = useSettings()
  const [shotData, setShotData] = useState(defaultShotData)

  useEffect(() => {
    if (!conditions) {
      setShotData(defaultShotData)
      return
    }

    setShotData({
      conditions: {
        temperature: formatTemperature(conditions.temperature),
        humidity: `${Math.round(conditions.humidity)}%`,
        pressure: `${Math.round(conditions.pressure)} hPa`,
        altitude: formatAltitude(conditions.altitude),
        wind: {
          speed: `${Math.round(conditions.windSpeed * 2.237)} mph`,
          direction: conditions.windDirection
        }
      },
      shot: {
        intendedYardage: 150,
        adjustedYardage: 156,
        actualYardage: 153,
        suggestedClub: "7 Iron",
        alternateClub: "6 Iron",
        flightPath: {
          apex: "82 ft",
          landingAngle: "45°",
          carry: "148 yards",
          total: "153 yards"
        },
        spinRate: 2800,
        launchAngle: 16.5,
        ballSpeed: 115,
        smashFactor: 1.48
      }
    })
  }, [conditions, formatTemperature, formatAltitude])

  if (!conditions) {
    return (
      <div className="space-y-4">
        <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-blue-400">Shot Analysis</h2>
                <p className="text-sm text-gray-400">Advanced shot metrics and visualization</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">Loading shot data...</div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-blue-400">Shot Analysis</h2>
              <p className="text-sm text-gray-400">Advanced shot metrics and visualization</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          
          {/* Conditions Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Thermometer className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Temperature</span>
              </div>
              <div className="text-lg">{shotData.conditions.temperature}</div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Wind</span>
              </div>
              <div className="text-lg">{shotData.conditions.wind.speed}</div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUp className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Altitude</span>
              </div>
              <div className="text-lg">{shotData.conditions.altitude}</div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-400">Pressure</span>
              </div>
              <div className="text-lg">{shotData.conditions.pressure}</div>
            </div>
          </div>

          {/* Shot Data Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-blue-400 mb-2">Target</h3>
              <div className="text-lg">{shotData.shot.intendedYardage} yards</div>
              <div className="text-sm text-gray-400 mt-1">
                Adjusted: {shotData.shot.adjustedYardage} yards
              </div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-blue-400 mb-2">Result</h3>
              <div className="text-lg">{shotData.shot.actualYardage} yards</div>
              <div className="text-sm text-gray-400 mt-1">
                Deviation: {Math.abs(shotData.shot.actualYardage - shotData.shot.intendedYardage)} yards
              </div>
            </div>
          </div>

          {isPremium && (
            <>
              {/* Advanced Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Spin Rate</div>
                  <div className="text-lg">{shotData.shot.spinRate} rpm</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Launch Angle</div>
                  <div className="text-lg">{shotData.shot.launchAngle}°</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Ball Speed</div>
                  <div className="text-lg">{shotData.shot.ballSpeed} mph</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Smash Factor</div>
                  <div className="text-lg">{shotData.shot.smashFactor}</div>
                </div>
              </div>

              {/* Club Selection */}
              <div className="bg-gray-800/50 p-4 rounded-lg mt-4">
                <h3 className="text-blue-400 mb-2">Suggested Clubs</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400">Primary</div>
                    <div className="text-lg">{shotData.shot.suggestedClub}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Alternative</div>
                    <div className="text-lg">{shotData.shot.alternateClub}</div>
                  </div>
                </div>
              </div>

              {/* Flight Data */}
              <div className="bg-gray-800/50 p-4 rounded-lg mt-4">
                <h3 className="text-blue-400 mb-2">Flight Data</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400">Carry</div>
                    <div>{shotData.shot.flightPath.carry}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Total</div>
                    <div>{shotData.shot.flightPath.total}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Apex</div>
                    <div>{shotData.shot.flightPath.apex}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Landing Angle</div>
                    <div>{shotData.shot.flightPath.landingAngle}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
