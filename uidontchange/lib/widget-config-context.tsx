'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type WidgetVariable = {
  id: string
  name: string
  enabled: boolean
  order: number
}

export type WidgetConfig = {
  id: string
  variables: WidgetVariable[]
}

type WidgetConfigs = {
  [widgetId: string]: WidgetConfig
}

interface WidgetConfigContextType {
  configs: WidgetConfigs
  updateConfig: (widgetId: string, config: WidgetConfig) => void
  getConfig: (widgetId: string) => WidgetConfig | undefined
  resetToDefaults: () => void
}

const WidgetConfigContext = createContext<WidgetConfigContextType | null>(null)

const DEFAULT_CONFIGS: WidgetConfigs = {
  'wind-1': {
    id: 'wind-1',
    variables: [
      { id: 'speed', name: 'Wind Speed', enabled: true, order: 0 },
      { id: 'direction', name: 'Direction', enabled: true, order: 1 },
      { id: 'gusts', name: 'Gusts', enabled: false, order: 2 },
    ]
  },
  'env-1': {
    id: 'env-1',
    variables: [
      { id: 'temperature', name: 'Temperature', enabled: true, order: 0 },
      { id: 'humidity', name: 'Humidity', enabled: true, order: 1 },
      { id: 'pressure', name: 'Pressure', enabled: true, order: 2 },
      { id: 'altitude', name: 'Altitude', enabled: true, order: 3 }
    ]
  },
  'compass-1': {
    id: 'compass-1',
    variables: [
      { id: 'bearing', name: 'Bearing', enabled: true, order: 0 },
      { id: 'cardinal', name: 'Cardinal Direction', enabled: true, order: 1 },
    ]
  },
  'round-1': {
    id: 'round-1',
    variables: [
      { id: 'score', name: 'Score', enabled: true, order: 0 },
      { id: 'putts', name: 'Putts', enabled: true, order: 1 },
      { id: 'fairwaysHit', name: 'Fairways Hit', enabled: true, order: 2 },
      { id: 'greensHit', name: 'Greens Hit', enabled: true, order: 3 }
    ]
  }
}

// Template configs for new widgets
const TEMPLATE_CONFIGS: { [type: string]: Omit<WidgetConfig, 'id'> } = {
  'wind': {
    variables: [
      { id: 'speed', name: 'Wind Speed', enabled: true, order: 0 },
      { id: 'direction', name: 'Direction', enabled: true, order: 1 },
      { id: 'gusts', name: 'Gusts', enabled: false, order: 2 },
    ]
  },
  'environmental': {
    variables: [
      { id: 'temperature', name: 'Temperature', enabled: true, order: 0 },
      { id: 'humidity', name: 'Humidity', enabled: true, order: 1 },
      { id: 'pressure', name: 'Pressure', enabled: true, order: 2 },
      { id: 'altitude', name: 'Altitude', enabled: true, order: 3 }
    ]
  },
  'compass': {
    variables: [
      { id: 'bearing', name: 'Bearing', enabled: true, order: 0 },
      { id: 'cardinal', name: 'Cardinal Direction', enabled: true, order: 1 },
    ]
  },
  'round': {
    variables: [
      { id: 'score', name: 'Score', enabled: true, order: 0 },
      { id: 'putts', name: 'Putts', enabled: true, order: 1 },
      { id: 'fairwaysHit', name: 'Fairways Hit', enabled: true, order: 2 },
      { id: 'greensHit', name: 'Greens Hit', enabled: true, order: 3 }
    ]
  }
}

const STORAGE_KEY = 'widget-configs'

export function WidgetConfigProvider({ children }: { children: React.ReactNode }) {
  const [configs, setConfigs] = useState<WidgetConfigs>(DEFAULT_CONFIGS)

  // Clear localStorage and reset to defaults on mount
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY)
    setConfigs(DEFAULT_CONFIGS)
  }, [])

  const updateConfig = useCallback((widgetId: string, config: WidgetConfig) => {
    setConfigs(prev => {
      const newConfigs = {
        ...prev,
        [widgetId]: config
      }
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfigs))
      return newConfigs
    })
  }, [])

  const getConfig = useCallback((widgetId: string) => {
    // First check if we have a config for this specific widget instance
    if (configs[widgetId]) {
      return configs[widgetId]
    }
    
    // If not, create a new config from the template
    const [type] = widgetId.split('-')
    const template = TEMPLATE_CONFIGS[type]
    if (template) {
      const newConfig = {
        id: widgetId,
        ...template
      }
      updateConfig(widgetId, newConfig)
      return newConfig
    }
    
    return undefined
  }, [configs, updateConfig])

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setConfigs(DEFAULT_CONFIGS)
  }, [])

  return (
    <WidgetConfigContext.Provider value={{ configs, updateConfig, getConfig, resetToDefaults }}>
      {children}
    </WidgetConfigContext.Provider>
  )
}

export function useWidgetConfig() {
  const context = useContext(WidgetConfigContext)
  if (!context) {
    throw new Error('useWidgetConfig must be used within a WidgetConfigProvider')
  }
  return context
}
