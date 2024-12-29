'use client'

import { useState } from 'react'
import { useClubSettings } from '@/lib/club-settings-context'
import { usePremium } from '@/lib/premium-context'
import { useSettings } from '@/lib/settings-context'
import { Plus, Edit2, Trash2, Lock, Ruler, Thermometer, Mountain } from 'lucide-react'

export default function SettingsPage() {
  const { clubs, addClub, updateClub, removeClub } = useClubSettings()
  const { isPremium, setShowUpgradeModal } = usePremium()
  const { settings, updateSettings, convertDistance } = useSettings()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newClub, setNewClub] = useState({ name: '', normalYardage: 0, loft: 0 })

  const handleSave = (index: number | null) => {
    if (index === null) {
      // Convert distance to yards for storage if needed
      const normalYardage = settings.distanceUnit === 'meters' 
        ? convertDistance(newClub.normalYardage, 'yards')
        : newClub.normalYardage

      addClub({ ...newClub, normalYardage })
      setNewClub({ name: '', normalYardage: 0, loft: 0 })
    } else {
      const normalYardage = settings.distanceUnit === 'meters'
        ? convertDistance(newClub.normalYardage, 'yards')
        : newClub.normalYardage

      updateClub(index, { ...newClub, normalYardage })
      setEditingIndex(null)
    }
  }

  const handleEdit = (index: number) => {
    const club = clubs[index]
    // Convert distance to current unit preference
    const normalYardage = settings.distanceUnit === 'meters'
      ? convertDistance(club.normalYardage, 'meters')
      : club.normalYardage

    setNewClub({ ...club, normalYardage })
    setEditingIndex(index)
  }

  const handleDelete = (index: number) => {
    removeClub(index)
    if (editingIndex === index) {
      setEditingIndex(null)
      setNewClub({ name: '', normalYardage: 0, loft: 0 })
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Unit Preferences */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Unit Preferences</h2>
        <div className="space-y-4">
          {/* Distance Unit */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Ruler className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm text-gray-400">Distance Unit</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ distanceUnit: 'yards' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.distanceUnit === 'yards'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Yards
              </button>
              <button
                onClick={() => updateSettings({ distanceUnit: 'meters' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.distanceUnit === 'meters'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Meters
              </button>
            </div>
          </div>

          {/* Temperature Unit */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Thermometer className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm text-gray-400">Temperature Unit</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ temperatureUnit: 'celsius' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.temperatureUnit === 'celsius'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Celsius
              </button>
              <button
                onClick={() => updateSettings({ temperatureUnit: 'fahrenheit' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.temperatureUnit === 'fahrenheit'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Fahrenheit
              </button>
            </div>
          </div>

          {/* Altitude Unit */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Mountain className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm text-gray-400">Altitude Unit</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ altitudeUnit: 'meters' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.altitudeUnit === 'meters'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Meters
              </button>
              <button
                onClick={() => updateSettings({ altitudeUnit: 'feet' })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.altitudeUnit === 'feet'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Feet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Club Management */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Club Management</h2>
        
        {/* Add/Edit Club Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Club Name</label>
            <input
              type="text"
              value={newClub.name}
              onChange={(e) => setNewClub({ ...newClub, name: e.target.value })}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
              placeholder="e.g., Driver"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Normal Distance ({settings.distanceUnit === 'yards' ? 'yards' : 'meters'})
            </label>
            <input
              type="number"
              value={newClub.normalYardage}
              onChange={(e) => setNewClub({ ...newClub, normalYardage: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
              placeholder={`e.g., ${settings.distanceUnit === 'yards' ? '250' : '230'}`}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Loft (degrees)</label>
            <input
              type="number"
              value={newClub.loft}
              onChange={(e) => setNewClub({ ...newClub, loft: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
              placeholder="e.g., 10.5"
            />
          </div>
          <button
            onClick={() => handleSave(editingIndex)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {editingIndex !== null ? 'Update Club' : 'Add Club'}
          </button>
          {editingIndex !== null && (
            <button
              onClick={() => {
                setEditingIndex(null)
                setNewClub({ name: '', normalYardage: 0, loft: 0 })
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Club List */}
        <div className="space-y-3">
          {clubs.map((club, index) => {
            // Convert distance to current unit preference for display
            const displayDistance = settings.distanceUnit === 'meters'
              ? convertDistance(club.normalYardage, 'meters')
              : club.normalYardage

            return (
              <div 
                key={index}
                className="bg-gray-700 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{club.name}</div>
                  <div className="text-sm text-gray-400">
                    {Math.round(displayDistance)} {settings.distanceUnit === 'yards' ? 'yds' : 'm'} • {club.loft}° loft
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(index)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Premium Features */}
      {!isPremium && (
        <div className="bg-gray-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Premium Features</h3>
          <p className="text-gray-400 mb-4">
            Upgrade to access advanced club insights, performance tracking, and more.
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Upgrade to Premium
          </button>
        </div>
      )}
    </div>
  )
}
