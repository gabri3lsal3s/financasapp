import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import AssetYieldConfigCard from '@/components/investments/AssetYieldConfigCard'
import type { MissingDraft } from '@/hooks/useReconciliationState'

interface StepYieldConfigProps {
  manualYieldRequiredAssets: MissingDraft[]
  onOpenAssetConfig: (ticker: string) => void
  onUpdateImportedDraft: <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => void
  onSaveAssetYield: (asset: MissingDraft) => void
}

export default function StepYieldConfig({
  manualYieldRequiredAssets,
  onOpenAssetConfig,
  onUpdateImportedDraft,
  onSaveAssetYield,
}: StepYieldConfigProps) {
  if (manualYieldRequiredAssets.length === 0) return null

  return (
    <div className="space-y-4 animate-page-enter">
      <B3ReconciliationGuidance title="Rentabilidade dos Novos Aportes" variant="info">
        Configure as taxas contratadas (ex: % do CDI ou taxa pré-fixada a.a.) e datas de vencimento para cada aporte de
        Renda Fixa importado. Isso garante a precisão do cálculo de rendimento.
      </B3ReconciliationGuidance>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {manualYieldRequiredAssets.map((asset) => (
          <AssetYieldConfigCard
            key={asset.id}
            asset={asset}
            onOpenAssetConfig={onOpenAssetConfig}
            onUpdateIndexer={(indexer) => onUpdateImportedDraft(asset.id, 'indexer', indexer)}
            onUpdateIndexerPercent={(val) => onUpdateImportedDraft(asset.id, 'indexer_percent', val)}
            onUpdateContractRate={(val) => onUpdateImportedDraft(asset.id, 'contract_rate', val)}
            onUpdateMaturityDate={(val) => onUpdateImportedDraft(asset.id, 'maturity_date', val)}
            onSave={() => onSaveAssetYield(asset)}
          />
        ))}
      </div>
    </div>
  )
}
