import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ScrollToTop({ scrollAreaRef }: { scrollAreaRef?: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollAreaRef?.current || window
    const handleScroll = () => {
      const scrollY = scrollAreaRef?.current
        ? scrollAreaRef.current.scrollTop
        : window.scrollY
      setVisible(scrollY > 400)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollAreaRef])

  const scrollToTop = () => {
    if (scrollAreaRef?.current) {
      scrollAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-24 right-6 z-50 w-10 h-10 rounded-full border border-glass bg-glass/80 backdrop-blur-md flex items-center justify-center text-secondary hover:text-primary hover:border-glass-strong transition-all duration-300 shadow-lg hover:shadow-xl motion-standard',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      aria-label="Voltar ao topo"
    >
      <ChevronUp size={18} />
    </button>
  )
}
