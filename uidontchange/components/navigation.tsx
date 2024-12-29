'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePremium } from '@/lib/premium-context'
import { 
  Wind, 
  Target, 
  BarChart2, 
  Cloud,
  Menu,
  X,
  Settings,
  Lock
} from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isPremium, setShowUpgradeModal } = usePremium()

  const freeRoutes = [
    { path: '/', label: 'Weather', icon: <Cloud className="w-5 h-5" /> },
    { path: '/shot-calculator', label: 'Shot Calc', icon: <Target className="w-5 h-5" /> },
    { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ]

  const premiumRoutes = [
    { path: '/dashboard', label: 'Dashboard', icon: <BarChart2 className="w-5 h-5" /> },
    { path: '/wind-calc', label: 'Wind Calc', icon: <Wind className="w-5 h-5" /> },
  ]

  const handlePremiumClick = (e: React.MouseEvent, path: string) => {
    if (!isPremium) {
      e.preventDefault()
      setShowUpgradeModal(true)
    }
  }

  return (
    <>
      {/* Full Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40 ${
          isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Slide-out Menu */}
      <div 
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 p-4 transform transition-transform z-50 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center mb-8">
          <div className="text-2xl font-bold text-blue-400">LastShot</div>
          <button 
            onClick={() => setIsMenuOpen(false)}
            className="p-1 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        
        <nav className="space-y-6">
          {/* Free Features */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Free Features</div>
            <div className="space-y-1">
              {freeRoutes.map((route) => (
                <Link
                  key={route.path}
                  href={route.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === route.path 
                      ? 'bg-gray-800 text-blue-400' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {route.icon}
                  <span>{route.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Premium Features */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Premium Features</div>
            <div className="space-y-1">
              {premiumRoutes.map((route) => (
                <Link
                  key={route.path}
                  href={isPremium ? route.path : '#'}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === route.path 
                      ? 'bg-gray-800 text-blue-400' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                  onClick={(e) => {
                    handlePremiumClick(e, route.path)
                    setIsMenuOpen(false)
                  }}
                >
                  {route.icon}
                  <span>{route.label}</span>
                  {!isPremium && <Lock className="w-4 h-4 ml-auto" />}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-40">
        <div className="flex justify-around items-center px-2 py-2">
          {/* Menu Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center px-3 py-2 text-gray-400 rounded-lg"
          >
            <Menu className="w-6 h-6" />
            <span className="text-xs mt-1">Menu</span>
          </button>

          {/* Quick Access Links */}
          <Link
            href="/"
            className={`flex flex-col items-center px-3 py-2 rounded-lg ${
              pathname === '/' ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            <Cloud className="w-6 h-6" />
            <span className="text-xs mt-1">Weather</span>
          </Link>

          <Link
            href="/shot-calculator"
            className={`flex flex-col items-center px-3 py-2 rounded-lg ${
              pathname === '/shot-calculator' ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            <Target className="w-6 h-6" />
            <span className="text-xs mt-1">Shot</span>
          </Link>

          <Link
            href="/settings"
            className={`flex flex-col items-center px-3 py-2 rounded-lg ${
              pathname === '/settings' ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
