'use client'

import React, { createContext, useContext, useState } from 'react'

interface PremiumContextType {
  isPremium: boolean
  showUpgradeModal: boolean
  setShowUpgradeModal: (show: boolean) => void
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined)

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  // Temporarily set to true for development
  const [isPremium, setIsPremium] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        showUpgradeModal,
        setShowUpgradeModal
      }}
    >
      {children}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  const context = useContext(PremiumContext)
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider')
  }
  return context
}
