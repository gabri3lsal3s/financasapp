import type { PortfolioPricingMode } from '@/types'

export const PORTFOLIO_PRICING_MODE_OPTIONS: { value: PortfolioPricingMode; label: string }[] = [
  { value: 'market', label: 'Mercado (B3 / cotação)' },
  { value: 'fixed_income', label: 'Renda fixa (valor aplicado)' },
  { value: 'manual_value', label: 'Manual (valor investido + atual)' },
  { value: 'cash', label: 'Saldo em caixa (sem rentabilidade)' },
]

export const ASSET_DEFINITION_SELECT =
  'id, portfolio_id, ticker, pricing_mode, is_b3_linked, applied_amount, contract_rate, indexer, indexer_percent, maturity_date, manual_current_value, manual_value_updated_at, tax_exempt, is_treasury, application_date, created_at, updated_at'
