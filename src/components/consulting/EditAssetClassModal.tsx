/**
 * EditAssetClassModal
 * WHY: Extrai o ModalForm de edição de classificação de ativo que antes estava
 *      inline no ConsultantDashboard, reduzindo o tamanho do componente pai
 *      e centralizando a UI de edição de classe/setor num componente focado.
 */
import React from 'react'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import Select from '@/components/Select'
import Input from '@/components/Input'

interface Props {
  isOpen: boolean
  onClose: () => void
  ticker: string
  assetClass: string
  assetSector: string
  saving: boolean
  onAssetClassChange: (value: string) => void
  onAssetSectorChange: (value: string) => void
  onSave: (e: React.FormEvent) => void
}

const ASSET_CLASS_OPTIONS = [
  { value: 'Ações Nacionais', label: 'Ações Nacionais' },
  { value: 'Ações Internacionais', label: 'Ações Internacionais' },
  { value: 'Fundos Imobiliários', label: 'Fundos Imobiliários' },
  { value: 'ETFs Nacionais', label: 'ETFs Nacionais' },
  { value: 'ETFs Internacionais', label: 'ETFs Internacionais' },
  { value: 'Criptoativos', label: 'Criptoativos' },
  { value: 'Renda Fixa', label: 'Renda Fixa' },
]

export default function EditAssetClassModal({
  isOpen,
  onClose,
  ticker,
  assetClass,
  assetSector,
  saving,
  onAssetClassChange,
  onAssetSectorChange,
  onSave,
}: Props) {
  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Classificação: ${ticker}`}
      onSubmit={onSave}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Salvar Alterações"
          loading={saving}
          loadingLabel="Salvando..."
        />
      )}
    >
      <p className="modal-intro font-sans">
        Altere manualmente a classe e o setor econômico do ativo <strong>{ticker}</strong> no banco
        de dados. Essas configurações serão aplicadas imediatamente a todos os relatórios e
        carteiras que contêm este ativo.
      </p>
      <Select
        label="Classe de Ativo"
        value={assetClass}
        onChange={(e) => onAssetClassChange(e.target.value)}
        options={ASSET_CLASS_OPTIONS}
        required
      />
      <Input
        label="Setor Econômico"
        type="text"
        required
        placeholder="Ex: Petróleo e Gás"
        value={assetSector}
        onChange={(e) => onAssetSectorChange(e.target.value)}
        className="text-sm font-semibold"
      />
    </ModalForm>
  )
}
