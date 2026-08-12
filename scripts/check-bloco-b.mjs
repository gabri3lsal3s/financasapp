// Verificação de segurança do Bloco B (R7+): AmountText em contexto string
import fs from 'fs'

const files = [
  'src/components/dashboard/details/FinancialHealthDetail.tsx',
  'src/components/dashboard/details/SubscriptionsDetail.tsx',
  'src/components/dashboard/details/CategoryBreakdownDetail.tsx',
  'src/components/dashboard/details/LimitsOverviewDetail.tsx',
  'src/components/dashboard/details/RecurringExpenseDetailModal.tsx',
  'src/components/dashboard/DashboardCategoryDetailModal.tsx',
  'src/components/reports/CategoryDetailModal.tsx',
  'src/components/reports/MonthlyReportView.tsx',
  'src/components/reports/AnnualReportView.tsx',
  'src/components/reports/ReportPendingDebtsWidget.tsx',
  'src/components/reports/ReportUnifiedCompositionCard.tsx',
  'src/components/reports/ReportsCategoryRowButton.tsx',
]

let issues = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const lines = src.split('\n')

  // 1. AmountText dentro de template string literal
  lines.forEach((l, i) => {
    if (l.includes('<AmountText') && l.includes('${')) {
      issues.push(`${f}:${i + 1} AmountText em template string`)
    }
  })

  // 2. AmountText dentro de atributos string (title="...", aria-label="...")
  lines.forEach((l, i) => {
    const m = l.match(/(title|aria-label|placeholder|data-tip)="[^"]*<AmountText/)
    if (m) issues.push(`${f}:${i + 1} AmountText dentro de atributo string (${m[1]})`)
  })

  // 3. AmountText dentro de SVG <text>
  lines.forEach((l, i) => {
    if (l.includes('<text') && lines.slice(Math.max(0, i - 2), i + 1).join(' ').includes('<AmountText')) {
      issues.push(`${f}:${i + 1} AmountText perto de SVG <text>`)
    }
  })
}

if (issues.length === 0) {
  console.log('OK: nenhum AmountText em contexto string nos arquivos do Bloco B')
} else {
  console.log('PROBLEMAS:')
  issues.forEach(i => console.log(' - ' + i))
  process.exit(1)
}
