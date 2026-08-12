import fs from 'fs'
import path from 'path'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }

let code = ''
function walk(d) {
  if (!fs.existsSync(d)) return
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git') walk(p)
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(f) && !f.includes('package-lock')) {
      code += fs.readFileSync(p, 'utf8') + '\n'
    }
  }
}
walk('src')
walk('scripts')
for (const f of ['vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'components.json', '.eslintrc.cjs']) {
  if (fs.existsSync(f)) code += fs.readFileSync(f, 'utf8')
}

// Ignora deps de tipos/transpilacao que nunca aparecem como string no codigo
const configOnly = new Set([
  '@types/react',
  '@types/react-dom',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'postcss',
])

console.log('=== DEPENDENCIAS SEM REFERENCIA (runtime) ===')
let found = false
for (const dep of Object.keys(deps).sort()) {
  if (configOnly.has(dep)) continue
  const esc = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(esc).test(code)) {
    found = true
    console.log(' -', dep)
  }
}
if (!found) console.log(' (nenhuma)')
console.log('=== FIM ===')
