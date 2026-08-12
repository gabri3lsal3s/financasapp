// Verificação final do Bloco C (R7+): AmountText em contexto string + formatCurrency restantes
import fs from 'fs'

const dirs = [
  'src/components/categories',
  'src/components/creditCards',
  'src/components/debts',
  'src/components/investments',
  'src/components/transactions',
]
const extra = ['src/components/TransactionFormModal.tsx']

const files = []
for (const d of dirs) {
  for (const f of fs.readdirSync(d)) {
    if (f.endsWith('.tsx')) files.push(`${d}/${f}`)
  }
}
files.push(...extra)

let problems = []
const remainingFormat = []

for (const f of files) {
  if (!fs.existsSync(f)) continue
  const src = fs.readFileSync(f, 'utf8')
  const lines = src.split('\n')

  lines.forEach((l, i) => {
    if (l.includes('<AmountText') && l.includes('${')) {
      problems.push(`${f}:${i + 1} AmountText em template string`)
    }
    const m = l.match(/(title|aria-label|placeholder)="[^"]*<AmountText/)
    if (m) problems.push(`${f}:${i + 1} AmountText em atributo string (${m[1]})`)
  })

  const count = src.split('formatCurrency(').length - 1
  if (count > 0) remainingFormat.push(`${count}  ${f}`)
}

console.log('=== formatCurrency restantes (esperado: só string-context) ===')
console.log(remainingFormat.join('\n') || '(nenhum)')

if (problems.length > 0) {
  console.log('\nPROBLEMAS:')
  problems.forEach(p => console.log(' - ' + p))
  process.exit(1)
}
console.log('\nOK: nenhum AmountText em contexto string')
