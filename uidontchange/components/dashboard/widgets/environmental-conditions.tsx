'use client'

import React, { useState } from 'react'
import { useEnvironmental } from '@/lib/hooks/use-environmental'
import { useSettings } from '@/lib/settings-context'
import { useWidgetConfig } from '@/lib/widget-config-context'
import { useWidgetSize } from '@/lib/use-widget-size'
import { useDashboard } from '@/lib/dashboard-context'
import { Widget } from '@/lib/dashboard-context'
import { WIDGET_SIZES } from '@/lib/widget-sizes'
import { Settings2, Thermometer, Droplets, Mountain, Gauge } from 'lucide-react'
import { WidgetConfigModal } from '@/components/dashboard/widget-config-modal'

interface ConditionCardProps {
  id: string
  title: string
  icon: React.ReactNode
}

const ConditionCard: React.FC<ConditionCardProps> = ({ id, title, icon }) => {
  const { conditions } = useEnvironmental()
  const { formatTemperature, formatAltitude } = useSettings()

  if (!conditions) {
    return (
      <div className="flex flex-col h-full p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
          {title}
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">{icon}</div>
            <div className="font-medium text-base">--</div>
          </div>
        </div>
      </div>
    )
  }

  const getValue = () => {
    switch (id) {
      case 'temperature':
        return `${formatTemperature(Math.round(conditions.temperature * 10) / 10)}°`
      case 'humidity':
        return `${Math.round(conditions.humidity * 10) / 10}%`
      case 'pressure':
        return `${Math.round(conditions.pressure * 10) / 10} hPa`
      case 'altitude':
        return formatAltitude(Math.round(conditions.altitude))
      default:
        return '--'
    }
  }

  return (
    <div className="flex flex-col h-full p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
        {title}
      </div>
      <div className="flex items-center justify-center flex-1">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">{icon}</div>
          <div className="font-medium text-base">{getValue()}</div>
        </div>
      </div>
    </div>
  )
}

const SmallLayout = ({ enabledVariables }: { enabledVariables: any[] }) => (
  <div className="h-full">
    <div 
      className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {enabledVariables.map(variable => (
        <div key={variable.id} className="flex-none w-full h-full snap-center p-2">
          <ConditionCard
            id={variable.id}
            title={variable.name}
            icon={getVariableIcon(variable.id)}
          />
        </div>
      ))}
    </div>
    <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
      {enabledVariables.map((_, i) => (
        <div key={i} className="w-1 h-1 rounded-full bg-gray-500" />
      ))}
    </div>
  </div>
)

const WideLayout = ({ enabledVariables }: { enabledVariables: any[] }) => (
  <div className="h-full px-2">
    <div 
      className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {enabledVariables.map(variable => (
        <div key={variable.id} className="flex-none w-1/3 h-full snap-center overflow-hidden">
          <div className="h-full mx-1">
            <ConditionCard
              id={variable.id}
              title={variable.name}
              icon={getVariableIcon(variable.id)}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
)

const TallLayout = ({ enabledVariables }: { enabledVariables: any[] }) => (
  <div className="h-full">
    <div 
      className="flex flex-col h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {enabledVariables.map(variable => (
        <div key={variable.id} className="flex-none h-1/3 snap-center p-2">
          <ConditionCard
            id={variable.id}
            title={variable.name}
            icon={getVariableIcon(variable.id)}
          />
        </div>
      ))}
    </div>
  </div>
)

const LargeLayout = ({ enabledVariables }: { enabledVariables: any[] }) => (
  <div className="grid grid-cols-2 gap-4 p-4">
    {enabledVariables.map(variable => (
      <div key={variable.id} className="p-2">
        <ConditionCard
          id={variable.id}
          title={variable.name}
          icon={getVariableIcon(variable.id)}
        />
      </div>
    ))}
  </div>
)

const getVariableIcon = (id: string) => {
  switch (id) {
    case 'temperature':
      return <Thermometer className="w-5 h-5 text-red-500" />
    case 'humidity':
      return <Droplets className="w-5 h-5 text-blue-500" />
    case 'pressure':
      return <Gauge className="w-5 h-5 text-purple-500" />
    case 'altitude':
      return <Mountain className="w-5 h-5 text-green-500" />
    default:
      return null
  }
}

export function EnvironmentalConditionsWidget() {
  const size = useWidgetSize()
  const [showConfig, setShowConfig] = useState(false)
  const { getConfig } = useWidgetConfig()
  const { activeLayout } = useDashboard()
  
  // Find the widget ID from the active layout
  const envWidget = activeLayout?.widgets.find((w: Widget) => w.type === 'environmental')
  if (!envWidget) return null

  const config = getConfig(envWidget.id)
  if (!config) return null

  const enabledVariables = config.variables
    .filter(v => v.enabled)
    .sort((a, b) => a.order - b.order)

  const LayoutComponent = {
    small: SmallLayout,
    wide: WideLayout,
    tall: TallLayout,
    large: LargeLayout
  }[size]

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <LayoutComponent enabledVariables={enabledVariables} />
      </div>

      <div className="p-2">
        <button
          onClick={() => setShowConfig(true)}
          className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors text-gray-500 hover:text-gray-300 flex items-center gap-2 text-xs"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Configure Widget</span>
        </button>
      </div>

      {showConfig && (
        <WidgetConfigModal
          widgetId={envWidget.id}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
