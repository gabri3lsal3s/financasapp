import { useState, useEffect } from 'react'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import InvestmentsGroupTargetForm from '@/components/investments/InvestmentsGroupTargetForm'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatPercentBR } from '@/utils/format'
import type { PortfolioGroupTarget } from '@/types'

interface GroupTargetModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => Promise<void>
  editingTarget: PortfolioGroupTarget | null
  groupTargets: PortfolioGroupTarget[]
  portfolioId: string
}

export default function GroupTargetModal({
  isOpen,
  onClose,
  onSaved,
  editingTarget,
  groupTargets,
  portfolioId,
}: GroupTargetModalProps) {
  const [saving, setSaving] = useState(false)
  const [groupTargetType, setGroupTargetType] = useState<'class' | 'sector'>('class')
  const [groupTargetName, setGroupTargetName] = useState('Ações Nacionais')
  const [groupTargetPct, setGroupTargetPct] = useState('')

  // Sync internal state when opened or editingTarget changes
  useEffect(() => {
    if (isOpen) {
      if (editingTarget) {
        setGroupTargetType(editingTarget.group_type)
        setGroupTargetName(editingTarget.group_name)
        setGroupTargetPct(String(editingTarget.target_percentage))
      } else {
        setGroupTargetType('class')
        setGroupTargetName('Ações Nacionais')
        setGroupTargetPct('')
      }
    }
  }, [isOpen, editingTarget])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) return
    setSaving(true)

    try {
      const pct = parseFloat(groupTargetPct)
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        throw new Error('Percentual de limite inválido (0 a 100)')
      }

      const name = groupTargetName.trim()
      if (!name) {
        throw new Error('Insira o nome do grupo')
      }

      // Validate cumulative target does not exceed 100%
      const currentSum = groupTargets
        .filter(
          (gt) => gt.group_type === groupTargetType && gt.id !== editingTarget?.id
        )
        .reduce((sum, gt) => sum + Number(gt.target_percentage || 0), 0)

      if (currentSum + pct > 100) {
        throw new Error(
          `O limite total de exposição por ${
            groupTargetType === 'class' ? 'classe' : 'setor'
          } não pode ultrapassar 100% (atual: ${formatPercentBR(currentSum, 0)})`
        )
      }

      const { error } = await supabase
        .from('portfolio_group_targets')
        .upsert({
          ...(editingTarget?.id ? { id: editingTarget.id } : {}),
          portfolio_id: portfolioId,
          group_type: groupTargetType,
          group_name: name,
          target_percentage: pct,
        })

      if (error) throw error

      toast.success(
        editingTarget
          ? 'Limite de exposição atualizado!'
          : 'Limite de exposição cadastrado!'
      )
      setGroupTargetPct('')
      onClose()
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar limite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Definir Limites de Exposição"
      size="md"
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={saving ? 'Salvando...' : 'Salvar Limite'}
          submitDisabled={saving}
          loading={saving}
        />
      )}
    >
      <InvestmentsGroupTargetForm
        groupTargetType={groupTargetType}
        groupTargetName={groupTargetName}
        groupTargetPct={groupTargetPct}
        onTypeChange={(type) => {
          setGroupTargetType(type)
          setGroupTargetName(type === 'class' ? 'Ações Nacionais' : '')
        }}
        onNameChange={setGroupTargetName}
        onPctChange={setGroupTargetPct}
      />
    </ModalForm>
  )
}
