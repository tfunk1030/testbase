'use client'

import React, { useState, useEffect } from 'react'

export default function SimpleWeatherDisplay() {
  const [currentTime, setCurrentTime] = useState('')

  // Update time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }

    updateTime() // Initial update
    const interval = setInterval(updateTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const mockWeather = {
    current: {
      temp: 72,
      humidity: 45,
      pressure: 29.92,
      altitude: 850,
      wind: {
        speed: 10,
        direction: 45,
        gust: 12
      }
    },
    golfImpact: {
      densityAltitude: 925,
      carryEffect: 1.02
    }
  }

  return (
    <div className="space-y-4">
      {/* Current Conditions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-4xl">⛅</div>
          <div>
            <div className="text-2xl font-bold">{mockWeather.current.temp}°</div>
            <div className="text-xs text-gray-400">Partly Cloudy</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">Humidity</div>
          <div className="text-2xl font-bold">{mockWeather.current.humidity}%</div>
        </div>
      </div>

      {/* Wind Information */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            Speed
          </div>
          <div className="text-lg font-bold">
            {mockWeather.current.wind.speed}<span className="text-xs ml-1">mph</span>
          </div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            Direction
          </div>
          <div className="text-lg font-bold">
            NE<span className="text-xs ml-1">{mockWeather.current.wind.direction}°</span>
          </div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            Gusts
          </div>
          <div className="text-lg font-bold">
            {mockWeather.current.wind.gust}<span className="text-xs ml-1">mph</span>
          </div>
        </div>
      </div>

      {/* Time Display */}
      {currentTime && (
        <div className="text-xs text-gray-400 text-center">
          Last updated: {currentTime}
        </div>
      )}
    </div>
  )
}
