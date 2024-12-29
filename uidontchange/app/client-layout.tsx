'use client'

import Navigation from '@/components/navigation'
import { SettingsProvider } from '@/lib/settings-context'
import { PremiumProvider } from '@/lib/premium-context'
import { ShotCalcProvider } from '@/lib/shot-calc-context'
import { ClubSettingsProvider } from '@/lib/club-settings-context'
import { environmentalService } from '@/lib/environmental-service'
import { useEffect } from 'react'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    environmentalService.startMonitoring()
    return () => {
      environmentalService.stopMonitoring()
    }
  }, [])

  return (
    <PremiumProvider>
      <SettingsProvider>
        <ClubSettingsProvider>
          <ShotCalcProvider>
            <div className="pb-24">
              {children}
            </div>
            <Navigation />
          </ShotCalcProvider>
        </ClubSettingsProvider>
      </SettingsProvider>
    </PremiumProvider>
  )
} 