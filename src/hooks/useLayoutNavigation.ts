import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'

const SIDEBAR_STORAGE_KEY = 'sidebar-expanded'

/**
 * Estado e comportamentos de navegação do shell do app:
 * menu mobile (bottom sheet), sidebar desktop (expansão persistida),
 * fechamento por Escape/clique fora, trava de scroll e logout.
 */
export function useLayoutNavigation() {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDesktopMenuExpanded, setIsDesktopMenuExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })

  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileMenuContentRef = useRef<HTMLDivElement | null>(null)
  const desktopMenuRef = useRef<HTMLElement | null>(null)
  const desktopMenuButtonRef = useRef<HTMLButtonElement | null>(null)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      logger.error('Error logging out:', error)
    }
  }

  const toggleDesktopMenu = () => {
    setIsDesktopMenuExpanded((currentValue) => {
      const next = !currentValue
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  // Fecha o menu mobile ao trocar de rota
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Fecha menus com Escape
  useEffect(() => {
    if (!isMobileMenuOpen && !isDesktopMenuExpanded) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
        setIsDesktopMenuExpanded(false)
        localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false')
      }
    }

    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMobileMenuOpen, isDesktopMenuExpanded])

  // Fecha menus com clique fora
  useEffect(() => {
    if (!isMobileMenuOpen && !isDesktopMenuExpanded) {
      return
    }

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (isMobileMenuOpen) {
        const clickedMobileToggle = mobileMenuButtonRef.current?.contains(target)
        const clickedInsideMobileMenu = mobileMenuContentRef.current?.contains(target)
        if (!clickedMobileToggle && !clickedInsideMobileMenu) {
          setIsMobileMenuOpen(false)
        }
      }

      if (isDesktopMenuExpanded) {
        const clickedDesktopMenu = desktopMenuRef.current?.contains(target)
        const clickedDesktopToggle = desktopMenuButtonRef.current?.contains(target)
        if (!clickedDesktopMenu && !clickedDesktopToggle) {
          setIsDesktopMenuExpanded(false)
          localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false')
        }
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
    }
  }, [isMobileMenuOpen, isDesktopMenuExpanded])

  // Trava o scroll do body quando o menu mobile está aberto
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return {
    profile,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isDesktopMenuExpanded,
    toggleDesktopMenu,
    mobileMenuButtonRef,
    mobileMenuContentRef,
    desktopMenuRef,
    desktopMenuButtonRef,
    handleLogout,
  }
}
