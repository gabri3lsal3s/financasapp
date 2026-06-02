import { useEffect, useState } from 'react'

function canUseMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (!canUseMatchMedia()) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (!canUseMatchMedia()) return

    const mediaQueryList = window.matchMedia(query)
    const onChange = () => setMatches(mediaQueryList.matches)

    onChange()
    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [query])

  return matches
}
