'use client'

import { useEffect, useRef } from 'react'

interface WindDirectionCompassProps {
  windDirection: number
  shotDirection: number
  size?: number
  onChange?: (type: 'wind' | 'shot', degrees: number) => void
  lockShot?: boolean
}

export default function WindDirectionCompass({ 
  windDirection, 
  shotDirection,
  size = 280,
  onChange,
  lockShot = false
}: WindDirectionCompassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, size, size)
    
    const center = size / 2
    const radius = (size / 2) * 0.8

    // Create outer glow
    const glowGradient = ctx.createRadialGradient(center, center, radius * 0.95, center, center, radius * 1.05)
    glowGradient.addColorStop(0, 'rgba(75, 85, 99, 0.4)')
    glowGradient.addColorStop(1, 'rgba(75, 85, 99, 0)')

    ctx.beginPath()
    ctx.arc(center, center, radius * 1.05, 0, Math.PI * 2)
    ctx.fillStyle = glowGradient
    ctx.fill()

    // Draw main circle with gradient
    const circleGradient = ctx.createRadialGradient(center, center, radius * 0.7, center, center, radius)
    circleGradient.addColorStop(0, 'rgba(31, 41, 55, 0.4)')
    circleGradient.addColorStop(1, 'rgba(17, 24, 39, 0.4)')

    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fillStyle = circleGradient
    ctx.fill()
    ctx.strokeStyle = '#4B5563'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw concentric rings
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(center, center, radius * (0.25 * i), 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)'
      ctx.stroke()
    }

    // Draw shot direction
    const shotRad = (shotDirection - 90) * Math.PI / 180

    // Draw shot direction glow
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.lineTo(
      center + Math.cos(shotRad) * radius,
      center + Math.sin(shotRad) * radius
    )
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)'
    ctx.lineWidth = 8
    ctx.stroke()

    // Draw shot direction line
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.lineTo(
      center + Math.cos(shotRad) * radius,
      center + Math.sin(shotRad) * radius
    )
    
    const shotGradient = ctx.createLinearGradient(
      center, center,
      center + Math.cos(shotRad) * radius,
      center + Math.sin(shotRad) * radius
    )
    shotGradient.addColorStop(0, '#065f46')
    shotGradient.addColorStop(1, '#10B981')
    
    ctx.strokeStyle = shotGradient
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw shot arrow head
    const shotArrowSize = 15
    const arrowX = center + Math.cos(shotRad) * radius
    const arrowY = center + Math.sin(shotRad) * radius
    
    ctx.beginPath()
    ctx.moveTo(
      arrowX - Math.cos(shotRad - Math.PI/6) * shotArrowSize,
      arrowY - Math.sin(shotRad - Math.PI/6) * shotArrowSize
    )
    ctx.lineTo(arrowX, arrowY)
    ctx.lineTo(
      arrowX - Math.cos(shotRad + Math.PI/6) * shotArrowSize,
      arrowY - Math.sin(shotRad + Math.PI/6) * shotArrowSize
    )
    ctx.fillStyle = '#10B981'
    ctx.fill()

    // Draw wind direction
    const windRad = (windDirection - 90) * Math.PI / 180
    const windStartX = center + Math.cos(windRad) * radius
    const windStartY = center + Math.sin(windRad) * radius

    // Draw animated wind particles
    const numParticles = 12
    const particleSpacing = radius / numParticles
    for (let i = 0; i < numParticles; i++) {
      const distance = i * particleSpacing
      const x = windStartX - Math.cos(windRad) * distance
      const y = windStartY - Math.sin(windRad) * distance
      const particleSize = 3 + (i / numParticles) * 6

      ctx.beginPath()
      ctx.arc(x, y, particleSize, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(59, 130, 246, ${0.2 + (i / numParticles) * 0.8})`
      ctx.fill()
    }

    // Draw wind line glow
    ctx.beginPath()
    ctx.moveTo(windStartX, windStartY)
    ctx.lineTo(center, center)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
    ctx.lineWidth = 12
    ctx.stroke()

    // Draw wind line
    ctx.beginPath()
    ctx.moveTo(windStartX, windStartY)
    ctx.lineTo(center, center)
    
    const windGradient = ctx.createLinearGradient(
      windStartX, windStartY,
      center, center
    )
    windGradient.addColorStop(0, '#3B82F6')
    windGradient.addColorStop(1, '#1e40af')
    
    ctx.strokeStyle = windGradient
    ctx.lineWidth = 4
    ctx.stroke()

    // Draw multiple arrow indicators around edge
    const numArrows = 5
    const arrowSpacing = Math.PI / 8
    
    for (let i = -Math.floor(numArrows/2); i <= Math.floor(numArrows/2); i++) {
      const angleOffset = i * arrowSpacing
      const arrowLength = 25
      const arrowWidth = 12
      
      const arrowBaseX = windStartX + Math.cos(windRad + angleOffset) * 15
      const arrowBaseY = windStartY + Math.sin(windRad + angleOffset) * 15
      
      ctx.beginPath()
      // Arrow point
      ctx.moveTo(
        arrowBaseX - Math.cos(windRad) * arrowLength,
        arrowBaseY - Math.sin(windRad) * arrowLength
      )
      // Arrow base right
      ctx.lineTo(
        arrowBaseX + Math.cos(windRad + Math.PI/2) * arrowWidth,
        arrowBaseY + Math.sin(windRad + Math.PI/2) * arrowWidth
      )
      // Arrow base left
      ctx.lineTo(
        arrowBaseX + Math.cos(windRad - Math.PI/2) * arrowWidth,
        arrowBaseY + Math.sin(windRad - Math.PI/2) * arrowWidth
      )
      ctx.closePath()
      
      const arrowGradient = ctx.createLinearGradient(
        arrowBaseX, arrowBaseY,
        arrowBaseX - Math.cos(windRad) * arrowLength,
        arrowBaseY - Math.sin(windRad) * arrowLength
      )
      arrowGradient.addColorStop(0, '#3B82F6')
      arrowGradient.addColorStop(1, '#1e40af')
      
      ctx.fillStyle = arrowGradient
      ctx.fill()
    }

  }, [windDirection, shotDirection, size])

  const updateAngle = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || !onChange) return

    const rect = canvas.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = clientX - centerX
    const dy = clientY - centerY
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90
    if (angle < 0) angle += 360

    onChange('wind', Math.round(angle % 360))
  }

  const handleStart = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    if (e.touches[0]) {
      updateAngle(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleMove = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDraggingRef.current) return
    if (e.touches[0]) {
      updateAngle(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = false
  }

  return (
    <div 
      className="relative touch-none select-none"
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        style={{ 
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none'
        }}
      />
    </div>
  )
}
