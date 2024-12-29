'use client'

import React from 'react'
import { Plus, Wind, Thermometer, Timer, Compass } from 'lucide-react'
import { useDashboard } from '@/lib/dashboard-context'
import { DEFAULT_WIDGET_SIZES, WIDGET_SIZES } from '@/lib/widget-sizes'

const WIDGET_TYPES = [
  {
    id: 'wind',
    name: 'Wind',
    icon: Wind,
    defaultSize: WIDGET_SIZES[DEFAULT_WIDGET_SIZES.wind]
  },
  {
    id: 'environmental',
    name: 'Weather',
    icon: Thermometer,
    defaultSize: WIDGET_SIZES[DEFAULT_WIDGET_SIZES.environmental]
  },
  {
    id: 'compass',
    name: 'Compass',
    icon: Compass,
    defaultSize: WIDGET_SIZES[DEFAULT_WIDGET_SIZES.compass]
  },
  {
    id: 'round-tracker',
    name: 'Round Tracker',
    icon: Timer,
    defaultSize: WIDGET_SIZES[DEFAULT_WIDGET_SIZES['round-tracker']]
  }
] as const

export type WidgetType = typeof WIDGET_TYPES[number]['id']

export function WidgetManager() {
  const { activeLayout, addWidget } = useDashboard()
  const [isOpen, setIsOpen] = React.useState(false)

  const handleAddWidget = (type: WidgetType) => {
    if (!activeLayout) return

    const widgetConfig = WIDGET_TYPES.find(w => w.id === type)
    if (!widgetConfig) return

    addWidget(activeLayout.id, {
      type,
      position: { x: 0, y: 0 },
      size: widgetConfig.defaultSize
    })
    setIsOpen(false)
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <button
        className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg"
        aria-label="Add Widget"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 min-w-[200px]">
          {WIDGET_TYPES.map((widget) => (
            <button
              key={widget.id}
              className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              onClick={() => handleAddWidget(widget.id)}
            >
              <widget.icon className="w-5 h-5" />
              <span>{widget.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
