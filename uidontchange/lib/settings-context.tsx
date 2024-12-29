'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface Settings {
  distanceUnit: 'yards' | 'meters'
  temperatureUnit: 'celsius' | 'fahrenheit'
  altitudeUnit: 'feet' | 'meters'
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  convertDistance: (distance: number, to?: 'yards' | 'meters') => number
  convertTemperature: (temp: number, to?: 'celsius' | 'fahrenheit') => number
  convertAltitude: (altitude: number, to?: 'feet' | 'meters') => number
  formatDistance: (distance: number) => string
  formatTemperature: (temp: number) => string
  formatAltitude: (altitude: number) => string
}

const defaultSettings: Settings = {
  distanceUnit: 'yards',
  temperatureUnit: 'fahrenheit',
  altitudeUnit: 'feet'
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userSettings')
      return saved ? JSON.parse(saved) : defaultSettings
    }
    return defaultSettings
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userSettings', JSON.stringify(settings))
    }
  }, [settings])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const convertDistance = (distance: number, to?: 'yards' | 'meters') => {
    const unit = to || settings.distanceUnit
    if (unit === 'meters') {
      return distance * 0.9144 // yards to meters
    } else {
      return distance / 0.9144 // meters to yards
    }
  }

  const convertTemperature = (temp: number, to?: 'celsius' | 'fahrenheit') => {
    const unit = to || settings.temperatureUnit
    if (unit === 'fahrenheit') {
      return (temp * 9/5) + 32 // celsius to fahrenheit
    } else {
      return (temp - 32) * 5/9 // fahrenheit to celsius
    }
  }

  const convertAltitude = (altitude: number, to?: 'feet' | 'meters') => {
    const unit = to || settings.altitudeUnit
    if (unit === 'feet') {
      return altitude * 3.28084 // meters to feet
    } else {
      return altitude / 3.28084 // feet to meters
    }
  }

  const formatDistance = (distance: number) => {
    const value = Math.round(distance)
    return `${value} ${settings.distanceUnit === 'yards' ? 'yds' : 'm'}`
  }

  const formatTemperature = (temp: number) => {
    const value = Math.round(temp * 10) / 10
    return `${value}°${settings.temperatureUnit === 'celsius' ? 'C' : 'F'}`
  }

  const formatAltitude = (altitude: number) => {
    const value = Math.round(altitude)
    return `${value} ${settings.altitudeUnit === 'feet' ? 'ft' : 'm'}`
  }

  return (
    <SettingsContext.Provider 
      value={{ 
        settings, 
        updateSettings,
        convertDistance,
        convertTemperature,
        convertAltitude,
        formatDistance,
        formatTemperature,
        formatAltitude
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
