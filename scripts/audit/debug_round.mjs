import fs from 'fs'

const code = fs.readFileSync('src/utils/reportWeight.ts', 'utf8')

let i = 0
let count = 0
while (i < code.length) {
  const idx = code.indexOf('Number(', i)
  if (idx === -1) {
    console.log('fim em i=', i)
    break
  }
  console.log('iteracao: idx=', idx, 'i=', i, 'contexto=', JSON.stringify(code.slice(idx, idx + 30)))
  let depth = 0
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
  const inner = code.slice(idx + 'Number('.length, end)
  const m = inner.match(/\.toFixed\((\d+)\)$/)
  console.log('  inner=', JSON.stringify(inner), 'match=', m)
  if (!m) {
    i = end + 1
    continue
  }
  count++
  i = end + 1
}
console.log('count:', count)
