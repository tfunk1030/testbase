'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface ClubData {
  name: string
  normalYardage: number
  loft: number
}

interface ClubSettingsContextType {
  clubs: ClubData[]
  addClub: (club: ClubData) => void
  updateClub: (index: number, club: ClubData) => void
  removeClub: (index: number) => void
  getRecommendedClub: (targetYardage: number) => ClubData | null
}

interface ClubSettings {
  units: 'yards' | 'meters'
  showTrajectory: boolean
  showSpinRate: boolean
  showLaunchAngle: boolean
}

const defaultClubs: ClubData[] = [
  { name: 'Driver', normalYardage: 295, loft: 10.5 },
  { name: '3W', normalYardage: 260, loft: 15 },
  { name: '5W', normalYardage: 240, loft: 18 },
  { name: '4i', normalYardage: 220, loft: 21 },
  { name: '5i', normalYardage: 205, loft: 24 },
  { name: '6i', normalYardage: 190, loft: 27 },
  { name: '7i', normalYardage: 178, loft: 31 },
  { name: '8i', normalYardage: 165, loft: 35 },
  { name: '9i', normalYardage: 152, loft: 39 },
  { name: 'PW', normalYardage: 138, loft: 43 },
  { name: 'GW', normalYardage: 126, loft: 48 },
  { name: 'SW', normalYardage: 114, loft: 54 },
  { name: 'LW', normalYardage: 95, loft: 58 },
]

const defaultSettings: ClubSettings = {
  units: 'yards',
  showTrajectory: true,
  showSpinRate: true,
  showLaunchAngle: true,
}

const ClubSettingsContext = createContext<ClubSettingsContextType | undefined>(undefined)
const SettingsContext = createContext<{ settings: ClubSettings; updateSettings: (settings: Partial<ClubSettings>) => void } | undefined>(undefined)

export function ClubSettingsProvider({ children }: { children: React.ReactNode }) {
  const [clubs, setClubs] = useState<ClubData[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clubSettings')
      return saved ? JSON.parse(saved) : defaultClubs
    }
    return defaultClubs
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clubSettings', JSON.stringify(clubs))
    }
  }, [clubs])

  const addClub = (club: ClubData) => {
    setClubs(prev => [...prev, club])
  }

  const updateClub = (index: number, club: ClubData) => {
    setClubs(prev => {
      const newClubs = [...prev]
      newClubs[index] = club
      return newClubs
    })
  }

  const removeClub = (index: number) => {
    setClubs(prev => prev.filter((_, i) => i !== index))
  }

  const getRecommendedClub = (targetYardage: number): ClubData | null => {
    const sortedClubs = [...clubs].sort((a, b) => {
      return Math.abs(a.normalYardage - targetYardage) - Math.abs(b.normalYardage - targetYardage)
    })
    return sortedClubs[0] || null
  }

  const [settings, setSettings] = useState<ClubSettings>(defaultSettings)

  const updateSettings = (newSettings: Partial<ClubSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  return (
    <ClubSettingsContext.Provider
      value={{
        clubs,
        addClub,
        updateClub,
        removeClub,
        getRecommendedClub
      }}
    >
      <SettingsContext.Provider value={{ settings, updateSettings }}>
        {children}
      </SettingsContext.Provider>
    </ClubSettingsContext.Provider>
  )
}

export function useClubSettings() {
  const context = useContext(ClubSettingsContext)
  if (!context) {
    throw new Error('useClubSettings must be used within a ClubSettingsProvider')
  }
  return context
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a ClubSettingsProvider')
  }
  return context
}

export function formatDistance(distance: number, units: 'yards' | 'meters' = 'yards'): string {
  if (units === 'meters') {
    return `${Math.round(distance * 0.9144)}m`
  }
  return `${Math.round(distance)}y`
}
