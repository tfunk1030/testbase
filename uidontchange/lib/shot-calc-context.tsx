'use client'

import React, { createContext, useContext, useState } from 'react'

interface ShotCalcData {
  targetYardage: number | null
  adjustedDistance: number | null
  elevation: number | null
  temperature: number | null
  humidity: number | null
  pressure: number | null
}

interface ShotCalcContextType {
  shotCalcData: ShotCalcData
  setShotCalcData: (data: Partial<ShotCalcData>) => void
}

const ShotCalcContext = createContext<ShotCalcContextType>({
  shotCalcData: {
    targetYardage: 150,
    adjustedDistance: 157, // Mock data: Playing 7 yards longer due to weather
    elevation: 1000,
    temperature: 85,
    humidity: 60,
    pressure: 29.5
  },
  setShotCalcData: () => {}
})

export function ShotCalcProvider({ children }: { children: React.ReactNode }) {
  const [shotCalcData, setShotCalcDataState] = useState<ShotCalcData>({
    targetYardage: 150,
    adjustedDistance: 157, // Mock data: Playing 7 yards longer due to weather
    elevation: 1000,
    temperature: 85,
    humidity: 60,
    pressure: 29.5
  })

  const setShotCalcData = (data: Partial<ShotCalcData>) => {
    setShotCalcDataState(prev => ({ ...prev, ...data }))
  }

  return (
    <ShotCalcContext.Provider value={{ shotCalcData, setShotCalcData }}>
      {children}
    </ShotCalcContext.Provider>
  )
}

export function useShotCalc() {
  const context = useContext(ShotCalcContext)
  if (!context) {
    throw new Error('useShotCalc must be used within a ShotCalcProvider')
  }
  return context
}
