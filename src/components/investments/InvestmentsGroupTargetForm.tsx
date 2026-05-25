import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'

type GroupTargetType = 'class' | 'sector'

interface InvestmentsGroupTargetFormProps {
  groupTargetType: GroupTargetType
  groupTargetName: string
  groupTargetPct: string
  savingGroupTarget: boolean
  onTypeChange: (type: GroupTargetType) => void
  onNameChange: (name: string) => void
  onPctChange: (pct: string) => void
  onSubmit: (event: React.FormEvent) => void
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
  savingGroupTarget,
  onTypeChange,
  onNameChange,
  onPctChange,
  onSubmit,
}: InvestmentsGroupTargetFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left w-full animate-page-enter">
      <div className="flex flex-col gap-4">
        <div className="w-full">
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
        </div>

        <div className="w-full">
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
              className="text-sm font-semibold text-primary bg-primary"
            />
          )}
        </div>

        <div className="w-full">
          <Input
            label="Limite Alvo (%)"
            type="number"
            required
            placeholder="Ex: 30"
            value={groupTargetPct}
            onChange={(event) => onPctChange(event.target.value)}
            className="text-sm font-semibold text-primary bg-primary font-mono"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={savingGroupTarget}
            variant="primary"
            className="w-full sm:w-auto text-xs h-[42px] font-extrabold px-6 shadow-sm"
          >
            {savingGroupTarget ? 'Salvando...' : 'Salvar Limite'}
          </Button>
        </div>
      </div>
    </form>
  )
}
