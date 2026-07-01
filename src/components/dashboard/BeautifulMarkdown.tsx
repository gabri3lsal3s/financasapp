import React from 'react'

const parseBoldText = (text: string) => {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      // If it contains currency like R$ or percentage, highlight it beautifully
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

export const BeautifulMarkdown: React.FC<BeautifulMarkdownProps> = ({ text }) => {
  if (!text) return null

  // Split text by lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  return (
    <div className="space-y-2 text-secondary text-xs leading-relaxed">
      {lines.map((line, idx) => {
        // Check if line is a header (starts with ### or ## or #, or starts and ends with **)
        const isHeading3 = line.startsWith('###')
        const isHeading2 = line.startsWith('##') && !isHeading3
        const isHeading1 = line.startsWith('#') && !isHeading2 && !isHeading3
        const isPureBoldHeader = line.startsWith('**') && line.endsWith('**') && line.length > 4 && !line.includes('\n')
        
        if (isHeading1 || isHeading2 || isHeading3 || isPureBoldHeader) {
          const cleanText = line
            .replace(/^#+\s*/, '')
            .replace(/^\*\*(.*)\*\*$/, '$1')
          return (
            <h4
              key={idx}
              className="font-sans font-black text-primary text-xs uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 border-b border-glass pb-1"
            >
              {parseBoldText(cleanText)}
            </h4>
          )
        }

        // Check if line is a bullet point
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*')
        if (isBullet) {
          const cleanedLine = line.replace(/^[•\-\*]\s*/, '')
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 py-0.5">
              <span className="text-primary text-[10px] select-none mt-0.5">•</span>
              <span className="flex-1 text-primary">{parseBoldText(cleanedLine)}</span>
            </div>
          )
        }

        // Regular paragraph line
        return (
          <p key={idx} className="py-0.5 text-primary">
            {parseBoldText(line)}
          </p>
        )
      })}
    </div>
  )
}
