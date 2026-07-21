import Modal from '@/components/Modal'
import Button from '@/components/Button'
import CurrencyInput from '@/components/CurrencyInput'
import { formatCurrency } from '@/utils/format'
import type { Debt, Expense } from '@/types'

// 1. CONFIRMAR RECEBIMENTO (CRIAR RENDA)
interface IncomeConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onConfirmWithIncome: () => Promise<void>
  onConfirmWithoutIncome: () => Promise<void>
}

export function IncomeConfirmModal({
  isOpen,
  onClose,
  debt,
  onConfirmWithIncome,
  onConfirmWithoutIncome,
}: IncomeConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Recebimento"
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button variant="income" fullWidth onClick={onConfirmWithIncome}>
            Receber e Criar Renda
          </Button>
          <Button variant="outline" fullWidth onClick={onConfirmWithoutIncome}>
            Apenas Receber (sem renda)
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={onClose}
            className="opacity-70 hover:opacity-100"
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-left">
        <div className="modal-info-panel p-4 gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
              Descrição do Recebimento
            </span>
            <span className="text-xs font-bold text-primary truncate max-w-[200px]">
              {debt?.name}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-glass/40 pt-2.5">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
              Valor do Recebimento
            </span>
            <span className="text-base font-extrabold text-income font-mono">
              {debt ? formatCurrency(debt.amount) : ''}
            </span>
          </div>
        </div>

        <div className="modal-alert modal-alert--info text-xs leading-relaxed p-3.5 rounded-xl">
          <p className="font-semibold mb-1">Deseja criar a renda correspondente?</p>
          <p className="opacity-90">
            Se escolher <strong>Receber e Criar Renda</strong>, criaremos uma nova receita automaticamente nas suas Finanças. Caso contrário, a cobrança será apenas marcada como concluída.
          </p>
        </div>
      </div>
    </Modal>
  )
}

// 2. CONFIRMAR RECEBIMENTO INTEGRADO (DESPESA VINCULADA)
interface IntegratedDebtModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  linkedExpense: Expense | null
  reportValueInput: number
  onReportValueChange: (val: number) => void
  onConfirm: () => Promise<void>
}

export function IntegratedDebtModal({
  isOpen,
  onClose,
  debt,
  linkedExpense,
  reportValueInput,
  onReportValueChange,
  onConfirm,
}: IntegratedDebtModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Recebimento Integrado"
      footer={
        <div className="flex w-full flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="income" onClick={onConfirm}>
            Confirmar e Atualizar Despesa
          </Button>
        </div>
      }
    >
      {linkedExpense && debt && (
        <div className="space-y-4">
          <p className="text-sm text-primary text-left">
            Este recebimento está integrado à despesa{' '}
            <strong>"{linkedExpense.description || 'Sem descrição'}"</strong>.
          </p>

          <div className="grid grid-cols-2 gap-4 modal-panel-glass p-3 text-xs text-left">
            <div>
              <span className="text-secondary font-semibold">
                Valor Total da Despesa:
              </span>
              <p className="font-mono text-sm font-bold text-primary">
                {formatCurrency(linkedExpense.amount)}
              </p>
            </div>
            <div>
              <span className="text-secondary font-semibold">
                Valor Atual no Relatório:
              </span>
              <p className="font-mono text-sm font-bold text-primary">
                {formatCurrency(
                  linkedExpense.amount * (linkedExpense.report_weight ?? 1)
                )}
              </p>
            </div>
            <div className="col-span-2 border-t border-glass pt-2 mt-1">
              <span className="text-secondary font-semibold">
                Valor do Pagamento/Recebimento:
              </span>
              <p className="font-mono text-sm font-bold text-income">
                {formatCurrency(debt.amount)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <CurrencyInput
              label="Valor final no relatório da despesa"
              value={reportValueInput}
              onChange={(_e, val) => onReportValueChange(val)}
              required
            />
            <p className="text-[10px] text-secondary">
              * O valor final sugerido acima foi reduzido automaticamente pelo
              pagamento. Você pode editar este valor caso deseje outro peso de
              relatório.
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}

// 3. CONFIRMAR PAGAMENTO DÍVIDA (CADASTRAR DESPESA?)
interface PayableConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onConfirmWithExpense: () => void
  onConfirmWithoutExpense: () => Promise<void>
}

export function PayableConfirmModal({
  isOpen,
  onClose,
  debt,
  onConfirmWithExpense,
  onConfirmWithoutExpense,
}: PayableConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Pagamento"
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button variant="expense" fullWidth onClick={onConfirmWithExpense}>
            Pagar e Cadastrar Despesa
          </Button>
          <Button variant="outline" fullWidth onClick={onConfirmWithoutExpense}>
            Apenas Pagar (sem despesa)
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={onClose}
            className="opacity-70 hover:opacity-100"
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-left">
        <div className="modal-info-panel p-4 gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
              Título da Pendência
            </span>
            <span className="text-xs font-bold text-primary truncate max-w-[200px]">
              {debt?.name}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-glass/40 pt-2.5">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
              Valor do Pagamento
            </span>
            <span className="text-base font-extrabold text-expense font-mono">
              {debt ? formatCurrency(debt.amount) : ''}
            </span>
          </div>
        </div>

        <div className="modal-alert modal-alert--info text-xs leading-relaxed p-3.5 rounded-xl">
          <p className="font-semibold mb-1">Deseja cadastrar a despesa vinculada?</p>
          <p className="opacity-90">
            Ao escolher <strong>Pagar e Cadastrar Despesa</strong>, você criará um
            registro de saída correspondente no fluxo de caixa. Caso contrário, a
            pendência será apenas marcada como paga sem afetar seu fluxo.
          </p>
        </div>
      </div>
    </Modal>
  )
}
