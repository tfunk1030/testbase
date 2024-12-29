'use client'

import React, { useState } from 'react'
import { Settings2, Navigation } from 'lucide-react'
import { useWidgetSize } from '@/lib/use-widget-size'
import { WIDGET_SIZES } from '@/lib/widget-sizes'
import { WidgetConfigModal } from '../widget-config-modal'
import { useWidgetConfig } from '@/lib/widget-config-context'
import { useDashboard } from '@/lib/dashboard-context'
import { Widget } from '@/lib/dashboard-context'

interface WindData {
  speed: number
  direction: string
  directionDegrees: number
  gusts: number
}

// Mock data - replace with real data later
const WIND_DATA: WindData = {
  speed: 12,
  direction: 'NW',
  directionDegrees: 315,
  gusts: 18
}

const SpeedDirectionCard = ({ data }: { data: WindData }) => (
  <div className="flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-lg h-full">
    <div className="text-3xl font-bold flex items-center gap-2">
      {data.speed}
      <span className="text-sm font-normal text-gray-400">MPH</span>
    </div>
    <div className="flex items-center gap-2 mt-2">
      <Navigation 
        className="w-5 h-5" 
        style={{ transform: `rotate(${data.directionDegrees}deg)` }}
      />
      <span className="text-xl">{data.direction}</span>
    </div>
  </div>
)

const DegreesCard = ({ data }: { data: WindData }) => (
  <div className="flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-lg h-full">
    <div className="text-sm text-gray-400">Direction</div>
    <div className="text-3xl font-bold mt-1">
      {data.directionDegrees}°
    </div>

    <Navigation 
      className="w-8 h-8 mt-2" 
      style={{ transform: `rotate(${data.directionDegrees}deg)` }}
    />
  </div>
)

const GustsCard = ({ data }: { data: WindData }) => (
  <div className="flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-lg h-full">
    <div className="text-sm text-gray-400">Wind Gusts</div>
    <div className="text-3xl font-bold mt-1 flex items-center gap-1">
      {data.gusts}
      <span className="text-sm font-normal text-gray-400">MPH</span>
    </div>
  </div>
)

const SmallLayout = ({ data }: { data: WindData }) => (
  <div className="h-full">
    <div 
      className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex-none w-full h-full snap-center p-2">
        <SpeedDirectionCard data={data} />
      </div>
      <div className="flex-none w-full h-full snap-center p-2">
        <DegreesCard data={data} />
      </div>
      <div className="flex-none w-full h-full snap-center p-2">
        <GustsCard data={data} />
      </div>
    </div>

    <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
      <div className="w-1 h-1 rounded-full bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-500" />
    </div>
  </div>
)

const WideLayout = ({ data }: { data: WindData }) => (
  <div className="h-full">
    <div 
      className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex-none w-1/3 h-full snap-center p-2">
        <SpeedDirectionCard data={data} />
      </div>
      <div className="flex-none w-1/3 h-full snap-center p-2">
        <DegreesCard data={data} />
      </div>
      <div className="flex-none w-1/3 h-full snap-center p-2">
        <GustsCard data={data} />
      </div>
    </div>
  </div>
)

const TallLayout = ({ data }: { data: WindData }) => (
  <div className="h-full">
    <div 
      className="flex flex-col h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex-none h-1/3 snap-center p-2">
        <SpeedDirectionCard data={data} />
      </div>
      <div className="flex-none h-1/3 snap-center p-2">
        <DegreesCard data={data} />
      </div>
      <div className="flex-none h-1/3 snap-center p-2">
        <GustsCard data={data} />
      </div>
    </div>
  </div>
)

const LargeLayout = ({ data }: { data: WindData }) => (
  <div className="grid grid-cols-2 gap-4 p-4 h-full">
    <SpeedDirectionCard data={data} />
    <DegreesCard data={data} />
    <GustsCard data={data} />
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-2">Wind Trend</h3>
      {/* Add wind trend graph here */}
    </div>
  </div>
)

export function WindWidget() {
  const size = useWidgetSize()
  const [showConfig, setShowConfig] = useState(false)
  const { getConfig } = useWidgetConfig()
  const { activeLayout } = useDashboard()
  
  // Find the widget ID from the active layout
  const windWidget = activeLayout?.widgets.find((w: Widget) => w.type === 'wind')
  if (!windWidget) return null

  const config = getConfig(windWidget.id)
  if (!config) return null

  const LayoutComponent = {
    small: SmallLayout,
    wide: WideLayout,
    tall: TallLayout,
    large: LargeLayout
  }[size]

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <LayoutComponent data={WIND_DATA} />
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
          widgetId={windWidget.id}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
