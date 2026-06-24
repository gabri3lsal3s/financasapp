import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Card from '@/components/Card'
import NumberInput from '@/components/NumberInput'
import ViewModeToggle from '@/components/ViewModeToggle'
import { formatPercentBR } from '@/utils/format'
import type { PortfolioGroupTarget } from '@/types'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'portfolio_exposure_view_mode'
const SAVE_DEBOUNCE_MS = 800

interface ExposureLimitsEditorProps {
  portfolioId: string
  positions: ValuedPosition[]
  totalValue: number
  groupTargets: PortfolioGroupTarget[]
  onSaved: () => void
}

type GroupMode = 'class' | 'sector'

interface LimitEntry {
  groupName: string
  currentPct: number
  currentValue: number
  targetPct: number
  isDirty: boolean
}

export default function ExposureLimitsEditor({
  portfolioId,
  positions,
  totalValue,
  groupTargets,
  onSaved,
}: ExposureLimitsEditorProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return saved === 'class' || saved === 'sector' ? saved : 'class'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, groupMode)
  }, [groupMode])

  const [entries, setEntries] = useState<LimitEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Extrair grupos únicos das posições
  const availableGroups = useMemo(() => {
    const groupsSet = new Set<string>()
    const nonCash = positions.filter(
      (p) => !['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(p.ticker.toUpperCase())
    )
    for (const pos of nonCash) {
      const name = groupMode === 'class' ? pos.asset_class : pos.sector
      if (name) groupsSet.add(name)
    }
    return Array.from(groupsSet).sort()
  }, [positions, groupMode])

  // Calcular percentual atual de cada grupo e mesclar com alvos existentes
  useEffect(() => {
    const valueMap = new Map<string, number>()

    const nonCash = positions.filter(
      (p) => !['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(p.ticker.toUpperCase())
    )

    for (const pos of nonCash) {
      const name = groupMode === 'class' ? pos.asset_class : pos.sector
      if (!name) continue
      const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
      valueMap.set(name, (valueMap.get(name) || 0) + valueInBrl)
    }

    const existingTargets = groupTargets.filter((t) => t.group_type === groupMode)
    const targetMap = new Map(existingTargets.map((t) => [t.group_name, Number(t.target_percentage)]))

    const newEntries: LimitEntry[] = availableGroups.map((name) => {
      const val = valueMap.get(name) || 0
      const currentPct = totalValue > 0 ? (val / totalValue) * 100 : 0
      return {
        groupName: name,
        currentPct,
        currentValue: val,
        targetPct: targetMap.get(name) ?? 0,
        isDirty: false,
      }
    })

    setEntries(newEntries)
  }, [availableGroups, positions, totalValue, groupTargets, groupMode])

  const totalTargetPct = useMemo(
    () => entries.reduce((sum, e) => sum + e.targetPct, 0),
    [entries]
  )

  const isOver100 = totalTargetPct > 100
  const isUnder100 = totalTargetPct < 100 && entries.some((e) => e.targetPct > 0)

  // Função de salvamento otimista
  const performSave = useCallback(async (entriesToSave: LimitEntry[], mode: GroupMode) => {
    setSaving(true)
    try {
      // Deletar alvos existentes deste tipo
      const { error: delError } = await supabase
        .from('portfolio_group_targets')
        .delete()
        .eq('portfolio_id', portfolioId)
        .eq('group_type', mode)

      if (delError) throw delError

      // Inserir apenas os que têm target > 0
      const toInsert = entriesToSave
        .filter((e) => e.targetPct > 0)
        .map((e) => ({
          portfolio_id: portfolioId,
          group_type: mode,
          group_name: e.groupName,
          target_percentage: e.targetPct,
        }))

      if (toInsert.length > 0) {
        const { error: insError } = await supabase
          .from('portfolio_group_targets')
          .insert(toInsert)

        if (insError) throw insError
      }

      // Marcar todos como não-dirty
      setEntries((prev) => prev.map((e) => ({ ...e, isDirty: false })))
      setLastSaved(new Date())

      window.dispatchEvent(
        new CustomEvent('local-data-changed', {
          detail: { entity: 'portfolio_group_targets' },
        })
      )

      onSaved()
    } catch (err) {
      console.error('[ExposureLimitsEditor] Error saving:', err)
      toast.error('Erro ao salvar limites. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }, [portfolioId, onSaved])

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleTargetChange = (groupName: string, value: string) => {
    const parsed = parseFloat(value)
    const valid = !isNaN(parsed) ? Math.max(0, Math.min(100, parsed)) : 0

    setEntries((prev) => {
      const updated = prev.map((e) =>
        e.groupName === groupName ? { ...e, targetPct: valid, isDirty: true } : e
      )

      // Verificar se a soma ultrapassou 100%
      const newTotal = updated.reduce((sum, e) => sum + e.targetPct, 0)

      // Agendar salvamento otimista com debounce (se não ultrapassar 100%)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      if (newTotal <= 100) {
        saveTimerRef.current = setTimeout(() => {
          performSave(updated, groupMode)
        }, SAVE_DEBOUNCE_MS)
      }

      return updated
    })
  }

  // Quando ultrapassar 100%, salvar automaticamente assim que voltar para <= 100
  useEffect(() => {
    if (!isOver100 && entries.some((e) => e.isDirty)) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        performSave(entries, groupMode)
      }, SAVE_DEBOUNCE_MS)
    }
  }, [isOver100, entries, groupMode, performSave])

  const dirtyCount = useMemo(() => entries.filter((e) => e.isDirty).length, [entries])

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-4 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-glass/40 pb-3">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            Limites de Exposição
          </h4>
          <p className="text-[10px] text-secondary font-medium">
            Defina o percentual máximo desejado por {groupMode === 'class' ? 'classe' : 'setor'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicador de salvamento */}
          {saving && (
            <span className="text-[9px] text-secondary font-bold animate-pulse">
              Salvando...
            </span>
          )}
          {!saving && lastSaved && dirtyCount === 0 && (
            <span className="text-[8px] text-income font-bold">
              Salvo
            </span>
          )}
          <ViewModeToggle
            options={[
              { value: 'class', label: 'Classes' },
              { value: 'sector', label: 'Setores' },
            ]}
            value={groupMode}
            onChange={(v) => setGroupMode(v as 'class' | 'sector')}
          />
        </div>
      </div>

      {/* Status da soma */}
      <div
        className={`p-3 rounded-xl border text-[10px] font-bold flex items-center gap-2 ${
          isOver100
            ? 'bg-expense/8 border-expense/15 text-expense'
            : isUnder100
              ? 'bg-primary/8 border-primary/15 text-primary'
              : totalTargetPct === 100
                ? 'bg-income/8 border-income/15 text-income'
                : 'bg-glass/8 border-glass/20 text-secondary'
        }`}
      >
        {isOver100 ? (
          <span>
            Soma ultrapassa 100% ({formatPercentBR(totalTargetPct, 1)}). Reduza os limites para salvar automaticamente.
          </span>
        ) : isUnder100 ? (
          <span>
            Soma atual: {formatPercentBR(totalTargetPct, 1)}. Ainda há {formatPercentBR(100 - totalTargetPct, 1)} disponível para distribuir.
          </span>
        ) : totalTargetPct === 100 ? (
          <span>Distribuição completa em 100%.</span>
        ) : (
          <span>Nenhum limite definido. Defina percentuais para cada grupo.</span>
        )}
      </div>

      {/* Lista de grupos com inputs */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-none">
        {entries.length === 0 ? (
          <p className="text-xs text-secondary font-medium text-center py-4">
            Nenhuma {groupMode === 'class' ? 'classe' : 'setor'} encontrada com posições ativas.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.groupName}
              className="grid grid-cols-[1fr_auto_auto_80px] gap-3 items-center p-2 rounded-xl hover:bg-glass/5 transition-colors"
            >
              {/* Nome do grupo */}
              <div className="min-w-0">
                <span className="text-xs font-bold text-primary truncate block">
                  {entry.groupName}
                </span>
                <span className="text-[9px] text-secondary font-medium font-mono">
                  Atual: {formatPercentBR(entry.currentPct, 1)} ({entry.currentPct > 0
                    ? `${formatPercentBR(Math.min(100, (entry.currentPct / (entry.targetPct || 1)) * 100), 0)}% do limite`
                    : '—'})
                </span>
              </div>

              {/* Barra de progresso atual vs alvo */}
              <div className="w-16 h-1.5 bg-glass/10 rounded-full overflow-hidden shrink-0">
                {entry.targetPct > 0 && (
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      entry.currentPct > entry.targetPct
                        ? 'bg-expense'
                        : 'bg-income'
                    }`}
                    style={{
                      width: `${Math.min(100, (entry.currentPct / entry.targetPct) * 100)}%`,
                    }}
                  />
                )}
              </div>

              {/* Badge de status */}
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  entry.targetPct > 0 && entry.currentPct > entry.targetPct
                    ? 'bg-expense/10 text-expense'
                    : entry.targetPct > 0
                      ? 'bg-income/10 text-income'
                      : 'text-secondary'
                }`}
              >
                {entry.targetPct > 0
                  ? entry.currentPct > entry.targetPct
                    ? 'Excedido'
                    : 'OK'
                  : '—'}
              </span>

              {/* Input do limite */}
              <NumberInput
                min={0}
                max={100}
                step={0.5}
                value={entry.targetPct || ''}
                onChange={(e) => handleTargetChange(entry.groupName, e.target.value)}
                placeholder="0"
                suffix="%"
                compact
                hideSpinButtons
                className="h-8 text-xs font-mono font-bold text-right rounded-lg"
              />
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
