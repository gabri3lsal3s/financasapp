/**
 * EmptyPortfolioOnboarding.tsx
 *
 * Estado vazio com stepper de 3 etapas.
 * Substitui o antigo Card com dois botões simples.
 */
import Button from '@/components/Button'
import Card from '@/components/Card'
import { FileSpreadsheet, Plus, Wallet, ArrowRight } from 'lucide-react'

interface EmptyPortfolioOnboardingProps {
  onOpenReconciliation: () => void
  onOpenTxModal: () => void
}

const STEPS = [
  {
    number: '1',
    icon: Wallet,
    title: 'Crie seu saldo em caixa',
    description: 'Registre o valor disponível para investir. Use o ticker CAIXA na criação de um lançamento.',
  },
  {
    number: '2',
    icon: Plus,
    title: 'Lance ou importe seus ativos',
    description: 'Cadastre cada ativo manualmente ou importe direto da B3 via planilha.',
  },
  {
    number: '3',
    icon: FileSpreadsheet,
    title: 'Acompanhe sua rentabilidade',
    description: 'Veja distribuição, rebalanceamento e performance por classe automaticamente.',
  },
]

export default function EmptyPortfolioOnboarding({
  onOpenReconciliation,
  onOpenTxModal,
}: EmptyPortfolioOnboardingProps) {
  return (
    <Card className="p-6 sm:p-8 max-w-2xl mx-auto my-6 animate-page-enter">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-balance/10 flex items-center justify-center text-balance mx-auto mb-4">
          <Wallet size={26} />
        </div>
        <h4 className="text-base font-black text-primary">Sua carteira está vazia</h4>
        <p className="text-xs text-secondary leading-relaxed mt-1.5 max-w-sm mx-auto font-medium">
          Siga os passos abaixo para começar a acompanhar sua alocação e rentabilidade.
        </p>
      </div>

      {/* Stepper */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div
              key={step.number}
              className="flex items-start gap-3.5 p-4 surface-glass border border-glass rounded-2xl"
            >
              {/* Número + linha de conexão */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-7 h-7 rounded-full bg-balance/15 flex items-center justify-center text-balance text-xs font-black">
                  {step.number}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-px h-full min-h-[16px] bg-balance/15 mt-2" />
                )}
              </div>
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-primary/60" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-primary leading-tight">{step.title}</p>
                  <p className="text-[11px] text-secondary leading-relaxed mt-0.5 font-medium">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          type="button"
          variant="income"
          onClick={onOpenReconciliation}
          className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-11 rounded-xl w-full sm:w-auto"
        >
          <FileSpreadsheet size={16} />
          <span>Importar da B3</span>
        </Button>
        <Button
          type="button"
          variant="balance"
          onClick={onOpenTxModal}
          className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-11 rounded-xl w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Cadastrar Manualmente</span>
          <ArrowRight size={14} className="opacity-60" />
        </Button>
      </div>
    </Card>
  )
}
