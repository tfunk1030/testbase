import { useEffect, useState } from 'react'

interface Shot {
  id: string
  club: string
  distance: number
  accuracy: number // Deviation from target line in yards
  height: number
  spin: number
  date: Date
}

// Generate some realistic test data
function generateTestShots(): Shot[] {
  const clubs = ['Driver', '3-Wood', '5-Iron', '7-Iron', 'PW']
  const shots: Shot[] = []

  clubs.forEach(club => {
    // Base statistics for each club
    let baseStats = {
      Driver: { distance: 280, spread: 20 },
      '3-Wood': { distance: 250, spread: 15 },
      '5-Iron': { distance: 200, spread: 12 },
      '7-Iron': { distance: 170, spread: 10 },
      'PW': { distance: 130, spread: 8 }
    }[club]

    if (!baseStats) return

    // Generate 20 shots for each club
    for (let i = 0; i < 20; i++) {
      // Add some random variation to distance and accuracy
      const distanceVariation = (Math.random() - 0.5) * 20
      const accuracyVariation = (Math.random() - 0.5) * baseStats.spread * 2

      shots.push({
        id: `${club}-${i}`,
        club,
        distance: baseStats.distance + distanceVariation,
        accuracy: accuracyVariation,
        height: 30 + Math.random() * 10,
        spin: 2500 + Math.random() * 500,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date in last 30 days
      })
    }
  })

  // Sort by date
  return shots.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function useShots() {
  const [shots, setShots] = useState<Shot[]>([])

  useEffect(() => {
    // In a real app, this would fetch from an API
    setShots(generateTestShots())
  }, [])

  return { shots }
}
