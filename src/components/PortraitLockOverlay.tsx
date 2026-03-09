import { useEffect, useState } from 'react'
import { useAppSettings } from '@/hooks/useAppSettings'
import { Smartphone } from 'lucide-react'

export default function PortraitLockOverlay() {
  const { screenRotationAllowed } = useAppSettings()
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      // Consideramos landscape se a largura for maior que a altura
      // e o dispositivo for provavelmente um mobile (largura pequena ou touch)
      const landscape = window.innerWidth > window.innerHeight
      setIsLandscape(landscape)
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // Se a rotação for permitida ou não estiver em landscape, não mostra nada
  if (screenRotationAllowed || !isLandscape) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary/95 backdrop-blur-md p-6 text-center animate-in fade-in duration-300">
      <div className="rounded-full bg-primary-soft p-6 mb-6 shadow-xl border border-primary/20 animate-bounce">
        <Smartphone className="w-12 h-12 text-[var(--color-focus)] rotate-90" />
      </div>
      <h2 className="text-xl font-bold text-primary mb-2">
        Modo Retrato Necessário
      </h2>
      <p className="text-secondary max-w-[280px] leading-relaxed">
        Para uma melhor experiência, por favor rotacione seu dispositivo para a vertical.
      </p>
      
      <div className="mt-8 flex gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-focus)] animate-pulse" />
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-focus)] animate-pulse delay-75" />
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-focus)] animate-pulse delay-150" />
      </div>
    </div>
  )
}
