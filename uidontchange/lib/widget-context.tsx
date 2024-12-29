'use client'

import React, { createContext, useContext } from 'react'
import type { WidgetSize } from './widget-sizes'

interface WidgetContextType {
  size: WidgetSize
}

export const WidgetContext = createContext<WidgetContextType | null>(null)

interface WidgetProviderProps {
  size: WidgetSize
  children: React.ReactNode
}

export function WidgetProvider({ size, children }: WidgetProviderProps) {
  return (
    <WidgetContext.Provider value={{ size }}>
      {children}
    </WidgetContext.Provider>
  )
}
