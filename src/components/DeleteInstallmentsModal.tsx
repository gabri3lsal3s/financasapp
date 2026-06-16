import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { AlertTriangle, Trash, ArrowRight, Layers } from 'lucide-react'

interface DeleteInstallmentsModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mode: 'single' | 'all' | 'subsequent') => Promise<void>
  type: 'expense' | 'debt'
  installmentNumber: number
  installmentTotal: number
}

export default function DeleteInstallmentsModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  installmentNumber,
  installmentTotal,
}: DeleteInstallmentsModalProps) {
  const entityLabel = type === 'expense' ? 'despesa' : 'cobrança'

  const handleChoice = async (mode: 'single' | 'all' | 'subsequent') => {
    await onConfirm(mode)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Excluir item parcelado"
      size="md"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-glass bg-warning/10 text-warning text-xs leading-relaxed">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-warning" />
          <div>
            <p className="font-bold">Aviso de Parcelamento</p>
            <p className="mt-0.5 opacity-90">
              Esta {entityLabel} faz parte de um parcelamento (parcela {installmentNumber} de {installmentTotal}).
              Como deseja prosseguir com a exclusão?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleChoice('single')}
            className="w-full text-left p-3.5 rounded-xl border border-glass surface-glass hover:bg-glass-strong transition-all flex items-center justify-between group"
          >
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-primary">
                <Trash size={14} className="text-secondary group-hover:text-expense transition-colors" />
                Apenas esta parcela
              </span>
              <p className="text-[10px] text-secondary mt-1">
                Exclui apenas a parcela atual ({installmentNumber}/{installmentTotal}). As demais parcelas continuam salvas.
              </p>
            </div>
            <ArrowRight size={14} className="text-secondary shrink-0 ml-3 motion-standard group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={() => void handleChoice('subsequent')}
            className="w-full text-left p-3.5 rounded-xl border border-glass surface-glass hover:bg-glass-strong transition-all flex items-center justify-between group"
          >
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-primary">
                <Layers size={14} className="text-secondary group-hover:text-expense transition-colors" />
                Esta e as subsequentes
              </span>
              <p className="text-[10px] text-secondary mt-1">
                Exclui a parcela atual ({installmentNumber}) e todas as parcelas futuras deste parcelamento.
              </p>
            </div>
            <ArrowRight size={14} className="text-secondary shrink-0 ml-3 motion-standard group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={() => void handleChoice('all')}
            className="w-full text-left p-3.5 rounded-xl border border-glass surface-glass hover:bg-glass-strong transition-all flex items-center justify-between group"
          >
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-primary">
                <Layers size={14} className="text-secondary group-hover:text-expense transition-colors animate-pulse" />
                Todas as parcelas
              </span>
              <p className="text-[10px] text-secondary mt-1">
                Exclui todo o parcelamento (todas as {installmentTotal} parcelas deste grupo).
              </p>
            </div>
            <ArrowRight size={14} className="text-secondary shrink-0 ml-3 motion-standard group-hover:translate-x-1" />
          </button>
        </div>

        <div className="flex justify-end pt-2 border-t border-glass">
          <Button variant="ghost" onClick={onClose} size="sm">
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
