'use client'

import { useState, useEffect } from 'react'

export interface HoleData {
  number: number
  par: 3 | 4 | 5
  score: number
  putts: number
  fairwayHit?: boolean  // undefined for par 3s
  greenHit: boolean
}

export interface RoundStats {
  totalScore: number
  scoreToPar: number
  totalPutts: number
  fairwaysHit: number
  fairwaysTotal: number  // excludes par 3s
  greensHit: number
  greensTotal: number
}

export function useRoundData() {
  const [holes, setHoles] = useState<HoleData[]>([])
  const [currentStats, setCurrentStats] = useState<RoundStats>({
    totalScore: 0,
    scoreToPar: 0,
    totalPutts: 0,
    fairwaysHit: 0,
    fairwaysTotal: 0,
    greensHit: 0,
    greensTotal: 0
  })

  // Update stats whenever holes change
  useEffect(() => {
    const stats = holes.reduce((acc, hole) => {
      acc.totalScore += hole.score
      acc.scoreToPar += hole.score - hole.par
      acc.totalPutts += hole.putts
      acc.greensHit += hole.greenHit ? 1 : 0
      acc.greensTotal += 1

      // Only count fairways for par 4s and 5s
      if (hole.par !== 3) {
        acc.fairwaysTotal += 1
        if (hole.fairwayHit) {
          acc.fairwaysHit += 1
        }
      }

      return acc
    }, {
      totalScore: 0,
      scoreToPar: 0,
      totalPutts: 0,
      fairwaysHit: 0,
      fairwaysTotal: 0,
      greensHit: 0,
      greensTotal: 0
    } as RoundStats)

    setCurrentStats(stats)
  }, [holes])

  const addHoleData = (data: Omit<HoleData, 'number'>) => {
    setHoles(prev => {
      const newHoles = [...prev]
      const holeNumber = newHoles.length + 1
      newHoles.push({
        ...data,
        number: holeNumber
      })
      return newHoles
    })
  }

  const updateHoleData = (holeNumber: number, data: Partial<HoleData>) => {
    setHoles(prev => {
      const newHoles = [...prev]
      const index = newHoles.findIndex(h => h.number === holeNumber)
      if (index !== -1) {
        newHoles[index] = {
          ...newHoles[index],
          ...data
        }
      }
      return newHoles
    })
  }

  const clearRound = () => {
    setHoles([])
  }

  return {
    holes,
    currentStats,
    addHoleData,
    updateHoleData,
    clearRound
  }
}
