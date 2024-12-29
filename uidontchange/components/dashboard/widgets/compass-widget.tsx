'use client'

import React, { useState, useEffect } from 'react'
import { Settings2, Compass } from 'lucide-react'
import { WidgetConfigModal } from '@/components/dashboard/widget-config-modal'
import { useWidgetSize } from '@/lib/use-widget-size'
import { useWidgetConfig } from '@/lib/widget-config-context'
import { useDashboard } from '@/lib/dashboard-context'

function getCardinalDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(degrees / 45) % 8
  return directions[index]
}

// Extend DeviceOrientationEvent for iOS webkit properties
interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

const SmallLayout = ({ bearing }: { bearing: number }) => (
  <div className="relative flex flex-col h-full">
    <div className="flex-1 p-4 flex flex-col items-center justify-center">
      <div className="relative w-32 h-32">
        {/* Compass Rose Background */}
        <div className="absolute inset-0 bg-gray-800/50 border-2 border-gray-700 rounded-full">
          {/* Cardinal Points */}
          {['N', 'E', 'S', 'W'].map((point, i) => (
            <div
              key={point}
              className="absolute text-sm font-semibold"
              style={{
                top: point === 'N' ? '5%' : point === 'S' ? '85%' : '45%',
                left: point === 'W' ? '5%' : point === 'E' ? '85%' : '45%',
                color: point === 'N' ? 'rgb(34 197 94)' : 'rgb(156 163 175)'
              }}
            >
              {point}
            </div>
          ))}
        </div>
        
        {/* Rotating Compass Needle */}
        <div
          className="absolute inset-0 transition-transform duration-200"
          style={{ transform: `rotate(${bearing}deg)` }}
        >
          <div className="absolute w-1 h-16 bg-gradient-to-b from-red-500 to-white left-1/2 -translate-x-1/2" />
        </div>
      </div>

      {/* Bearing Display */}
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold">
          {getCardinalDirection(bearing)}
        </div>
        <div className="text-gray-400 text-sm">
          {Math.round(bearing)}°
        </div>
      </div>
    </div>
  </div>
)

const WideLayout = ({ bearing }: { bearing: number }) => {
  return (
    <div className="relative h-full flex flex-col items-center justify-center overflow-hidden p-4">
      {/* Compass strip container */}
      <div className="relative w-full h-40 bg-gray-800/50 border-y-2 border-gray-700">
        {/* Red lubber line with degree reading */}
        <div className="absolute left-1/2 -translate-x-1/2 h-full z-20 flex flex-col items-center">
          <div className="w-1 h-full bg-red-500" />
          <div className="absolute bottom-1 bg-gray-900/90 px-2 py-1 rounded text-sm font-bold">
            {Math.round(bearing)}°
          </div>
        </div>
        
        {/* Scrolling compass strip */}
        <div 
          className="absolute top-0 h-full transition-transform duration-200"
          style={{ 
            transform: `translateX(calc(50% - ${bearing * 2}px))`,
            width: '720px' // 360 * 2px per degree
          }}
        >
          {/* Cardinal and ordinal directions */}
          {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir, i) => {
            const deg = i * 45;
            return (
              <div 
                key={dir}
                className="absolute top-0 flex flex-col items-center justify-center h-full"
                style={{ left: `${deg * 2}px` }}
              >
                <span className={`text-2xl font-bold ${dir === 'N' ? 'text-green-500' : 'text-gray-300'}`}>
                  {dir}
                </span>
              </div>
            )
          })}

          {/* Degree marks every 15 degrees */}
          {Array.from({ length: 24 }).map((_, i) => {
            const deg = i * 15;
            if (deg % 45 !== 0) { // Skip degrees where we have cardinal directions
              return (
                <div 
                  key={deg}
                  className="absolute top-0 flex flex-col items-center justify-center h-full"
                  style={{ left: `${deg * 2}px` }}
                >
                  <span className="text-xl font-bold text-gray-500">
                    {deg}°
                  </span>
                </div>
              )
            }
          })}
        </div>

        {/* Gradient overlays for fade effect */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-gray-900 to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-gray-900 to-transparent z-10" />
      </div>

      {/* Current heading display */}
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold">{Math.round(bearing)}°</div>
        <div className="text-gray-400">{getCardinalDirection(bearing)}</div>
      </div>
    </div>
  )
}

const TallLayout = ({ bearing }: { bearing: number }) => (
  <SmallLayout bearing={bearing} />
)

const LargeLayout = ({ bearing }: { bearing: number }) => (
  <WideLayout bearing={bearing} />
)

export function CompassWidget() {
  const size = useWidgetSize()
  const { getConfig } = useWidgetConfig()
  const { activeLayout } = useDashboard()
  const [showConfig, setShowConfig] = useState(false)
  const [bearing, setBearing] = useState(0)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  // Find the widget ID from the active layout
  const compassWidget = activeLayout?.widgets.find((w: any) => w.type === 'compass')
  if (!compassWidget) return null

  const config = getConfig(compassWidget.id)
  if (!config) return null

  useEffect(() => {
    // Request device orientation permission
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          setHasPermission(permissionState === 'granted')
        })
        .catch(() => {
          setHasPermission(false)
        })
    } else {
      setHasPermission(true)
    }
  }, [])

  useEffect(() => {
    if (!hasPermission) return

    const handleOrientation = (event: DeviceOrientationEventWithWebkit) => {
      if (event.webkitCompassHeading !== undefined) {
        // iOS devices
        setBearing(event.webkitCompassHeading)
      } else if (event.alpha) {
        // Android devices
        setBearing(360 - event.alpha)
      }
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [hasPermission])

  const LayoutComponent = {
    small: SmallLayout,
    wide: WideLayout,
    tall: TallLayout,
    large: LargeLayout
  }[size] || SmallLayout

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <LayoutComponent bearing={bearing} />
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
          widgetId={compassWidget.id}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
