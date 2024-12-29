'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { useDashboard } from '@/lib/dashboard-context'
import { EnvironmentalConditionsWidget } from './widgets/environmental-conditions'
import { WindWidget } from './widgets/wind-widget'
import { RoundTrackerWidget } from './widgets/round-tracker'
import { CompassWidget } from './widgets/compass-widget'
import { WidgetSizeOverlay } from './widget-size-overlay'
import { X, GripVertical, Maximize } from 'lucide-react'
import { WIDGET_SIZES, type WidgetSize } from '@/lib/widget-sizes'
import { WidgetProvider } from '@/lib/widget-context'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

type WidgetType = 'environmental' | 'wind' | 'round-tracker' | 'compass';

const widgetComponents: Record<WidgetType, React.FC> = {
  'environmental': EnvironmentalConditionsWidget,
  'wind': WindWidget,
  'round-tracker': RoundTrackerWidget,
  'compass': CompassWidget,
}

const widgetTitles: Record<WidgetType, string> = {
  'environmental': 'Weather',
  'wind': 'Wind',
  'round-tracker': 'Round Tracker',
  'compass': 'Compass',
}

export function DashboardGrid() {
  const { activeLayout, updateWidget, removeWidget } = useDashboard()
  const [showSizeOverlay, setShowSizeOverlay] = useState<string | null>(null)

  useEffect(() => {
    // Listen for widget size update events
    const handleWidgetSizeUpdate = (event: CustomEvent) => {
      const { widgetId, size } = event.detail
      const widget = activeLayout?.widgets.find((w) => w.id === widgetId)
      if (widget && activeLayout) {
        updateWidget(activeLayout.id, widgetId, {
          position: widget.position,
          size: WIDGET_SIZES[size as WidgetSize]
        })
      }
    }

    window.addEventListener('update-widget-size', handleWidgetSizeUpdate as EventListener)
    return () => {
      window.removeEventListener('update-widget-size', handleWidgetSizeUpdate as EventListener)
    }
  }, [activeLayout, updateWidget])

  if (!activeLayout) return null

  const handleLayoutChange = (layout: any[]) => {
    layout.forEach((item) => {
      const widget = activeLayout.widgets.find((w) => w.id === item.i)
      if (widget) {
        updateWidget(activeLayout.id, widget.id, {
          position: { x: item.x, y: item.y },
          size: { width: item.w, height: item.h }
        })
      }
    })
  }

  const handleSizeSelect = (widgetId: string, size: WidgetSize) => {
    const widget = activeLayout.widgets.find((w) => w.id === widgetId)
    if (widget) {
      updateWidget(activeLayout.id, widgetId, {
        position: widget.position,
        size: WIDGET_SIZES[size]
      })
      setShowSizeOverlay(null)
    }
  }

  const handleCloseOverlay = useCallback(() => {
    setShowSizeOverlay(null)
  }, [])

  return (
    <div className="p-4">
      <ResponsiveGridLayout
        className="layout"
        layouts={{
          xxs: activeLayout.widgets.map((widget) => ({
            i: widget.id,
            x: widget.position.x,
            y: widget.position.y,
            w: widget.size.width,
            h: widget.size.height,
            isDraggable: true,
            isResizable: false,
          }))
        }}
        breakpoints={{ xxs: 0 }}
        cols={{ xxs: 12 }}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[16, 16]}
        onLayoutChange={handleLayoutChange}
        isDraggable={true}
        isResizable={false}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
      >
        {activeLayout.widgets.map((widget) => {
          const WidgetComponent = widgetComponents[widget.type as WidgetType]
          const title = widgetTitles[widget.type as WidgetType]

          return (
            <div
              key={widget.id}
              className="relative bg-gray-900 rounded-lg overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/20 to-transparent z-10">
                <div className="drag-handle cursor-move p-1">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-sm font-medium text-gray-200">{title}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowSizeOverlay(widget.id)}
                    className="p-1 text-gray-400 hover:text-gray-200"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeWidget(activeLayout.id, widget.id)}
                    className="p-1 text-gray-400 hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-12">
                <WidgetProvider 
                  size={
                    widget.size.width === 12 && widget.size.height === 6 
                      ? 'large' 
                      : widget.size.width === 12 
                        ? 'wide' 
                        : widget.size.height === 6 
                          ? 'tall' 
                          : 'small'
                  }
                >
                  <WidgetComponent />
                </WidgetProvider>
              </div>

              {showSizeOverlay === widget.id && (
                <WidgetSizeOverlay
                  widgetId={widget.id}
                  currentSize={widget.size}
                  onSizeSelect={(size) => handleSizeSelect(widget.id, size)}
                  onClose={handleCloseOverlay}
                />
              )}
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}
