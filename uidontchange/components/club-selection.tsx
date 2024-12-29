'use client'

import React, { useState } from 'react'

export default function ClubSelection() {
  const [selectedClub, setSelectedClub] = useState('7-Iron')

  const clubs = [
    { name: 'Driver', distance: '250-280', loft: '9-10.5°' },
    { name: '3-Wood', distance: '220-240', loft: '15°' },
    { name: '5-Wood', distance: '200-220', loft: '18°' },
    { name: '4-Iron', distance: '190-210', loft: '21°' },
    { name: '5-Iron', distance: '180-200', loft: '24°' },
    { name: '6-Iron', distance: '170-190', loft: '27°' },
    { name: '7-Iron', distance: '160-180', loft: '31°' },
    { name: '8-Iron', distance: '150-170', loft: '35°' },
    { name: '9-Iron', distance: '140-160', loft: '39°' },
    { name: 'PW', distance: '130-150', loft: '43°' },
    { name: 'GW', distance: '120-140', loft: '48°' },
    { name: 'SW', distance: '110-130', loft: '54°' },
    { name: 'LW', distance: '100-120', loft: '58°' }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h2 className="text-base font-semibold text-white">Club Selection</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-3 space-y-3">
        {/* Selected Club Details */}
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="text-2xl font-bold text-emerald-400">{selectedClub}</div>
            <div className="text-sm text-gray-400">
              {clubs.find(c => c.name === selectedClub)?.loft}
            </div>
          </div>
          <div className="text-3xl font-bold mb-2">
            {clubs.find(c => c.name === selectedClub)?.distance}
            <span className="text-sm ml-1 text-gray-400">yards</span>
          </div>
        </div>

        {/* Club List */}
        <div className="flex-1 bg-gray-800 rounded-xl p-2 shadow-lg overflow-hidden">
          <div className="h-full overflow-y-auto overscroll-contain pb-safe">
            <div className="grid grid-cols-1 gap-2">
              {clubs.map((club) => (
                <button
                  key={club.name}
                  onClick={() => setSelectedClub(club.name)}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    selectedClub === club.name
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-700/50 text-gray-300 active:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      selectedClub === club.name
                        ? 'bg-emerald-400/20'
                        : 'bg-gray-600/50'
                    }`}>
                      <span className="text-sm">{club.name}</span>
                    </div>
                    <div className="text-sm font-medium">{club.distance} yards</div>
                  </div>
                  <div className="text-xs">{club.loft}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
