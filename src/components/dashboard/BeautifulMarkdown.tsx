const parseBoldText = (text: string) => {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      const isCurrency = /R\$\s*-?\d+/.test(content) || /\d+%/.test(content)
      if (isCurrency) {
        return (
          <span
            key={idx}
            className="bg-primary/10 text-primary font-extrabold px-1.5 py-0.5 rounded-md font-mono text-[10px] mx-0.5 inline-block align-middle whitespace-nowrap border border-primary/15"
          >
            {content}
          </span>
        )
      }
      return (
        <strong key={idx} className="font-extrabold text-primary">
          {content}
        </strong>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

interface BeautifulMarkdownProps {
  text: string
}

function isHeaderLine(line: string): boolean {
  return (
    line.startsWith('###') ||
    line.startsWith('## ') ||
    line.startsWith('# ') ||
    (line.startsWith('**') &&
      line.endsWith('**') &&
      line.length > 4 &&
      !line.includes('\n') &&
      line.indexOf('**', 2) === line.length - 2)
  )
}

function extractHeaderText(line: string): string {
  return line
    .replace(/^###\s*/, '')
    .replace(/^##\s*/, '')
    .replace(/^#\s*/, '')
    .replace(/^\*\*(.*)\*\*$/, '$1')
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|')
}

function isTableSeparator(line: string): boolean {
  return isTableRow(line) && /^\|[-:\s|]+\|$/.test(line)
}

function renderTableRow(
  cells: string[],
  isHeader: boolean,
): React.ReactNode {
  const Tag = isHeader ? 'th' : 'td'
  const cellClass = isHeader
    ? 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-secondary text-left'
    : 'px-3 py-2 text-[11px] font-medium text-primary'

  return (
    <tr key={Math.random()}>
      {cells.map((cell, ci) => (
        <Tag key={ci} className={cellClass}>
          {parseBoldText(cell.trim())}
        </Tag>
      ))}
    </tr>
  )
}

export const BeautifulMarkdown = ({ text }: BeautifulMarkdownProps) => {
  if (!text) return null

  const lines = text.split('\n').map((l) => l.trim())

  // Group lines into blocks (paragraphs, tables, etc.)
  const blocks: React.ReactNode[] = []
  let currentTableRows: string[] = []
  let inTable = false

  const flushTable = () => {
    if (currentTableRows.length < 2) {
      // Not a valid table — render as regular lines
      currentTableRows.forEach((row) => {
        blocks.push(
          <p key={blocks.length} className="py-0.5 text-primary text-xs">
            {parseBoldText(row)}
          </p>,
        )
      })
      currentTableRows = []
      inTable = false
      return
    }

    // First row is header, second is separator, rest are data
    const headerCells = currentTableRows[0]
      .split('|')
      .filter((c) => c.length > 0)
    const dataRows = currentTableRows.slice(2)

    blocks.push(
      <div key={blocks.length} className="overflow-x-auto -mx-1 my-2">
        <table className="w-full border-collapse">
          <thead>
            {renderTableRow(headerCells, true)}
          </thead>
          <tbody>
            {dataRows.map((row) => {
              const cells = row.split('|').filter((c) => c.length > 0)
              return renderTableRow(cells, false)
            })}
          </tbody>
        </table>
      </div>,
    )
    currentTableRows = []
    inTable = false
  }

  lines.forEach((line) => {
    // Check for table row
    if (isTableRow(line)) {
      if (!inTable) {
        flushTable() // Flush any previous non-table block
        inTable = true
      }
      currentTableRows.push(line)
      return
    }

    // If we were in a table, flush it
    if (inTable) {
      flushTable()
    }

    // Empty line — skip but don't create a paragraph
    if (line.length === 0) return

    // Separator line
    if (line === '---' || line === '___' || line === '***') {
      blocks.push(
        <hr
          key={blocks.length}
          className="border-t border-glass/40 my-3"
        />,
      )
      return
    }

    // Header
    if (isHeaderLine(line)) {
      const cleanText = extractHeaderText(line)
      blocks.push(
        <h4
          key={blocks.length}
          className="font-sans font-black text-primary text-xs uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 border-b border-glass pb-1"
        >
          {parseBoldText(cleanText)}
        </h4>,
      )
      return
    }

    // Bullet point
    const isBullet =
      line.startsWith('•') || line.startsWith('-') || line.startsWith('*')
    if (isBullet) {
      const cleanedLine = line.replace(/^[•\-*]\s*/, '')
      blocks.push(
        <div
          key={blocks.length}
          className="flex items-start gap-2 pl-1.5 py-0.5"
        >
          <span className="text-primary text-[10px] select-none mt-0.5 shrink-0">
            •
          </span>
          <span className="flex-1 text-primary text-xs">
            {parseBoldText(cleanedLine)}
          </span>
        </div>,
      )
      return
    }

    // Regular paragraph
    blocks.push(
      <p key={blocks.length} className="py-0.5 text-primary text-xs leading-relaxed">
        {parseBoldText(line)}
      </p>,
    )
  })

  // Flush remaining table
  if (inTable) {
    flushTable()
  }

  return <div className="space-y-1 text-secondary">{blocks}</div>
}
