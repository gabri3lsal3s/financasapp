import fs from 'fs'
import path from 'path'

const root = 'src'

function walk(d) {
  let out = []
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (/\.(ts|tsx)$/.test(f)) out.push(p)
  }
  return out
}

// Todas as fontes (inclui testes — eles importam módulos)
const files = walk(root)

// Coleta TODOS os targets de import (inclusive de arquivos de teste)
const imported = new Set()
const re = /(?:from\s+|import\s*\(\s*)(['"])([^'"]+)\1/g
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(c))) {
    const spec = m[2]
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(f), spec)
    const candidates = [
      base,
      base + '.ts',
      base + '.tsx',
      base + '.js',
      base + '.jsx',
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
    ]
    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand)) imported.add(path.resolve(cand))
      } catch {}
    }
  }
}

// Entry points e arquivos de infra que não são importados por ninguém
const exempt = ['main.tsx', 'App.tsx', 'vite-env.d.ts']

const orphans = files.filter(
  (f) =>
    !imported.has(path.resolve(f)) &&
    !exempt.some((e) => f.endsWith(e)) &&
    !f.includes('__snapshots__') &&
    !f.includes('.test.')
)

console.log('=== ORFAOS REAIS (nenhum import em todo src, inclusive testes) ===')
orphans.forEach((f) => console.log(' -', f))
console.log('TOTAL:', orphans.length)
