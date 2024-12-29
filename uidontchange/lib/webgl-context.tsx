'use client'

import React, { createContext, useContext, useRef, useEffect } from 'react'
import { WebGLRenderer } from 'three'

interface WebGLContextType {
  renderer: WebGLRenderer | null
}

const WebGLContext = createContext<WebGLContextType>({ renderer: null })

export function useWebGL() {
  return useContext(WebGLContext)
}

export function WebGLProvider({ children }: { children: React.ReactNode }) {
  const rendererRef = useRef<WebGLRenderer | null>(null)

  useEffect(() => {
    if (!rendererRef.current) {
      const renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      })

      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setClearColor(0x000000, 0)
      renderer.setSize(window.innerWidth, window.innerHeight)

      rendererRef.current = renderer
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [])

  return (
    <WebGLContext.Provider value={{ renderer: rendererRef.current }}>
      {children}
    </WebGLContext.Provider>
  )
}
