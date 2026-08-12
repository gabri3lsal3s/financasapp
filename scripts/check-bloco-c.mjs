// Mapa de contextos de formatCurrency nos arquivos do Bloco C
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

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const lines = src.split('\n')
  let hits = []
  lines.forEach((l, i) => {
    if (l.includes('formatCurrency(')) hits.push(i)
  })
  if (hits.length === 0) continue
  console.log(`\n${'='.repeat(70)}\n### ${f} (${hits.length} usos)\n${'='.repeat(70)}`)
  for (const i of hits) {
    const ctx = lines.slice(Math.max(0, i - 2), i + 2).join('\n')
    console.log(`--- linha ${i + 1} ---\n${ctx}`)
  }
}
