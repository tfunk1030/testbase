'use client'

import { DashboardGrid } from '@/components/dashboard/dashboard-grid'
import { WidgetManager } from '@/components/dashboard/widget-manager'
import { usePremium } from '@/lib/premium-context'
import { DashboardProvider } from '@/lib/dashboard-context'
import { WidgetConfigProvider, useWidgetConfig } from '@/lib/widget-config-context'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

function DashboardContent() {
  const { resetToDefaults } = useWidgetConfig()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleReset = () => {
    resetToDefaults()
    window.location.reload()
  }

  return (
    <DashboardProvider>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button 
            onClick={handleReset}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm"
          >
            Reset Widgets
          </button>
        </div>
        <DashboardGrid />
        <WidgetManager />
      </div>
      {mounted && createPortal(<div id="widget-config-modal" />, document.body)}
    </DashboardProvider>
  )
}

export default function DashboardPage() {
  const { isPremium } = usePremium()
  const router = useRouter()

  useEffect(() => {
    if (!isPremium) {
      router.push('/')
    }
  }, [isPremium, router])

  if (!isPremium) {
    return null
  }

  return (
    <WidgetConfigProvider>
      <DashboardContent />
    </WidgetConfigProvider>
  )
}
