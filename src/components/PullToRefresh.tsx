import { ReactNode, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface PullToRefreshProps {
  children: ReactNode
}

export default function PullToRefresh({ children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const startYRef = useRef(0)
  const startXRef = useRef(0)
  const isPullingRef = useRef(false)
  const pullDistanceRef = useRef(0)

  const threshold = 75 // distance in px required to trigger refresh
  const maxPull = 120   // maximum pull distance in px

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return

      // Only pull if we are scrolled to the top of the window
      const isAtTop = window.scrollY === 0
      if (!isAtTop) return

      startYRef.current = e.touches[0].clientY
      startXRef.current = e.touches[0].clientX
      isPullingRef.current = false
      pullDistanceRef.current = 0
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing) return

      const clientY = e.touches[0].clientY
      const clientX = e.touches[0].clientX
      const diffY = clientY - startYRef.current
      const diffX = clientX - startXRef.current

      // If already pulling, process pull
      if (isPullingRef.current) {
        // Apply resistance
        const distance = Math.max(0, diffY)
        const pull = Math.min(distance * 0.45, maxPull)
        pullDistanceRef.current = pull
        setPullDistance(pull)

        // Prevent browser default overscroll/reload
        if (e.cancelable) {
          e.preventDefault()
        }
        return
      }

      // Determine if we should start pulling
      // Must be scrolling down (diffY > 10) and mostly vertically (diffY > diffX * 1.5)
      const isAtTop = window.scrollY === 0
      if (isAtTop && diffY > 10 && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
        isPullingRef.current = true
        // Prevent default browser refresh or bounce
        if (e.cancelable) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = () => {
      if (!isPullingRef.current) return
      isPullingRef.current = false

      const finalPull = pullDistanceRef.current
      if (finalPull >= threshold) {
        setIsRefreshing(true)
        setPullDistance(threshold)
        
        // Haptic feedback if supported on mobile
        if (window.navigator.vibrate) {
          window.navigator.vibrate(15)
        }

        // Trigger reload
        setTimeout(() => {
          window.location.reload()
        }, 800) // Delay to show satisfying spinner rotation
      } else {
        // Animate back to 0
        setPullDistance(0)
      }
      pullDistanceRef.current = 0
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true })
      container.addEventListener('touchmove', handleTouchMove, { passive: false })
      container.addEventListener('touchend', handleTouchEnd, { passive: true })
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart)
        container.removeEventListener('touchmove', handleTouchMove)
        container.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isRefreshing])

  const pullPercentage = Math.min(pullDistance / threshold, 1)

  return (
    <div ref={containerRef} className="relative w-full min-h-full">
      {/* Indicator overlay */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-[100]"
        style={{
          height: `${maxPull}px`,
          transform: `translateY(${pullDistance - 45}px)`,
          opacity: pullDistance > 10 ? 1 : 0,
          transition: isPullingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s'
        }}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--glass-surface-strong)] border border-glass shadow-lg backdrop-blur-[var(--glass-blur-strong)]">
          {isRefreshing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <RefreshCw size={18} className="text-balance" />
            </motion.div>
          ) : (
            <motion.div
              style={{
                rotate: pullPercentage * 180,
                scale: 0.5 + pullPercentage * 0.5
              }}
            >
              <RefreshCw 
                size={18} 
                className={pullDistance >= threshold ? "text-income" : "text-secondary"} 
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Content container translated down slightly */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? 45 : pullDistance * 0.35}px)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="w-full min-h-full"
      >
        {children}
      </div>
    </div>
  )
}
