import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface AdvisoryPortfolioLinkState {
  hasAdvisoryLink: boolean
  loading: boolean
}

export function useAdvisoryPortfolioLink(): AdvisoryPortfolioLinkState {
  const { user, profile } = useAuth()
  const [hasAdvisoryLink, setHasAdvisoryLink] = useState(false)
  const [loading, setLoading] = useState(true)
  const isConsultant = profile?.role === 'consultant'

  useEffect(() => {
    let mounted = true

    async function checkAdvisoryLink() {
      if (!user || isConsultant) {
        if (mounted) {
          setHasAdvisoryLink(false)
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('id')
          .eq('client_id', user.id)
          .not('consultant_id', 'is', null)
          .limit(1)
          .maybeSingle()

        if (error) throw error

        if (mounted) {
          setHasAdvisoryLink(Boolean(data))
        }
      } catch {
        if (mounted) {
          setHasAdvisoryLink(false)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void checkAdvisoryLink()

    return () => {
      mounted = false
    }
  }, [user?.id, isConsultant])

  return { hasAdvisoryLink, loading }
}
