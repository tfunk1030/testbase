'use client'

import React from 'react'
import { usePremium } from '@/lib/premium-context'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'

export function UpgradeModal() {
  const { showUpgradeModal, setShowUpgradeModal } = usePremium()

  if (!showUpgradeModal) return null

  return (
    <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-500">
            Get access to advanced features and analytics with our premium plan.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium">Premium Features:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>Advanced shot analysis</li>
              <li>Club comparison tools</li>
              <li>Detailed statistics</li>
              <li>Custom club settings</li>
              <li>Shot pattern visualization</li>
            </ul>
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>
              Maybe Later
            </Button>
            <Button onClick={() => window.open('https://example.com/upgrade', '_blank')}>
              Upgrade Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
