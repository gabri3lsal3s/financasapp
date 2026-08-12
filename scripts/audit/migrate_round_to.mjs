import fs from 'fs'

const FILES = [
  'src/hooks/usePortfolioState.ts',
  'src/utils/creditCardBilling.ts',
  'src/utils/creditCardCsvLearning.ts',
  'src/utils/creditCardCsvReconciliation.ts',
  'src/utils/reportWeight.ts',
  'src/utils/quantamentalEngine.ts',
  'src/utils/rebalanceSimulator.ts',
]

/** Substitui Number(<expr>.toFixed(<n>)) por roundToDecimals(<expr>, <n>) usando balanceamento de parênteses. */
function migrate(code) {
  const out = []
  let i = 0
  let count = 0
  while (i < code.length) {
    const idx = code.indexOf('Number(', i)
    if (idx === -1) {
      out.push(code.slice(i))
      break
    }
    out.push(code.slice(i, idx))

    // Encontra o fim do Number(...) balanceado (o '(' de Number( já abre o nível 1)
    let depth = 1
    let j = idx + 'Number('.length
    let end = -1
    for (; j < code.length; j++) {
      if (code[j] === '(') depth++
      else if (code[j] === ')') {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end === -1) {
      out.push(code.slice(idx))
      break
    }

    const inner = code.slice(idx + 'Number('.length, end) // conteúdo dentro do Number( )
    // inner deve terminar com .toFixed(<n>)
    const m = inner.match(/\.toFixed\((\d+)\)$/)
    if (!m) {
      out.push(code.slice(idx, end + 1))
      i = end + 1
      continue
    }
    const expr = inner.slice(0, inner.length - m[0].length)
    const digits = m[1]
    out.push(`roundToDecimals(${expr}, ${digits})`)
    count++
    i = end + 1
  }
  return { code: out.join(''), count }
}

for (const file of FILES) {
  const code = fs.readFileSync(file, 'utf8')
  const { code: migrated, count } = migrate(code)
  if (count === 0) {
    console.log(`[skip] ${file}`)
    continue
  }

  // Adiciona roundToDecimals ao import existente de '@/utils/format' ou cria import
  let final = migrated
  const fmtImport = final.match(/import\s*\{([^}]*)\}\s*from\s*'@\/utils\/format'/)
  if (fmtImport) {
    if (!fmtImport[1].includes('roundToDecimals')) {
      final = final.replace(fmtImport[0], fmtImport[0].replace(/([^}]*)\}/, '$1, roundToDecimals }'))
    }
  } else {
    final = `import { roundToDecimals } from '@/utils/format'\n${final}`
  }

  fs.writeFileSync(file, final)
  console.log(`[ok] ${file}: ${count} ocorrências`)
}
