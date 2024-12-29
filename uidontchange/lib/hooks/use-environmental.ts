'use client'

import { useState, useEffect } from 'react'
import { environmentalService, EnvironmentalConditions } from '../environmental-service'

// Mock types for UI development
interface Adjustments {
  distanceAdjustment: number
  trajectoryShift: number
  spinAdjustment: number
  launchAngleAdjustment: number
}

export function useEnvironmental(shotDirection: number = 0) {
  const [conditions, setConditions] = useState<EnvironmentalConditions | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustments | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Subscribe to mock environmental updates
  useEffect(() => {
    const unsubscribe = environmentalService.subscribe((newConditions) => {
      setConditions(newConditions)
      setIsLoading(false)
    })

    environmentalService.startMonitoring()

    return () => {
      unsubscribe()
      environmentalService.stopMonitoring()
    }
  }, [])

  // Calculate mock adjustments
  useEffect(() => {
    async function updateAdjustments() {
      if (!conditions) return

      const windEffect = await environmentalService.calculateWindEffect(shotDirection)
      const altitudeEffect = await environmentalService.calculateAltitudeEffect()

      setAdjustments({
        distanceAdjustment: altitudeEffect + (windEffect.headwind * -1.5),
        trajectoryShift: windEffect.crosswind * 2,
        spinAdjustment: ((conditions.density / 1.225) - 1) * -50,
        launchAngleAdjustment: windEffect.headwind * 0.1
      })
    }

    updateAdjustments()
  }, [conditions, shotDirection])

  return {
    conditions,
    adjustments,
    isLoading
  }
}
