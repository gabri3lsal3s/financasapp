import type { ReactNode } from 'react'
import {
  AlertTriangle, TrendingDown, TrendingUp, Sparkles,
  Calendar, PiggyBank, CheckCircle2, CreditCard,
  Target, Receipt,
} from 'lucide-react'

/**
 * Resolve um iconId (string) para um elemento JSX de ícone.
 * Usado pelo Dashboard para renderizar os ícones dos insights sem trazer JSX para dentro do hook.
 */
export function resolveIcon(iconId: string): ReactNode {
  switch (iconId) {
    case 'alert-triangle-expense':
      return <AlertTriangle size={14} className="text-expense" />
    case 'trending-down-income':
      return <TrendingDown size={14} className="text-income" />
    case 'trending-up-primary':
      return <TrendingUp size={14} className="text-primary" />
    case 'trending-up-expense':
      return <TrendingUp size={14} className="text-expense" />
    case 'trending-up-warning':
      return <TrendingUp size={14} className="text-warning" />
    case 'sparkles-primary':
      return <Sparkles size={14} className="text-primary" />
    case 'calendar-primary':
      return <Calendar size={14} className="text-primary" />
    case 'piggy-bank-balance':
      return <PiggyBank size={14} className="text-balance" />
    case 'piggy-bank-primary':
      return <PiggyBank size={14} className="text-primary" />
    case 'check-circle-income':
      return <CheckCircle2 size={14} className="text-income" />
    case 'credit-card-balance':
      return <CreditCard size={14} className="text-balance" />
    case 'target-primary':
      return <Target size={14} className="text-primary" />
    case 'receipt-income':
      return <Receipt size={14} className="text-income" />
    default:
      return <AlertTriangle size={14} className="text-expense" />
  }
}
