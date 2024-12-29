'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { useWidgetConfig, type WidgetConfig, type WidgetVariable } from '@/lib/widget-config-context'
import { useDashboard } from '@/lib/dashboard-context'
import { WIDGET_SIZES, type WidgetSize } from '@/lib/widget-sizes'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, Maximize2, ArrowLeftRight, ArrowUpDown, Square } from 'lucide-react'

interface WidgetConfigModalProps {
  widgetId: string
  onClose: () => void
}

interface SortableItemProps {
  variable: WidgetVariable
}

function SortableItem({ variable }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: variable.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-move text-gray-400"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <label className="flex items-center flex-1">
        <input
          type="checkbox"
          checked={variable.enabled}
          onChange={() => {}} // Will be handled by parent
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="ml-2">{variable.name}</span>
      </label>
    </div>
  )
}

export function WidgetConfigModal({ widgetId, onClose }: WidgetConfigModalProps) {
  const { getConfig, updateConfig } = useWidgetConfig()
  const { activeLayout, updateWidget } = useDashboard()
  const config = getConfig(widgetId)
  const widget = activeLayout?.widgets.find(w => w.id === widgetId)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (!config || !widget || !activeLayout) return null

  const handleToggleVariable = (variableId: string) => {
    const newConfig: WidgetConfig = {
      ...config,
      variables: config.variables.map(v => 
        v.id === variableId ? { ...v, enabled: !v.enabled } : v
      )
    }
    updateConfig(widgetId, newConfig)
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const oldIndex = config.variables.findIndex(v => v.id === active.id)
      const newIndex = config.variables.findIndex(v => v.id === over.id)

      const newConfig: WidgetConfig = {
        ...config,
        variables: arrayMove(config.variables, oldIndex, newIndex).map(
          (v, index) => ({ ...v, order: index })
        )
      }
      updateConfig(widgetId, newConfig)
    }
  }

  const handleSizeChange = (size: WidgetSize) => {
    const newSize = WIDGET_SIZES[size]
    updateWidget(activeLayout.id, widgetId, {
      position: widget.position,
      size: newSize
    })
  }

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90%] max-h-[90%] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Widget Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Size Selection */}
          <div>
            <h3 className="text-sm font-medium mb-2">Widget Size</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSizeChange('small')}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  widget.size.width === WIDGET_SIZES.small.width && widget.size.height === WIDGET_SIZES.small.height
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Small Square</span>
              </button>
              <button
                onClick={() => handleSizeChange('wide')}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  widget.size.width === WIDGET_SIZES.wide.width && widget.size.height === WIDGET_SIZES.wide.height
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Wide Rectangle</span>
              </button>
              <button
                onClick={() => handleSizeChange('tall')}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  widget.size.width === WIDGET_SIZES.tall.width && widget.size.height === WIDGET_SIZES.tall.height
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>Tall Rectangle</span>
              </button>
              <button
                onClick={() => handleSizeChange('large')}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  widget.size.width === WIDGET_SIZES.large.width && widget.size.height === WIDGET_SIZES.large.height
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Maximize2 className="w-4 h-4" />
                <span>Large Square</span>
              </button>
            </div>
          </div>

          {/* Variable Configuration */}
          <div>
            <h3 className="text-sm font-medium mb-2">Widget Variables</h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={config.variables}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {config.variables.map(variable => (
                    <div
                      key={variable.id}
                      onClick={() => handleToggleVariable(variable.id)}
                    >
                      <SortableItem variable={variable} />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null

  return createPortal(modalContent, document.getElementById('widget-config-modal') || document.body)
}
