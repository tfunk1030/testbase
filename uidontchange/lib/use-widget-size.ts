import { useContext } from 'react'
import { WidgetContext } from './widget-context'
import type { WidgetSize } from './widget-sizes'

export function useWidgetSize(): WidgetSize {
  const context = useContext(WidgetContext)
  if (!context) throw new Error('useWidgetSize must be used within a WidgetProvider')
  return context.size
}
