import { describe, it, expect } from 'vitest'
import {
  monthReturnFromShares,
  buildMonthEndSnapshot,
  heatmapFromSnapshots,
} from '@/services/returns/periodReturns'
import type { PortfolioPeriodSnapshotRow, PortfolioTransaction } from '@/types'

describe('periodReturns', () => {
  it('monthReturnFromShares calcula variação percentual', () => {
    expect(monthReturnFromShares(1.05, 1)).toBeCloseTo(0.05, 4)
    expect(monthReturnFromShares(1, 0)).toBe(0)
  })

  it('buildMonthEndSnapshot monta retorno do mês', () => {
    const txs: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 500,
        date: '2026-02-15',
        created_at: '',
      },
    ]
    const snap = buildMonthEndSnapshot(
      'p1',
      '2026-02',
      { '2026-01': 1, '2026-02': 1.03 },
      txs,
      0,
    )
    expect(snap.period_return).toBeCloseTo(0.03, 4)
    expect(snap.cota_fechamento).toBe(1.03)
  })

  it('heatmapFromSnapshots monta grade anual', () => {
    const snapshots: PortfolioPeriodSnapshotRow[] = [
      {
        id: '1',
        portfolio_id: 'p1',
        period_type: 'month',
        period_key: '2026-01',
        cota_abertura: 1,
        cota_fechamento: 1.01,
        somatorio_aportes: 0,
        somatorio_resgates: 0,
        dividendos_recebidos: 0,
        drawdown_maximo: 0,
        period_return: 0.01,
        created_at: '',
      },
    ]
    const { years, grid } = heatmapFromSnapshots(snapshots)
    expect(years).toContain('2026')
    expect(grid['2026']['1']).toBe(1)
  })
})
