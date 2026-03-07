import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const SRC_DIR = path.join(ROOT_DIR, 'src')
const BASELINE_PATH = path.join(ROOT_DIR, 'docs', 'ui', 'guardrails-baseline.json')

const FILE_EXTENSIONS = new Set(['.ts', '.tsx'])

const RULES = [
  {
    id: 'ui-no-direct-number-formatting',
    description: 'Evitar formatação direta com toFixed/toLocaleString em UI e mensagens; usar utilitários centrais.',
    appliesTo: (relativePath) =>
      relativePath.startsWith('src/pages/') ||
      relativePath.startsWith('src/components/') ||
      relativePath.startsWith('src/services/assistantService.ts'),
    regex: /\.toFixed\(|\.toLocaleString\(/g,
  },
  {
    id: 'ui-no-raw-hex-color',
    description: 'Evitar cores HEX hardcoded; usar tokens do design system.',
    appliesTo: (relativePath) => relativePath.startsWith('src/'),
    regex: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    id: 'ui-no-native-control-in-pages',
    description: 'Evitar controles nativos em páginas; preferir primitives compartilhadas.',
    appliesTo: (relativePath) => relativePath.startsWith('src/pages/') && relativePath.endsWith('.tsx'),
    regex: /<(input|select|textarea|button)\b/g,
  },
]

function listFilesRecursively(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath))
      continue
    }

    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue
    }

    files.push(entryPath)
  }

  return files
}

function countLineAtIndex(content, index) {
  return content.slice(0, index).split('\n').length
}

function sanitizeSnippet(text) {
  return text.trim().replace(/\s+/g, ' ').slice(0, 100)
}

function collectViolations() {
  const sourceFiles = listFilesRecursively(SRC_DIR)
  const violations = []

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(ROOT_DIR, filePath).split(path.sep).join('/')
    const content = fs.readFileSync(filePath, 'utf-8')

    for (const rule of RULES) {
      if (!rule.appliesTo(relativePath)) {
        continue
      }

      for (const match of content.matchAll(rule.regex)) {
        const matchedText = match[0]
        const index = match.index ?? 0
        const line = countLineAtIndex(content, index)
        const snippet = sanitizeSnippet(content.slice(index, index + 120))

        violations.push({
          key: `${rule.id}|${relativePath}|${line}|${matchedText}`,
          ruleId: rule.id,
          description: rule.description,
          file: relativePath,
          line,
          match: matchedText,
          snippet,
        })
      }
    }
  }

  return violations.sort((a, b) => a.key.localeCompare(b.key))
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return []
  }

  const content = fs.readFileSync(BASELINE_PATH, 'utf-8')
  const parsed = JSON.parse(content)
  if (!Array.isArray(parsed.violations)) {
    return []
  }

  return parsed.violations
}

function saveBaseline(violations) {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    rules: RULES.map((rule) => ({
      id: rule.id,
      description: rule.description,
    })),
    violations: violations.map(({ key, ruleId, file, line, match }) => ({
      key,
      ruleId,
      file,
      line,
      match,
    })),
  }

  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

function printViolations(violations, heading) {
  if (violations.length === 0) {
    console.log(`${heading}: nenhuma ocorrência.`)
    return
  }

  console.log(`${heading}: ${violations.length} ocorrência(s).`)
  for (const violation of violations.slice(0, 50)) {
    console.log(`- [${violation.ruleId}] ${violation.file}:${violation.line} -> ${violation.snippet}`)
  }

  if (violations.length > 50) {
    console.log(`... e mais ${violations.length - 50} ocorrência(s).`)
  }
}

function main() {
  const shouldUpdateBaseline = process.argv.includes('--update-baseline')

  const currentViolations = collectViolations()

  if (shouldUpdateBaseline) {
    saveBaseline(currentViolations)
    console.log(`Baseline atualizada com ${currentViolations.length} ocorrência(s) em docs/ui/guardrails-baseline.json.`)
    process.exit(0)
  }

  const baselineEntries = loadBaseline()
  const baselineKeys = new Set(baselineEntries.map((item) => item.key))

  const newViolations = currentViolations.filter((item) => !baselineKeys.has(item.key))

  printViolations(newViolations, 'Novas violações de UI guardrails')

  if (newViolations.length > 0) {
    console.error('\nFalha de governança UI: normalize o código ou atualize a baseline conscientemente com `npm run guardrails:ui:baseline`.')
    process.exit(1)
  }

  console.log('UI guardrails OK: nenhuma nova violação além da baseline.')
}

main()
