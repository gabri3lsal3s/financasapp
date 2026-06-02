import Card from '@/components/Card'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import { BarChart3, Percent } from 'lucide-react'

interface BillingReportCardProps {
  portfolioValue: number
  billingFeeRate: number  // monthly rate, eg. 0.1 (representing 0.1%)
  setBillingFeeRate: (rate: number) => void
}

export default function BillingReportCard({
  portfolioValue,
  billingFeeRate,
  setBillingFeeRate,
}: BillingReportCardProps) {
  const monthlyFeeAmount = portfolioValue * (billingFeeRate / 100)
  const annualFeeRate = billingFeeRate * 12

  return (
    <Card className="p-5 lg:p-6 relative overflow-hidden border border-border/40 shadow-sm text-left">
      <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <h3 className="font-bold text-base text-primary flex items-center gap-2 mb-3">
        <BarChart3 size={18} className="text-emerald-500" />
        Simulação de Faturamento
      </h3>

      <div className="p-4 bg-muted/20 rounded-xl border border-border/40 mb-4">
        <div className="flex items-center justify-between text-[10px] text-secondary uppercase tracking-wider mb-1 font-sans">
          <span>Taxa de Gestão Mensal Aplicada</span>
          <span className="font-bold text-emerald-500 font-mono">{formatPercentBR(billingFeeRate, 2)}</span>
        </div>
        <strong className="text-2xl font-black text-primary block font-mono">
          {formatCurrency(monthlyFeeAmount)}
        </strong>
        <span className="text-[10px] text-emerald-500 font-medium block mt-1 font-sans">
          {formatPercentBR(annualFeeRate, 1)} ao ano sobre o patrimônio sob gestão (Fee-Based)
        </span>
      </div>

      {/* Slider de Personalização da Taxa */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider flex items-center gap-1">
            <Percent size={11} className="text-emerald-500" /> Ajustar Taxa Mensal
          </label>
          <span className="text-[11px] font-bold text-primary font-mono">{billingFeeRate}% a.m</span>
        </div>
        <input
          type="range"
          min="0.05"
          max="0.50"
          step="0.01"
          value={billingFeeRate}
          onChange={e => setBillingFeeRate(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500 transition-all hover:bg-muted/80 focus:outline-none"
        />
        <div className="flex justify-between text-[9px] text-secondary font-medium">
          <span>Min (0.05%)</span>
          <span>Max (0.50%)</span>
        </div>
      </div>

      <p className="text-[10px] text-muted font-sans mt-3 leading-relaxed">
        A taxa ajustada aqui é aplicada no cálculo do demonstrativo de faturamento e no relatório PDF da aba Planejamento &amp; PDF.
      </p>
    </Card>
  )
}
