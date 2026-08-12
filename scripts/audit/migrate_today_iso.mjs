import fs from 'fs'

const FILES = [
  'src/components/creditCards/BillPaymentModal.tsx',
  'src/components/creditCards/RefundModal.tsx',
  'src/components/debts/DebtFormModal.tsx',
  'src/components/investments/PortfolioTransactionFormModal.tsx',
  'src/components/ExpenseFormModal.tsx',
  'src/components/IncomeFormModal.tsx',
  'src/components/contas/ContasModals.tsx',
  'src/contexts/NotificationsContext.tsx',
  'src/hooks/useExpenses.ts',
  'src/hooks/useIncomes.ts',
]

const TODAY_PATTERN = /format\(\s*new Date\(\)\s*,\s*'yyyy-MM-dd'\s*\)/g

for (const file of FILES) {
  let code = fs.readFileSync(file, 'utf8')
  const before = (code.match(TODAY_PATTERN) || []).length
  if (before === 0) {
    console.log(`[skip] ${file} (sem ocorrências)`)
    continue
  }

  code = code.replace(TODAY_PATTERN, 'todayISO()')

  // Adiciona todayISO ao import existente de '@/utils/format'
  const formatImportMatch = code.match(/import\s*\{([^}]*)\}\s*from\s*'@\/utils\/format'/)
  if (formatImportMatch) {
    if (!formatImportMatch[1].includes('todayISO')) {
      code = code.replace(
        formatImportMatch[0],
        formatImportMatch[0].replace(/([^}]*)\}/, `$1, todayISO }`)
      )
    }
  } else {
    // Sem import de format.ts: cria um novo (antes do import de date-fns)
    const dfImport = code.match(/^import\s*\{[^}]*format[^}]*\}\s*from\s*'date-fns'.*$/m)
    if (dfImport) {
      code = code.replace(
        dfImport[0],
        `import { todayISO } from '@/utils/format'\n${dfImport[0]}`
      )
    } else {
      code = `import { todayISO } from '@/utils/format'\n${code}`
    }
  }

  // Remove `format` do import de date-fns se não for mais usado no arquivo
  const dfImport = code.match(/^import\s*\{([^}]*)\}\s*from\s*'date-fns'.*$/m)
  if (dfImport) {
    const names = dfImport[1].split(',').map((s) => s.trim())
    const stillUsed = names.filter(
      (n) => n && !(n === 'format' && !new RegExp(`\\bformat\\(`).test(code.replace(dfImport[0], '')))
    )
    if (stillUsed.length === 0) {
      code = code.replace(dfImport[0] + '\n', '')
    } else if (stillUsed.length !== names.length) {
      code = code.replace(dfImport[0], `import { ${stillUsed.join(', ')} } from 'date-fns'`)
    }
  }

  fs.writeFileSync(file, code)
  console.log(`[ok] ${file}: ${before} ocorrências migradas`)
}
