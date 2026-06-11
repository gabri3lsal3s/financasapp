import Button from '@/components/Button'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { 
  Utensils, Car, Heart, Home, GraduationCap, Smile, ShoppingBag, 
  TrendingUp, Landmark, Award, Tag, AlertTriangle
} from 'lucide-react'

interface ReportsCategoryRowButtonProps {
  categoryId: string
  categoryName: string
  total: number
  color: string
  totalBase: number
  staggerClass?: string
  targetAmount?: number | null
  isExpense?: boolean
  onOpen: (categoryId: string, categoryName: string) => void
}

function getCategoryIcon(name: string, size = 12) {
  const normalized = name.toLowerCase().trim()
  if (normalized.includes('aliment') || normalized.includes('comer') || normalized.includes('restaurante') || normalized.includes('supermercado') || normalized.includes('mercado')) {
    return <Utensils size={size} />
  }
  if (normalized.includes('transp') || normalized.includes('carro') || normalized.includes('combustivel') || normalized.includes('uber') || normalized.includes('moto') || normalized.includes('viagem')) {
    return <Car size={size} />
  }
  if (normalized.includes('saude') || normalized.includes('medico') || normalized.includes('remedio') || normalized.includes('farmacia') || normalized.includes('hospital') || normalized.includes('odonto')) {
    return <Heart size={size} />
  }
  if (normalized.includes('morad') || normalized.includes('casa') || normalized.includes('aluguel') || normalized.includes('condominio') || normalized.includes('luz') || normalized.includes('agua') || normalized.includes('internet') || normalized.includes('tel')) {
    return <Home size={size} />
  }
  if (normalized.includes('educa') || normalized.includes('escola') || normalized.includes('faculdade') || normalized.includes('curso') || normalized.includes('livro') || normalized.includes('estudo')) {
    return <GraduationCap size={size} />
  }
  if (normalized.includes('lazer') || normalized.includes('cinema') || normalized.includes('show') || normalized.includes('festa') || normalized.includes('bar') || normalized.includes('pub')) {
    return <Smile size={size} />
  }
  if (normalized.includes('compras') || normalized.includes('vestuario') || normalized.includes('roupa') || normalized.includes('eletronico') || normalized.includes('shopee') || normalized.includes('amazon')) {
    return <ShoppingBag size={size} />
  }
  if (normalized.includes('salario') || normalized.includes('renda') || normalized.includes('provento') || normalized.includes('receita') || normalized.includes('trabalho')) {
    return <TrendingUp size={size} />
  }
  if (normalized.includes('invest') || normalized.includes('acao') || normalized.includes('fundo') || normalized.includes('poupanca') || normalized.includes('aplicacao')) {
    return <Landmark size={size} />
  }
  if (normalized.includes('premio') || normalized.includes('bonus') || normalized.includes('presente')) {
    return <Award size={size} />
  }
  return <Tag size={size} />
}

export default function ReportsCategoryRowButton({
  categoryId,
  categoryName,
  total,
  color,
  totalBase,
  staggerClass = '',
  targetAmount,
  isExpense = true,
  onOpen,
}: ReportsCategoryRowButtonProps) {
  const sharePct = totalBase > 0 ? (total / totalBase) * 100 : 0
  const icon = getCategoryIcon(categoryName, 12)

  // Cálculos de orçamento / meta
  const hasTarget = targetAmount !== undefined && targetAmount !== null && targetAmount > 0
  const targetPct = hasTarget ? (total / targetAmount!) * 100 : 0
  const targetExceeded = isExpense ? total > targetAmount! : false

  // Cor do indicador do orçamento
  const targetColorClass = isExpense 
    ? (targetPct > 100 ? 'text-expense font-bold' : targetPct > 80 ? 'text-warning font-semibold' : 'text-secondary')
    : (targetPct >= 100 ? 'text-income font-bold' : 'text-secondary')

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => onOpen(categoryId, categoryName)}
      className={`w-full h-auto text-left flex-col items-stretch p-2.5 animate-stagger-item transition-all hover:scale-[1.005] hover:border-glass-strong surface-glass ${staggerClass}`}
    >
      {/* Linha 1: Categoria + Ícone (Esquerda) e Valor (Direita) */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <span 
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" 
            style={{ backgroundColor: `${color}15`, color: color }}
          >
            {icon}
          </span>
          <span className="text-xs font-semibold text-primary truncate">{categoryName}</span>
        </div>

        <span className="text-xs font-bold text-primary font-mono shrink-0">
          {formatCurrency(total)}
        </span>
      </div>

      {/* Linha 2: Detalhamento de Percentuais e Limites */}
      <div className="text-[9px] text-secondary font-medium mt-1 truncate">
        {formatNumberWithTwoDecimalsBR(sharePct)}% do total
        {hasTarget && (
          <>
            {' • '}
            <span className={targetColorClass}>
              {formatNumberWithTwoDecimalsBR(targetPct)}% {isExpense ? 'limite' : 'meta'}
            </span>
            {targetExceeded && (
              <AlertTriangle size={10} className="inline-block text-expense ml-0.5 align-text-top" />
            )}
          </>
        )}
      </div>

      {/* Linha 3: Barra de distribuição principal */}
      <div className="w-full h-1 rounded-full bg-secondary/20 mt-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${sharePct}%`, backgroundColor: color }} />
      </div>
    </Button>
  )
}

