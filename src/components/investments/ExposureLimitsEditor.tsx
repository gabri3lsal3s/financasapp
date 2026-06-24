import { useState, useEffect, useMemo } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { formatPercentBR } from '@/utils/format'
import type { PortfolioGroupTarget } from '@/types'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'portfolio_exposure_view_mode'

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

  // Persistir escolha
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, groupMode)
  }, [groupMode])
  const [entries, setEntries] = useState<LimitEntry[]>([])
  const [saving, setSaving] = useState(false)

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
    const currentMap = new Map<string, number>()
    const valueMap = new Map<string, number>()

    const nonCash = positions.filter(
      (p) => !['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(p.ticker.toUpperCase())
    )

    for (const pos of nonCash) {
      const name = groupMode === 'class' ? pos.asset_class : pos.sector
      if (!name) continue
      const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
      currentMap.set(name, (currentMap.get(name) || 0) + valueInBrl)
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

  const handleTargetChange = (groupName: string, value: string) => {
    const parsed = parseFloat(value)
    const valid = !isNaN(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
    setEntries((prev) =>
      prev.map((e) =>
        e.groupName === groupName ? { ...e, targetPct: valid, isDirty: true } : e
      )
    )
  }

  const handleSave = async () => {
    if (isOver100) {
      toast.error('A soma dos limites não pode ultrapassar 100%')
      return
    }

    setSaving(true)
    try {
      const dirtyEntries = entries.filter((e) => e.isDirty || e.targetPct > 0)

      // Deletar alvos existentes deste tipo para reinserir
      const { error: delError } = await supabase
        .from('portfolio_group_targets')
        .delete()
        .eq('portfolio_id', portfolioId)
        .eq('group_type', groupMode)

      if (delError) throw delError

      // Inserir apenas os que têm target > 0
      const toInsert = dirtyEntries
        .filter((e) => e.targetPct > 0)
        .map((e) => ({
          portfolio_id: portfolioId,
          group_type: groupMode,
          group_name: e.groupName,
          target_percentage: e.targetPct,
        }))

      if (toInsert.length > 0) {
        const { error: insError } = await supabase
          .from('portfolio_group_targets')
          .insert(toInsert)

        if (insError) throw insError
      }

      // Disparar evento de recarregamento
      window.dispatchEvent(
        new CustomEvent('local-data-changed', {
          detail: { entity: 'portfolio_group_targets' },
        })
      )

      toast.success(
        `Limites de ${groupMode === 'class' ? 'classes' : 'setores'} atualizados!`
      )
      onSaved()
    } catch (err) {
      console.error('[ExposureLimitsEditor] Error saving:', err)
      toast.error('Erro ao salvar limites.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 space-y-4 text-left">
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
        <div className="flex gap-1 bg-glass/10 p-0.5 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setGroupMode('class')}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
              groupMode === 'class'
                ? 'bg-glass/20 text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Classes
          </button>
          <button
            type="button"
            onClick={() => setGroupMode('sector')}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
              groupMode === 'sector'
                ? 'bg-glass/20 text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Setores
          </button>
        </div>
      </div>

      {/* Status da soma */}
      <div
        className={`p-3 rounded-xl border text-[10px] font-bold flex items-center gap-2 ${
          isOver100
            ? 'bg-expense/10 border-expense/20 text-expense'
            : isUnder100
              ? 'bg-warning/10 border-warning/20 text-warning'
              : totalTargetPct === 100
                ? 'bg-income/10 border-income/20 text-income'
                : 'bg-glass/10 border-glass/30 text-secondary'
        }`}
      >
        {isOver100 ? (
          <span>
            ⚠️ Soma ultrapassa 100%! ({formatPercentBR(totalTargetPct, 1)}). Reduza os limites para não exceder.
          </span>
        ) : isUnder100 ? (
          <span>
            ℹ️ Soma atual: {formatPercentBR(totalTargetPct, 1)}. Ainda há {formatPercentBR(100 - totalTargetPct, 1)} disponível para distribuir.
          </span>
        ) : totalTargetPct === 100 ? (
          <span>✅ Distribuição completa em 100%.</span>
        ) : (
          <span>Nenhum limite definido. Defina percentuais para cada grupo.</span>
        )}
      </div>

      {/* Lista de grupos com inputs */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
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
                  Atual: {formatPercentBR(entry.currentPct, 1)} ({entry.currentPct > 0 ? `${formatPercentBR((entry.currentPct / (entry.targetPct || 1)) * 100, 0)}% do limite` : '—'})
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
                className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
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
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={entry.targetPct || ''}
                  onChange={(e) => handleTargetChange(entry.groupName, e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono font-bold text-right pr-6 w-full rounded-lg"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-secondary font-bold pointer-events-none">
                  %
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botão salvar */}
      {entries.some((e) => e.isDirty) && (
        <div className="border-t border-glass/40 pt-4">
          <Button
            type="button"
            variant={isOver100 ? 'expense' : 'income'}
            onClick={handleSave}
            disabled={saving || isOver100}
            className="w-full h-10 text-xs font-black uppercase tracking-wider rounded-xl"
          >
            {saving
              ? 'Salvando...'
              : isOver100
                ? 'Ajuste os limites (soma > 100%)'
                : 'Salvar Limites'}
          </Button>
        </div>
      )}
    </Card>
  )
}
