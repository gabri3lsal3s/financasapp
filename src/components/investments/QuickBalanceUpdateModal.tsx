import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import CurrencyInput from '@/components/CurrencyInput'
import { formatCurrency, formatDate } from '@/utils/format'

import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import type { ZIndexElevated } from '@/constants/zIndex'

interface ManualAssetRow {
  id: string
  ticker: string
  manual_current_value: number
  manual_value_updated_at: string | null
  currentInputValue: number
  hasChanged: boolean
}

interface QuickBalanceUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  onSaved: () => void
  zIndexClass?: ZIndexElevated
}

export default function QuickBalanceUpdateModal({
  isOpen,
  onClose,
  portfolioId,
  onSaved,
  zIndexClass,
}: QuickBalanceUpdateModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<ManualAssetRow[]>([])

  const loadManualAssets = useCallback(async () => {
    if (!portfolioId) return
    setLoading(true)
    try {
      // 1. Buscar todas as definições manuais/renda fixa do portfólio
      const { data: defs, error: defErr } = await supabase
        .from('portfolio_asset_definitions')
        .select('id, ticker, pricing_mode, manual_current_value, manual_value_updated_at')
        .eq('portfolio_id', portfolioId)
        .in('pricing_mode', ['manual_value', 'fixed_income'])
        .order('ticker', { ascending: true })

      if (defErr) throw defErr

      if (defs && defs.length > 0) {
        const mappedRows: ManualAssetRow[] = defs.map((d) => {
          const val = Number(d.manual_current_value) || 0
          return {
            id: d.id,
            ticker: d.ticker,
            manual_current_value: val,
            manual_value_updated_at: d.manual_value_updated_at,
            currentInputValue: val,
            hasChanged: false,
          }
        })
        setRows(mappedRows)
      } else {
        setRows([])
      }
    } catch (err) {
      logger.error('[QuickBalanceUpdateModal] Erro ao carregar ativos manuais:', err)
      toast.error('Erro ao carregar lista de ativos para atualização.')
    } finally {
      setLoading(false)
    }
  }, [portfolioId])

  useEffect(() => {
    if (isOpen && portfolioId) {
      void loadManualAssets()
    }
  }, [isOpen, portfolioId, loadManualAssets])

  const handleValueChange = (index: number, newValue: number) => {
    setRows((prev) => {
      const next = [...prev]
      const target = { ...next[index] }
      target.currentInputValue = newValue
      target.hasChanged = newValue !== target.manual_current_value
      next[index] = target
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const changedRows = rows.filter((r) => r.hasChanged)
    if (changedRows.length === 0) {
      toast('Nenhuma alteração de saldo para salvar.')
      onClose()
      return
    }

    setSaving(true)
    try {
      const nowIso = new Date().toISOString()

      // Atualizar em lote cada ativo alterado
      const updates = changedRows.map((r) =>
        supabase
          .from('portfolio_asset_definitions')
          .update({
            manual_current_value: r.currentInputValue,
            manual_value_updated_at: nowIso,
            pricing_mode: 'manual_value', // Garantir que fique como manual_value
            updated_at: nowIso,
          })
          .eq('id', r.id)
      )

      // Registrar ponto no histórico de preços/saldos (asset_price_daily)
      const priceUpdates = changedRows.map((r) => {
        const unitPrice = r.currentInputValue
        return supabase.from('asset_price_daily').upsert(
          {
            ticker: r.ticker,
            price_date: nowIso.slice(0, 10),
            close_price: unitPrice,
            source: 'manual_update',
          },
          { onConflict: 'ticker,price_date' }
        )
      })

      const results = await Promise.all([...updates, ...priceUpdates])

      const hasError = results.some((res) => res.error)

      if (hasError) {
        throw new Error('Falha ao atualizar alguns saldos.')
      }

      toast.success(`${changedRows.length} ${changedRows.length === 1 ? 'saldo atualizado' : 'saldos atualizados'} com sucesso!`)

      window.dispatchEvent(
        new CustomEvent('local-data-changed', {
          detail: { entity: 'portfolio_asset_definitions' },
        })
      )

      onSaved()
      onClose()
    } catch (err: unknown) {
      logger.error('[QuickBalanceUpdateModal] Erro ao salvar saldos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar saldos atualizados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Atualização Rápida de Saldos (Extrato)"
      onSubmit={handleSubmit}
      size="md"
      zIndexClass={zIndexClass}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Salvar Saldos Atualizados"
          submitDisabled={saving || loading || rows.filter((r) => r.hasChanged).length === 0}
          loading={saving}
        />
      )}
    >
      <div className="space-y-4 text-left">
        <p className="text-xs text-secondary leading-relaxed">
          Copie os saldos atuais exibidos no extrato da sua corretora ou banco para manter sua custódia 100% precisa.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs font-semibold text-secondary animate-pulse">
            Carregando ativos manuais...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs font-semibold text-secondary bg-glass/5 border border-glass/25 rounded-2xl">
            Nenhum ativo de Renda Fixa ou Valor Manual encontrado na carteira.
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  row.hasChanged
                    ? 'border-income/40 bg-income/5'
                    : 'border-glass/25 bg-glass/5 hover:bg-glass/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <span className="font-mono font-black text-sm text-primary block">{row.ticker}</span>
                    <span className="text-[10px] text-secondary font-medium block">
                      Última att:{' '}
                      {row.manual_value_updated_at
                        ? formatDate(row.manual_value_updated_at)
                        : 'Nunca atualizado'}

                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-secondary block">
                      Valor Salvo Anterior
                    </span>
                    <span className="text-xs font-mono font-bold text-secondary">
                      {formatCurrency(row.manual_current_value)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-glass/10">
                  <CurrencyInput
                    label="Novo Saldo Atual (R$)"
                    value={row.currentInputValue}
                    onChange={(_e, val) => handleValueChange(idx, val)}
                    placeholder="Ex: 5000.00"
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalForm>
  )
}
