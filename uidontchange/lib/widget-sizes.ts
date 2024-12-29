export type WidgetSize = 'small' | 'wide' | 'tall' | 'large'

export interface WidgetDimensions {
  width: number
  height: number
}

export const WIDGET_SIZES: Record<WidgetSize, WidgetDimensions> = {
  small: { width: 6, height: 3 },     // 1/2 width, compact height for phone
  wide: { width: 12, height: 3 },     // Full width, same height as small
  tall: { width: 6, height: 6 },      // Same width as small, double height
  large: { width: 12, height: 6 }     // Full width, double height
}

// Default sizes for each widget type
export const DEFAULT_WIDGET_SIZES: Record<string, WidgetSize> = {
  wind: 'small',
  environmental: 'wide',
  compass: 'small',
  'round-tracker': 'large'  // Changed from 'wide' to 'large'
}
