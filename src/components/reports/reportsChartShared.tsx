import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { PAGE_HEADERS } from '@/constants/pages'
import Loader from '@/components/Loader'
import { useReports } from '@/hooks/useReports'
import { useIncomeReports } from '@/hooks/useIncomeReports'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useIncomeCategoryExpectations } from '@/hooks/useIncomeCategoryExpectations'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useAppSettings } from '@/hooks/useAppSettings'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import { portfolioInvestmentByDay } from '@/utils/portfolioMonthlyFlow'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { addMonths, clampMonthToAppStart, formatCurrency, formatDate, formatMonth, formatMonthShort, formatNumberBR, formatNumberWithTwoDecimalsBR, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { Scale, Loader2 } from 'lucide-react'
import SegmentedControl from '@/components/SegmentedControl'
import HeroMetric from '@/components/HeroMetric'
import type { ChartTooltipEntry } from '@/types/recharts'
import type { Props as LegendContentProps } from 'recharts/types/component/DefaultLegendContent'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import { useSearchParams } from 'react-router-dom'
type ViewMode = 'year' | 'month'
type ReportSectionTab = 'flow' | 'categories' | 'cards' | 'investments'
type DetailType = 'expense' | 'income' | 'payment_method' | 'credit_card'

const VIEW_MODE_OPTIONS = [
  { value: 'month' as const, label: 'Mês' },
  { value: 'year' as const, label: 'Ano' },
]

const SECTION_TAB_OPTIONS = [
  { value: 'flow' as const, label: 'Fluxo' },
  { value: 'categories' as const, label: 'Categorias' },
  { value: 'cards' as const, label: 'Cartões' },
  { value: 'investments' as const, label: 'Investimentos' },
]

type MonthlySummary = {
  month: string
  total_income: number
  total_expenses: number
  total_investments: number
  balance: number
}

type ExpenseCategorySummary = {
  category_id: string
  category_name: string
  total: number
  color: string
}

type IncomeCategorySummary = {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

type PieDatum = {
  name: string
  value: number
  color: string
  categoryId?: string
  detailType?: DetailType
  detailPeriod?: 'month' | 'year'
}

type TrendSeriesMeta = {
  key: string
  name: string
  color: string
}

type DetailModalState = {
  isOpen: boolean
  type: DetailType
  categoryId: string
  categoryName: string
  period: 'month' | 'year'
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit_card: 'Cartão de Crédito',
  pix: 'Pix',
  transfer: 'Transferência',
  other: 'Outros',
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: 'var(--payment-method-cash)',
  debit: 'var(--payment-method-debit)',
  credit_card: 'var(--payment-method-credit-card)',
  pix: 'var(--payment-method-pix)',
  transfer: 'var(--payment-method-transfer)',
  other: 'var(--payment-method-other)',
}

const DETAIL_ITEMS_STEP = 8

type DetailExpenseEntry = {
  id: string
  amount: number
  report_weight?: number | null
  category_id: string
  date: string
  description?: string | null
  category?: {
    name?: string | null
  } | null
}

type DetailIncomeEntry = {
  id: string
  amount: number
  report_weight?: number | null
  income_category_id: string
  date: string
  description?: string | null
  income_category?: {
    name?: string | null
  } | null
}

function ChartTooltip({ active, payload, formatValue = formatCurrency }: { active?: boolean; payload?: ChartTooltipEntry[]; formatValue?: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="text-sm font-medium">
          {entry.name}: {formatValue(Number(entry.value))}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: ChartTooltipEntry[] }) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload as { name?: string; value?: number } | undefined
  if (!point) return null

  return (
    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
      <p className="text-sm font-medium text-primary">{point.name}</p>
      <p className="text-sm text-secondary">{formatCurrency(Number(point.value ?? 0))}</p>
    </div>
  )
}
