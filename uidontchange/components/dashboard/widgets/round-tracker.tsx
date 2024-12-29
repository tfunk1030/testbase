'use client'

import React, { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { useWidgetSize } from '@/lib/use-widget-size'
import { useWidgetConfig } from '@/lib/widget-config-context'
import { useDashboard } from '@/lib/dashboard-context'
import { Widget } from '@/lib/dashboard-context'
import { WidgetConfigModal } from '../widget-config-modal'
import { useRoundData, type HoleData } from '@/lib/use-round-data'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

interface RoundStats {
  scoreToPar: number
  totalScore: number
  fairwaysHit: number
  fairwaysTotal: number
  greensHit: number
  greensTotal: number
  totalPutts: number
}

const StatsCard = ({ stats }: { stats: RoundStats }) => {
  const getScoreToPar = (score: number) => {
    if (score === 0) return 'E'
    return score > 0 ? `+${score}` : score.toString()
  }

  const getScoreColor = (score: number) => {
    if (score === 0) return 'text-emerald-500'
    if (score > 0) return 'text-black'
    return 'text-red-500'
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-between min-h-0 py-2">
        {/* Score to Par - Main Focus */}
        <div className="flex flex-col items-center justify-center py-4 bg-gray-900/50 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Score to Par</div>
          <div className={`text-4xl font-bold ${getScoreColor(stats.scoreToPar)}`}>
            {getScoreToPar(stats.scoreToPar)}
          </div>
        </div>

        {/* Other Stats - Grid Layout */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Total Score</div>
            <div className="text-2xl font-bold">{stats.totalScore}</div>
          </div>
          
          <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Total Putts</div>
            <div className="text-2xl font-bold">{stats.totalPutts}</div>
          </div>

          <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Fairway</div>
            <div className="text-2xl font-bold flex items-baseline">
              <span>{stats.fairwaysHit}</span>
              <span className="text-sm text-gray-400 ml-1">/ {stats.fairwaysTotal}</span>
            </div>
          </div>
          
          <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="text-sm text-gray-400">Green</div>
            <div className="text-2xl font-bold flex items-baseline">
              <span>{stats.greensHit}</span>
              <span className="text-sm text-gray-400 ml-1">/ {stats.greensTotal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const HoleInputCard = ({ onSubmit }: { onSubmit: (data: Omit<HoleData, 'number'>) => void }) => {
  const [par, setPar] = useState<3 | 4 | 5>(4)
  const [score, setScore] = useState(4)
  const [putts, setPutts] = useState(2)
  const [fairwayHit, setFairwayHit] = useState(false)
  const [greenHit, setGreenHit] = useState(false)

  const handleSubmit = () => {
    onSubmit({
      par,
      score,
      putts,
      fairwayHit: par === 3 ? undefined : fairwayHit,
      greenHit
    })

    // Reset form
    setPar(4)
    setScore(4)
    setPutts(2)
    setFairwayHit(false)
    setGreenHit(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-between min-h-0">
        <div className="space-y-3 overflow-y-auto flex-shrink py-2">
          <div>
            <label className="text-sm text-gray-400">Par</label>
            <div className="flex gap-2 mt-1">
              {[3, 4, 5].map((p) => (
                <button
                  key={p}
                  onClick={() => setPar(p as 3 | 4 | 5)}
                  className={`flex-1 py-1.5 rounded ${
                    par === p ? 'bg-emerald-500 text-white' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Score</label>
            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => setScore(Math.max(1, score - 1))}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded"
              >
                -
              </button>
              <div className="flex-1 py-1.5 bg-gray-700 rounded text-center">
                {score}
              </div>
              <button 
                onClick={() => setScore(score + 1)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Putts</label>
            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => setPutts(Math.max(0, putts - 1))}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded"
              >
                -
              </button>
              <div className="flex-1 py-1.5 bg-gray-700 rounded text-center">
                {putts}
              </div>
              <button 
                onClick={() => setPutts(putts + 1)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded"
              >
                +
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {par !== 3 && (
              <div className="bg-gray-900/50 p-2 rounded-lg flex flex-col items-center">
                <div className="text-sm text-gray-400">Fairway</div>
                <input
                  type="checkbox"
                  checked={fairwayHit}
                  onChange={(e) => setFairwayHit(e.target.checked)}
                  className="mt-1 rounded border-gray-600 h-5 w-5"
                />
              </div>
            )}
            
            <div className="bg-gray-900/50 p-2 rounded-lg flex flex-col items-center">
              <div className="text-sm text-gray-400">Green</div>
              <input
                type="checkbox"
                checked={greenHit}
                onChange={(e) => setGreenHit(e.target.checked)}
                className="mt-1 rounded border-gray-600 h-5 w-5"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-medium transition-colors flex-shrink-0"
        >
          Save Hole
        </button>
      </div>
    </div>
  )
}

const RoundTrackerContent = ({ stats, onSubmitHole }: { stats: RoundStats, onSubmitHole: (data: Omit<HoleData, 'number'>) => void }) => {
  const size = useWidgetSize()

  return (
    <div className="h-full bg-gray-800/50 rounded-lg">
      {size === 'wide' ? (
        <div className="h-full grid grid-cols-2">
          <div className="h-full p-3 border-r border-gray-700 overflow-hidden">
            <StatsCard stats={stats} />
          </div>
          <div className="h-full p-3 overflow-hidden">
            <HoleInputCard onSubmit={onSubmitHole} />
          </div>
        </div>
      ) : (
        <Swiper
          className="h-full"
          modules={[Navigation, Pagination]}
          pagination={{ clickable: true }}
          spaceBetween={0}
          slidesPerView={1}
        >
          <SwiperSlide className="h-full">
            <div className="h-full p-3">
              <StatsCard stats={stats} />
            </div>
          </SwiperSlide>
          <SwiperSlide className="h-full">
            <div className="h-full p-3">
              <HoleInputCard onSubmit={onSubmitHole} />
            </div>
          </SwiperSlide>
        </Swiper>
      )}
    </div>
  )
}

export function RoundTrackerWidget() {
  const size = useWidgetSize()
  const [showConfig, setShowConfig] = useState(false)
  const { getConfig } = useWidgetConfig()
  const { activeLayout } = useDashboard()
  const { currentStats, addHoleData } = useRoundData()
  
  // Find the widget ID from the active layout
  const roundWidget = activeLayout?.widgets.find((w: Widget) => w.type === 'round-tracker')
  if (!roundWidget) return null

  const config = getConfig(roundWidget.id)
  if (!config) return null

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <RoundTrackerContent stats={currentStats} onSubmitHole={addHoleData} />
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
          widgetId={roundWidget.id}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
