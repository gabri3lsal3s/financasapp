import Input from '@/components/Input'
import Select from '@/components/Select'

type GroupTargetType = 'class' | 'sector'

interface InvestmentsGroupTargetFormProps {
  groupTargetType: GroupTargetType
  groupTargetName: string
  groupTargetPct: string
  onTypeChange: (type: GroupTargetType) => void
  onNameChange: (name: string) => void
  onPctChange: (pct: string) => void
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

export default function InvestmentsGroupTargetForm({
  groupTargetType,
  groupTargetName,
  groupTargetPct,
  onTypeChange,
  onNameChange,
  onPctChange,
}: InvestmentsGroupTargetFormProps) {
  return (
    <>
      <Select
        label="Tipo de Limite"
        value={groupTargetType}
        onChange={(event) => {
          const val = event.target.value as GroupTargetType
          onTypeChange(val)
          onNameChange(val === 'class' ? 'Ações Nacionais' : '')
        }}
        options={[
          { value: 'class', label: 'Por Classe de Ativos' },
          { value: 'sector', label: 'Por Setor Econômico' },
        ]}
      />

      {groupTargetType === 'class' ? (
        <Select
          label="Classe de Ativo"
          value={groupTargetName}
          onChange={(event) => onNameChange(event.target.value)}
          options={ASSET_CLASS_OPTIONS}
          required
        />
      ) : (
        <Input
          label="Setor Econômico"
          type="text"
          required
          placeholder="Ex: Petróleo e Gás"
          value={groupTargetName}
          onChange={(event) => onNameChange(event.target.value)}
          className="text-sm font-semibold"
        />
      )}

      <Input
        label="Limite Alvo (%)"
        type="number"
        required
        placeholder="Ex: 30"
        value={groupTargetPct}
        onChange={(event) => onPctChange(event.target.value)}
        className="text-sm font-semibold font-mono"
      />
    </>
  )
}
