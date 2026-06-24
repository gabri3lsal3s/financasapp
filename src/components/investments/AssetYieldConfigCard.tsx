import Button from '@/components/Button'
import NumberInput from '@/components/NumberInput'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { formatCurrency } from '@/utils/format'
import type { PortfolioAssetIndexer } from '@/types'

export interface AssetYieldDraft {
  id: string
  ticker: string
  date: string
  quantity: string
  price: string
  pricing_mode: string
  isB3Linked: boolean
  isTreasury: boolean
  product_name: string
  indexer: PortfolioAssetIndexer
  indexer_percent: string
  contract_rate: string
  maturity_date: string
}

interface AssetYieldConfigCardProps {
  asset: AssetYieldDraft
  onOpenAssetConfig: (ticker: string) => void
  onUpdateIndexer: (indexer: PortfolioAssetIndexer) => void
  onUpdateIndexerPercent: (val: string) => void
  onUpdateContractRate: (val: string) => void
  onUpdateMaturityDate: (val: string) => void
  onSave: () => void
}

export default function AssetYieldConfigCard({
  asset,
  onOpenAssetConfig,
  onUpdateIndexer,
  onUpdateIndexerPercent,
  onUpdateContractRate,
  onUpdateMaturityDate,
  onSave,
}: AssetYieldConfigCardProps) {
  const isFixed = asset.pricing_mode === 'fixed_income' || asset.isTreasury

  return (
    <div className="modal-panel-glass p-4 space-y-3 text-left transition-all duration-200 border border-glass hover:border-[color-mix(in_srgb,var(--color-balance)_30%,var(--glass-border))]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-glass pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <strong className="text-primary font-mono font-black text-sm block">
              {asset.ticker}
            </strong>
            <span className="text-[9px] text-secondary font-bold uppercase tracking-wider mt-0.5 block">
              {asset.isTreasury ? '🏛️ Tesouro Direto' : isFixed ? '💰 Renda Fixa' : '📝 Valor Manual'}
            </span>
          </div>
          <span className="px-2 py-0.5 bg-balance/10 text-balance rounded-lg text-[9px] uppercase font-bold font-mono">
            Aporte: {asset.date}
          </span>
          <span className="rounded-lg border border-glass modal-panel-glass px-2 py-0.5 text-[9px] font-bold font-mono text-secondary">
            Qtd: {asset.quantity} • {formatCurrency(parseFloat(asset.price))}
          </span>
        </div>

        {!isFixed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenAssetConfig(asset.ticker)}
            className="flex items-center gap-1 py-1.5 px-3 font-bold text-[10px] shrink-0"
          >
            Configurar Ativo
          </Button>
        )}
      </div>

      {isFixed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-[11px] pt-1 items-end">
          <div>
            <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Indexer</label>
            <Select
              value={asset.indexer}
              onChange={(e) => onUpdateIndexer(e.target.value as PortfolioAssetIndexer)}
              options={[
                { value: 'none', label: 'Pré-fixado (taxa contratada)' },
                { value: 'cdi', label: 'CDI' },
                { value: 'selic', label: 'SELIC' },
                { value: 'ipca', label: 'IPCA' },
              ]}
              className="w-full text-[11px]"
            />
          </div>

          {asset.indexer !== 'none' ? (
            <div className="animate-page-enter">
              <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">% do Indexador</label>
              <NumberInput
                step={0.01}
                value={asset.indexer_percent}
                onChange={(e) => onUpdateIndexerPercent(e.target.value)}
                placeholder="100"
                suffix="%"
                compact
                hideSpinButtons
                className="font-semibold text-[11px]"
              />
            </div>
          ) : (
            <div className="animate-page-enter">
              <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Taxa Contratada</label>
              <NumberInput
                step={0.0001}
                value={asset.contract_rate}
                onChange={(e) => onUpdateContractRate(e.target.value)}
                placeholder="12.5"
                suffix="% a.a."
                compact
                hideSpinButtons
                className="font-semibold text-[11px]"
              />
            </div>
          )}

          {asset.indexer !== 'none' && (
            <div className="animate-page-enter">
              <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Taxa Adicional</label>
              <NumberInput
                step={0.0001}
                value={asset.contract_rate}
                onChange={(e) => onUpdateContractRate(e.target.value)}
                placeholder="6.5"
                suffix="% a.a."
                compact
                hideSpinButtons
                className="font-semibold text-[11px]"
              />
            </div>
          )}

          <div>
            <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Vencimento</label>
            <Input
              type="date"
              value={asset.maturity_date}
              onChange={(e) => onUpdateMaturityDate(e.target.value)}
              className="font-semibold text-[11px] cursor-pointer"
            />
          </div>

          <div>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={onSave}
              className="w-full h-10 flex items-center justify-center gap-1 font-bold text-[11px]"
            >
              💾 Salvar Rentabilidade
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
