'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePremium } from '@/lib/premium-context'
import WindProfileVisualizer from '@/components/wind-profile-viz'

export default function WindProfilePage() {
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

  return <WindProfileVisualizer />
}
