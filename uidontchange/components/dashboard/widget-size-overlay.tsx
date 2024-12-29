'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { WIDGET_SIZES, type WidgetSize } from '@/lib/widget-sizes'
import { Square, ArrowLeftRight, ArrowUpDown, Maximize2 } from 'lucide-react'

interface WidgetSizeOverlayProps {
  widgetId: string
  currentSize: { width: number; height: number }
  onSizeSelect: (size: WidgetSize) => void
  onClose: () => void
}

export function WidgetSizeOverlay({ widgetId, currentSize, onSizeSelect, onClose }: WidgetSizeOverlayProps) {
  if (typeof window === 'undefined') return null

  const content = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div 
        className="grid grid-cols-2 gap-2 bg-gray-800 p-2 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onSizeSelect('small')}
          className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
            currentSize.width === WIDGET_SIZES.small.width && currentSize.height === WIDGET_SIZES.small.height
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Square className="w-5 h-5" />
        </button>
        <button
          onClick={() => onSizeSelect('wide')}
          className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
            currentSize.width === WIDGET_SIZES.wide.width && currentSize.height === WIDGET_SIZES.wide.height
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <ArrowLeftRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => onSizeSelect('tall')}
          className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
            currentSize.width === WIDGET_SIZES.tall.width && currentSize.height === WIDGET_SIZES.tall.height
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <ArrowUpDown className="w-5 h-5" />
        </button>
        <button
          onClick={() => onSizeSelect('large')}
          className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
            currentSize.width === WIDGET_SIZES.large.width && currentSize.height === WIDGET_SIZES.large.height
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
