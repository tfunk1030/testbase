'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { WIDGET_SIZES } from './widget-sizes'

export interface Widget {
  id: string
  type: string
  position: { x: number; y: number }
  size: { width: number; height: number }
}

interface Layout {
  id: string
  name: string
  widgets: Widget[]
}

interface DashboardContextType {
  layouts: Layout[]
  activeLayout: Layout | null
  addWidget: (layoutId: string, widget: Omit<Widget, 'id'>) => void
  removeWidget: (layoutId: string, widgetId: string) => void
  updateWidget: (layoutId: string, widgetId: string, updates: Partial<Widget>) => void
  setActiveLayout: (layoutId: string) => void
}

const DashboardContext = createContext<DashboardContextType | null>(null)

const DEFAULT_LAYOUT: Layout = {
  id: 'default',
  name: 'Default Layout',
  widgets: [
    {
      id: 'wind-1',
      type: 'wind',
      position: { x: 0, y: 0 },
      size: WIDGET_SIZES.small // 6x3
    },
    {
      id: 'compass-1',
      type: 'compass',
      position: { x: 6, y: 0 },
      size: WIDGET_SIZES.small // 6x3
    },
    {
      id: 'env-1',
      type: 'environmental',
      position: { x: 0, y: 3 },
      size: WIDGET_SIZES.wide // 12x3
    },
    {
      id: 'round-tracker-1',
      type: 'round-tracker',
      position: { x: 0, y: 6 },
      size: WIDGET_SIZES.large // 12x6
    }
  ]
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [layouts, setLayouts] = useState<Layout[]>([DEFAULT_LAYOUT])
  const [activeLayout, setActiveLayout] = useState<Layout>(DEFAULT_LAYOUT)

  const addWidget = useCallback((layoutId: string, widget: Omit<Widget, 'id'>) => {
    const newWidget = {
      ...widget,
      id: `${widget.type}-${Date.now()}`
    }

    setLayouts(prevLayouts => {
      const newLayouts = prevLayouts.map(layout => {
        if (layout.id !== layoutId) return layout
        return {
          ...layout,
          widgets: [...layout.widgets, newWidget]
        }
      })
      return newLayouts
    })

    setActiveLayout(prev => {
      if (prev.id !== layoutId) return prev
      return {
        ...prev,
        widgets: [...prev.widgets, newWidget]
      }
    })
  }, [])

  const removeWidget = useCallback((layoutId: string, widgetId: string) => {
    setLayouts(prevLayouts => {
      const newLayouts = prevLayouts.map(layout => {
        if (layout.id !== layoutId) return layout
        return {
          ...layout,
          widgets: layout.widgets.filter(w => w.id !== widgetId)
        }
      })
      return newLayouts
    })

    setActiveLayout(prev => {
      if (prev.id !== layoutId) return prev
      return {
        ...prev,
        widgets: prev.widgets.filter(w => w.id !== widgetId)
      }
    })
  }, [])

  const updateWidget = useCallback((layoutId: string, widgetId: string, updates: Partial<Widget>) => {
    setLayouts(prevLayouts => {
      const newLayouts = prevLayouts.map(layout => {
        if (layout.id !== layoutId) return layout
        return {
          ...layout,
          widgets: layout.widgets.map(widget => {
            if (widget.id !== widgetId) return widget
            return { ...widget, ...updates }
          })
        }
      })
      return newLayouts
    })

    setActiveLayout(prev => {
      if (prev.id !== layoutId) return prev
      return {
        ...prev,
        widgets: prev.widgets.map(widget => {
          if (widget.id !== widgetId) return widget
          return { ...widget, ...updates }
        })
      }
    })
  }, [])

  const setActiveLayoutById = useCallback((layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId)
    if (layout) {
      setActiveLayout(layout)
    }
  }, [layouts])

  const value = {
    layouts,
    activeLayout,
    addWidget,
    removeWidget,
    updateWidget,
    setActiveLayout: setActiveLayoutById
  }

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}
