/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDebts } from '@/hooks/useDebts'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

vi.mock('@/services/offlineCache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}))

describe('useDebts hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inicializa com carregamento e resolve para lista vazia', async () => {
    const { result } = renderHook(() => useDebts())
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.debts).toEqual([])
  })
})
