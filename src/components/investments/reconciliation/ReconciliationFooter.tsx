import Button from '@/components/Button'
import { ArrowRight, ArrowLeft, Check, RefreshCw } from 'lucide-react'
import type { ReconciliationStep } from '@/hooks/useReconciliationState'

interface ReconciliationFooterProps {
  currentStep: ReconciliationStep
  loading: boolean
  fileName: string
  positionFileName: string
  reconciliation: unknown
  wizardCorrectionsCount: number
  manualYieldAssetsCount: number
  positionOnlyMode: boolean
  positionValidation: unknown
  onClose: () => void
  onStartSummary: () => void
  onStartPositionOnly: () => void
  onGoToStep: (step: ReconciliationStep) => void
  onGoToNextAfter: (from: ReconciliationStep) => void
  onNewStatement: () => void
  onGoBack: () => void
}

export default function ReconciliationFooter({
  currentStep,
  loading,
  fileName,
  positionFileName,
  reconciliation,
  wizardCorrectionsCount,
  manualYieldAssetsCount,
  positionOnlyMode,
  positionValidation,
  onClose,
  onStartSummary,
  onStartPositionOnly,
  onGoToStep,
  onGoToNextAfter,
  onNewStatement,
  onGoBack,
}: ReconciliationFooterProps) {
  if (loading) return null

  switch (currentStep) {
    case 'upload': {
      if (!fileName && !positionFileName) return null
      return (
        <div className="flex justify-end gap-3 w-full">
          {positionFileName && !fileName && (
            <Button
              type="button"
              variant="primary"
              onClick={onStartPositionOnly}
              className="font-bold gap-1.5 animate-pulse-slow text-xs"
            >
              Continuar Apenas com Posição <ArrowRight size={14} />
            </Button>
          )}
          {fileName && (
            <Button
              type="button"
              variant="primary"
              onClick={onStartSummary}
              className="font-bold gap-1.5 hover:scale-102 transition-all duration-300 text-xs"
            >
              {positionFileName ? 'Iniciar Auditoria Completa' : 'Iniciar Auditoria de Movimentações'}{' '}
              <ArrowRight size={14} />
            </Button>
          )}
        </div>
      )
    }
    case 'summary': {
      if (!reconciliation) return null
      return (
        <div className="flex justify-end w-full">
          <Button
            type="button"
            variant="primary"
            onClick={() => onGoToNextAfter('summary')}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            {wizardCorrectionsCount > 0 ? (
              <>
                Corrigir pendências <ArrowRight size={13} />
              </>
            ) : (
              <>
                Validar posição B3 <ArrowRight size={13} />
              </>
            )}
          </Button>
        </div>
      )
    }
    case 'corrections': {
      return (
        <div className="flex justify-between items-center w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onGoBack}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            <ArrowLeft size={13} /> Voltar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (manualYieldAssetsCount > 0) {
                onGoToStep('yield_config')
              } else {
                onGoToNextAfter('corrections')
              }
            }}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            {manualYieldAssetsCount > 0 ? (
              <>
                Avançar para Rentabilidade <ArrowRight size={13} />
              </>
            ) : (
              <>
                Validar posição B3 <ArrowRight size={13} />
              </>
            )}
          </Button>
        </div>
      )
    }
    case 'yield_config': {
      return (
        <div className="flex justify-between items-center w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onGoBack}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            <ArrowLeft size={13} /> Voltar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onGoToStep('position')}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            Avançar para Custódia B3 <ArrowRight size={13} />
          </Button>
        </div>
      )
    }
    case 'position': {
      return (
        <div className="flex justify-between items-center w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onGoBack}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            <ArrowLeft size={13} /> Voltar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!positionValidation}
            onClick={() => (positionOnlyMode ? onClose() : onGoToStep('review'))}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            {positionOnlyMode ? (
              <>
                Concluir Validação <Check size={13} />
              </>
            ) : (
              <>
                Avançar para Conclusão <ArrowRight size={13} />
              </>
            )}
          </Button>
        </div>
      )
    }
    case 'review': {
      return (
        <div className="flex justify-between items-center w-full gap-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGoToStep('position')}
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Voltar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNewStatement}
              className="font-bold text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Novo Extrato
            </Button>
          </div>
          <Button
            variant="success"
            size="sm"
            onClick={onClose}
            className="font-bold text-xs flex items-center gap-1.5"
          >
            <Check size={13} /> Concluir Conciliação
          </Button>
        </div>
      )
    }
    default:
      return null
  }
}
