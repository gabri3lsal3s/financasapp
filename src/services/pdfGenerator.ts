import { jsPDF } from 'jspdf'
import { Portfolio, PortfolioGroupTarget } from '@/types'
import { AssetPosition, PerformanceMetrics, calculateConsolidatedByClass, calculateConsolidatedBySector } from '@/services/investmentEngine'

interface PDFData {
  clientName: string          // nome para exibição (display name)
  portfolio: Portfolio
  positions: AssetPosition[]
  shareHistory: { date: string; shareValue: number }[]
  metrics: PerformanceMetrics
  theses: Record<string, string>
  cashBalance: number
  groupTargets?: PortfolioGroupTarget[]
  executiveSummary?: string
  nextMonthPlan?: string
  billingFeeRate?: number
}

/**
 * Gera um relatório institucional em PDF vetorial de altíssima nitidez usando jsPDF.
 */
export async function generateConsultingPDF(data: PDFData): Promise<void> {
  const { clientName, positions, shareHistory, metrics, theses, cashBalance, groupTargets, executiveSummary, nextMonthPlan, billingFeeRate = 0.1 } = data

  // Atenção: ativos com drift > 5% em relação à meta
  const attentionAssets = positions.filter(p => Math.abs(p.current_percentage - p.target_percentage) > 5)
  
  // Cria o documento PDF (formato A4, unidade em milímetros)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Cores institucionais do Cerrado
  const COLOR_PRIMARY = [6, 95, 70]   // Verde Esmeralda Escuro #065f46
  const COLOR_SECONDARY = [30, 41, 59] // Slate Escuro #1e293b
  const COLOR_ACCENT = [217, 119, 6]  // Dourado/Amber #d97706
  const COLOR_MUTED = [100, 116, 139]  // Slate Muted #64748b
  const COLOR_BG_LIGHT = [248, 250, 252] // Cinza Fundo #f8fafc

  const portfolioValue = positions.reduce((sum, p) => sum + p.total_value, 0) + cashBalance
  const totalYieldPct = shareHistory.length > 0 ? (shareHistory[shareHistory.length - 1].shareValue - 1) * 100 : 0
  const competenceMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()

  // Calcula número total de páginas dinamicamente
  const thesesForPageCount = positions.filter(pos => theses[pos.ticker])
  const thesisPages = thesesForPageCount.length > 0 ? Math.ceil(thesesForPageCount.length / 5) : 1
  const hasAttentionSection = attentionAssets.length > 0
  const totalPages = 4 + thesisPages + (hasAttentionSection ? 1 : 0)

  // ==========================================
  // PÁGINA 1: CAPA INSTITUCIONAL E ELEGANTE
  // ==========================================
  
  // Fundo sutil com gradiente na borda esquerda
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(0, 0, 8, pageHeight, 'F')

  // Elemento decorativo dourado na capa
  doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.rect(8, 0, 2, pageHeight, 'F')

  // Logo da Consultoria do Cerrado (Vetorial geométrico - Losango desenhado com triângulos nativos)
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.triangle(45, 60, 60, 45, 75, 60, 'F')
  doc.triangle(45, 60, 60, 75, 75, 60, 'F')
  
  doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.triangle(52, 60, 60, 52, 68, 60, 'F')
  doc.triangle(52, 60, 60, 68, 68, 60, 'F')

  // Título e Subtítulos
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('CERRADO ASSET MANAGEMENT', 45, 95)
  
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(14)
  doc.text('Relatório Mensal de Consultoria Patrimonial', 45, 105)

  // Linha horizontal divisória
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(45, 115, pageWidth - 30, 115)

  // Bloco de Metadados da Capa
  doc.setFontSize(10)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.text('PREPARADO PARA:', 45, 140)
  
  doc.setFontSize(14)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(clientName.toUpperCase(), 45, 147)

  doc.setFontSize(10)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('COMPETÊNCIA:', 45, 165)
  
  doc.setFontSize(12)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(competenceMonth, 45, 172)

  doc.setFontSize(10)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('GESTOR DE CONTA:', 45, 190)
  
  doc.setFontSize(12)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('ASSESSORIA METODOLOGIA DO CERRADO', 45, 197)

  // Rodapé institucional da capa
  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')

  // Sumário Executivo na Capa (se fornecido)
  if (executiveSummary && executiveSummary.trim()) {
    const summaryY = 215
    doc.setDrawColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
    doc.setLineWidth(0.3)
    doc.line(45, summaryY - 4, pageWidth - 30, summaryY - 4)

    doc.setFontSize(8)
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    doc.setFont('Helvetica', 'normal')
    doc.text('SUMÁRIO EXECUTIVO', 45, summaryY)

    doc.setFontSize(8.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    const splitSummary = doc.splitTextToSize(executiveSummary.trim(), pageWidth - 75)
    const summaryLines = splitSummary.slice(0, 6) // Máximo 6 linhas na capa
    doc.text(summaryLines, 45, summaryY + 6)

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(45, summaryY + 6 + summaryLines.length * 4.5 + 4, pageWidth - 30, summaryY + 6 + summaryLines.length * 4.5 + 4)
  }

  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('Este relatório contém informações confidenciais destinadas exclusivamente ao cliente identificado acima.', 45, pageHeight - 30)
  doc.text('Cerrado Asset Management Ltda. Todos os direitos reservados 2026.', 45, pageHeight - 25)

  // Aviso de pontos de atenção na capa (se houver)
  if (attentionAssets.length > 0) {
    doc.setFontSize(8)
    doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.setFont('Helvetica', 'bold')
    doc.text(`⚠  ${attentionAssets.length} ativo(s) com desvio > 5% da meta — ver Pontos de Atenção.`, 45, pageHeight - 40)
  }

  // ==========================================
  // PÁGINA 2: COMPOSIÇÃO E METODOLOGIA CERRADO
  // ==========================================
  doc.addPage()
  
  // Cabeçalho Padrão das Páginas Seguintes
  drawPageHeader(doc, 'COMPOSIÇÃO PATRIMONIAL & ALOCAÇÃO', competenceMonth)

  // 1. Grid de Resumos Financeiros (Cards)
  // Card 1: Patrimônio Líquido
  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(20, 42, 52, 20, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('PATRIMÔNIO LÍQUIDO', 25, 48)
  doc.setFontSize(11)
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(`R$ ${portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, 56)

  // Card 2: Saldo em Caixa
  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(79, 42, 52, 20, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('SALDO EM CAIXA', 84, 48)
  doc.setFontSize(11)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(`R$ ${cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 84, 56)

  // Card 3: Rentabilidade Acumulada
  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(138, 42, 52, 20, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('RENTABILIDADE (COTA)', 143, 48)
  doc.setFontSize(11)
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(`+${totalYieldPct.toFixed(2)}%`, 143, 56)

  // 2. Tabela de Ativos da Carteira
  let currentY = 74
  doc.setFontSize(10)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Demonstrativo de Exposição e Metas do Cerrado', 20, currentY)
  
  currentY += 6
  // Cabeçalho da Tabela
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(20, currentY, pageWidth - 40, 8, 'F')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text('ATIVO', 24, currentY + 5.5)
  doc.text('QUANTIDADE', 58, currentY + 5.5)
  doc.text('CUSTO MÉDIO', 88, currentY + 5.5)
  doc.text('COTAÇÃO', 118, currentY + 5.5)
  doc.text('EXPOSIÇÃO REAL', 148, currentY + 5.5)
  doc.text('ALVO (CERRADO)', 175, currentY + 5.5)

  currentY += 8
  
  // Agrupa posições por classe de ativo
  const positionsByClass: Record<string, AssetPosition[]> = {}
  for (const pos of positions) {
    const className = pos.asset_class || 'Renda Fixa'
    if (!positionsByClass[className]) {
      positionsByClass[className] = []
    }
    positionsByClass[className].push(pos)
  }

  // Linhas da tabela agrupadas
  doc.setFontSize(8)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  
  let rowIdx = 0
  for (const [className, classPositions] of Object.entries(positionsByClass)) {
    // Linha de cabeçalho do grupo (Classe de Ativos)
    doc.setFillColor(241, 245, 249) // Cinza claro
    doc.rect(20, currentY, pageWidth - 40, 6.5, 'F')
    
    // Pequena barra decorativa dourada na esquerda do grupo
    doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.rect(20, currentY, 1.5, 6.5, 'F')

    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
    doc.setFontSize(7.5)
    doc.text(className.toUpperCase(), 24, currentY + 4.5)
    
    currentY += 6.5
    doc.setFontSize(8)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

    classPositions.forEach((pos) => {
      // Fundo zebrado
      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252)
        doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
      }
      
      doc.setFont('Helvetica', 'bold')
      doc.text(pos.ticker, 24, currentY + 5)
      doc.setFont('Helvetica', 'normal')
      doc.text(pos.quantity.toLocaleString('pt-BR'), 58, currentY + 5)
      doc.text(`R$ ${pos.average_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 88, currentY + 5)
      doc.text(`R$ ${pos.current_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 118, currentY + 5)
      doc.text(`R$ ${pos.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pos.current_percentage}%)`, 148, currentY + 5)
      
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.text(`${pos.target_percentage}%`, 175, currentY + 5)
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

      currentY += 7.5
      rowIdx++
    })
  }

  // Adiciona Caixa no fim da tabela
  doc.setFillColor(241, 245, 249)
  doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
  doc.setFont('Helvetica', 'bold')
  doc.text('SALDO EM CAIXA', 24, currentY + 5)
  doc.setFont('Helvetica', 'normal')
  doc.text('-', 58, currentY + 5)
  doc.text('-', 88, currentY + 5)
  doc.text('1,00', 118, currentY + 5)
  doc.text(`R$ ${cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${((cashBalance / portfolioValue) * 100).toFixed(2)}%)`, 148, currentY + 5)
  doc.text('-', 175, currentY + 5)

  // Rodapé da página
  drawPageFooter(doc, 2, totalPages)

  // ==========================================
  // PÁGINA 3: ALOCAÇÃO CONSOLIDADA E SETORIAL
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'ANÁLISE DE ALOCAÇÃO POR CLASSE E SETOR', competenceMonth)

  const consolidatedClass = calculateConsolidatedByClass(positions, portfolioValue, groupTargets || [])
  const consolidatedSector = calculateConsolidatedBySector(positions, portfolioValue, groupTargets || [])

  // 1. Tabela de Classes de Ativos
  currentY = 40
  doc.setFontSize(10)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Consolidação por Classes de Ativos', 20, currentY)

  currentY += 6
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text('CLASSE DE ATIVOS', 24, currentY + 5)
  doc.text('VALOR ATUAL', 72, currentY + 5)
  doc.text('PART. (%)', 108, currentY + 5)
  doc.text('ALVO SUGERIDO', 134, currentY + 5)
  doc.text('RENT. CONSOLIDADA', 162, currentY + 5)

  currentY += 7.5
  doc.setFontSize(8)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

  consolidatedClass.forEach((cls, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(20, currentY, pageWidth - 40, 7, 'F')
    }
    doc.setFont('Helvetica', 'bold')
    doc.text(cls.name, 24, currentY + 4.5)
    doc.setFont('Helvetica', 'normal')
    doc.text(`R$ ${cls.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 72, currentY + 4.5)
    doc.text(`${cls.current_percentage.toFixed(2)}%`, 108, currentY + 4.5)
    doc.text(`${cls.target_percentage.toFixed(2)}%`, 134, currentY + 4.5)
    
    const isPositive = cls.yield_pct >= 0
    doc.setFont('Helvetica', 'bold')
    if (isPositive) {
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.text(`+${cls.yield_pct.toFixed(2)}%`, 162, currentY + 4.5)
    } else {
      doc.setTextColor(185, 28, 28)
      doc.text(`${cls.yield_pct.toFixed(2)}%`, 162, currentY + 4.5)
    }
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    
    currentY += 7
  })

  // 2. Tabela de Setores Econômicos
  currentY += 12
  doc.setFontSize(10)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Consolidação por Setores Econômicos', 20, currentY)

  currentY += 6
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text('SETOR ECONÔMICO', 24, currentY + 5)
  doc.text('VALOR ATUAL', 72, currentY + 5)
  doc.text('PART. (%)', 108, currentY + 5)
  doc.text('ALVO SUGERIDO', 134, currentY + 5)
  doc.text('RENT. CONSOLIDADA', 162, currentY + 5)

  currentY += 7.5
  doc.setFontSize(8)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

  consolidatedSector.forEach((sec, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(20, currentY, pageWidth - 40, 7, 'F')
    }
    doc.setFont('Helvetica', 'bold')
    doc.text(sec.name, 24, currentY + 4.5)
    doc.setFont('Helvetica', 'normal')
    doc.text(`R$ ${sec.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 72, currentY + 4.5)
    doc.text(`${sec.current_percentage.toFixed(2)}%`, 108, currentY + 4.5)
    doc.text(`${sec.target_percentage.toFixed(2)}%`, 134, currentY + 4.5)
    
    const isPositive = sec.yield_pct >= 0
    doc.setFont('Helvetica', 'bold')
    if (isPositive) {
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.text(`+${sec.yield_pct.toFixed(2)}%`, 162, currentY + 4.5)
    } else {
      doc.setTextColor(185, 28, 28)
      doc.text(`${sec.yield_pct.toFixed(2)}%`, 162, currentY + 4.5)
    }
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    
    currentY += 7
  })

  drawPageFooter(doc, 3, totalPages)

  // ==========================================
  // PÁGINA 4: PONTOS DE ATENÇÃO (se houver)
  // ==========================================
  if (hasAttentionSection) {
    doc.addPage()
    drawPageHeader(doc, 'PONTOS DE ATENÇÃO — DESVIOS SIGNIFICATIVOS', competenceMonth)

    currentY = 40
    doc.setFontSize(10)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'bold')
    doc.text('Ativos com Desvio Superior a 5% da Meta Estratégica', 20, currentY)

    currentY += 6
    doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.setFont('Helvetica', 'bold')
    doc.text('ATIVO', 24, currentY + 5)
    doc.text('ALOCAÇÃO ATUAL', 65, currentY + 5)
    doc.text('META CERRADO', 110, currentY + 5)
    doc.text('DESVIO', 150, currentY + 5)
    doc.text('AÇÃO SUGERIDA', 170, currentY + 5)

    currentY += 7.5
    doc.setFontSize(8)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

    attentionAssets.forEach((pos, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(255, 251, 235) // Fundo amarelo claro
        doc.rect(20, currentY, pageWidth - 40, 7, 'F')
      }
      const drift = pos.current_percentage - pos.target_percentage
      const action = drift > 0 ? 'REDUZIR EXPOSIÇÃO' : 'AUMENTAR POSIÇÃO'

      doc.setFont('Helvetica', 'bold')
      doc.text(pos.ticker, 24, currentY + 4.5)
      doc.setFont('Helvetica', 'normal')
      doc.text(`${pos.current_percentage.toFixed(2)}%`, 65, currentY + 4.5)
      doc.text(`${pos.target_percentage.toFixed(2)}%`, 110, currentY + 4.5)

      doc.setFont('Helvetica', 'bold')
      if (drift > 0) {
        doc.setTextColor(185, 28, 28)
        doc.text(`+${drift.toFixed(2)}%`, 150, currentY + 4.5)
      } else {
        doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
        doc.text(`${drift.toFixed(2)}%`, 150, currentY + 4.5)
      }
      doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
      doc.text(action, 170, currentY + 4.5)
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

      currentY += 7
    })

    // Nota metodológica
    currentY += 8
    doc.setFontSize(8)
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    doc.setFont('Helvetica', 'normal')
    const noteText = 'Nota: O desvio é calculado como a diferença entre a alocação atual e a meta estratégica definida pela Metodologia do Cerrado. Desvios superiores a 5% indicam necessidade de rebalanceamento prioritário.'
    const splitNote = doc.splitTextToSize(noteText, pageWidth - 40)
    doc.text(splitNote, 20, currentY)

    drawPageFooter(doc, 4, totalPages)
  }

  // ==========================================
  // PÁGINA DE ANÁLISE QUALITATIVA & TESES
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'ANÁLISE QUALITATIVA (TESES DE INVESTIMENTO)', competenceMonth)

  currentY = 40

  // --- SUMÁRIO EXECUTIVO ---
  if (executiveSummary && executiveSummary.trim()) {
    doc.setFontSize(10)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'bold')
    doc.text('Sumário Executivo do Período', 20, currentY)
    currentY += 6

    doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
    const splitSummary = doc.splitTextToSize(executiveSummary.trim(), pageWidth - 52)
    const summaryBoxH = Math.max(22, splitSummary.length * 4.5 + 10)
    doc.roundedRect(20, currentY, pageWidth - 40, summaryBoxH, 2, 2, 'F')
    doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
    doc.rect(20, currentY, 2, summaryBoxH, 'F')

    doc.setFontSize(8.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')
    doc.text(splitSummary, 26, currentY + 7)
    currentY += summaryBoxH + 10
  }

  // --- PLANEJAMENTO PRÓXIMO MÊS ---
  if (nextMonthPlan && nextMonthPlan.trim()) {
    doc.setFontSize(10)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'bold')
    doc.text('Planejamento para o Próximo Mês', 20, currentY)
    currentY += 6

    const splitPlan = doc.splitTextToSize(nextMonthPlan.trim(), pageWidth - 52)
    const planBoxH = Math.max(22, splitPlan.length * 4.5 + 10)
    doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
    doc.roundedRect(20, currentY, pageWidth - 40, planBoxH, 2, 2, 'F')
    doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.rect(20, currentY, 2, planBoxH, 'F')

    doc.setFontSize(8.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')
    doc.text(splitPlan, 26, currentY + 7)
    currentY += planBoxH + 12
  }

  // --- TESES POR ATIVO ---
  doc.setFontSize(10)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Justificativas Fundamentadas de Alocação de Ativos', 20, currentY)

  currentY += 8

  // Filtra as teses dos ativos que estão em carteira
  const activeTheses = positions.filter(pos => theses[pos.ticker])

  if (activeTheses.length === 0) {
    doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
    doc.roundedRect(20, currentY, pageWidth - 40, 30, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    doc.setFont('Helvetica', 'normal')
    doc.text('Nenhuma análise qualitativa personalizada foi cadastrada para este mês.', 25, currentY + 16)
  } else {
    activeTheses.forEach(pos => {
      const thesis = theses[pos.ticker]

      // Verifica se precisa de nova página
      if (currentY > pageHeight - 60) {
        doc.addPage()
        drawPageHeader(doc, 'ANÁLISE QUALITATIVA (TESES DE INVESTIMENTO)', competenceMonth)
        currentY = 40
      }

      // Card da tese
      doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
      doc.roundedRect(20, currentY, pageWidth - 40, 38, 2, 2, 'F')

      // Indicador lateral da tese
      doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.rect(20, currentY, 2, 38, 'F')

      doc.setFontSize(10)
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.setFont('Helvetica', 'bold')
      doc.text(pos.ticker, 26, currentY + 7)

      doc.setFontSize(8)
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
      doc.setFont('Helvetica', 'normal')
      doc.text(`Tese fundamentalista • Peso recomendado: ${pos.target_percentage}%`, 26, 12 + currentY)

      doc.setFontSize(8.5)
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
      
      // Limita caracteres da tese para caber perfeitamente na caixa do relatório
      const splitThesis = doc.splitTextToSize(thesis, pageWidth - 52)
      doc.text(splitThesis, 26, currentY + 19)

      currentY += 44
    })
  }

  drawPageFooter(doc, hasAttentionSection ? 5 : 4, totalPages)

  // ==========================================
  // PÁGINA FINAL: INDICADORES & DEMONSTRATIVO FEE
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'INDICADORES INSTITUCIONAIS & FATURAMENTO', competenceMonth)

  // 1. Bloco de Indicadores de Risco
  currentY = 40
  doc.setFontSize(11)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Indicadores de Performance e Volatilidade', 20, currentY)

  currentY += 8
  
  // Tabela de Indicadores
  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(20, currentY, pageWidth - 40, 32, 2, 2, 'F')

  doc.setFontSize(9)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('ÍNDICE SHARPE (RETORNO VS VOLATILIDADE)', 25, currentY + 8)
  doc.setFont('Helvetica', 'normal')
  doc.text('Volatilidade Mensalizada da Carteira', 25, currentY + 15)
  doc.text('Exposição Sistêmica (Beta vs IBOVESPA)', 25, currentY + 22)
  doc.text('Exposição Sistêmica (Beta vs S&P 500)', 25, currentY + 29)

  doc.setFont('Helvetica', 'bold')
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.text(metrics.sharpe_ratio.toFixed(2), 170, currentY + 8)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.text(`${metrics.volatility_monthly.toFixed(2)}%`, 170, currentY + 15)
  doc.text(metrics.beta_ibov.toFixed(2), 170, currentY + 22)
  doc.text(metrics.beta_sp500.toFixed(2), 170, currentY + 29)

  // 2. Bloco do Demonstrativo de Faturamento Fee-Based
  currentY += 46
  doc.setFontSize(11)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Demonstrativo de Taxa de Gestão Fee-Based', 20, currentY)

  currentY += 8
  
  doc.setFillColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.roundedRect(20, currentY, pageWidth - 40, 52, 2, 2, 'F')
  
  // Detalhes do Faturamento
  doc.setFontSize(9)
  doc.setTextColor(230, 230, 230)
  doc.setFont('Helvetica', 'normal')
  doc.text('BASE DE CÁLCULO (AUM):', 26, currentY + 10)
  doc.text('TAXA DE GESTÃO ACORDADA:', 26, currentY + 18)
  doc.text('DATA DO CÁLCULO:', 26, currentY + 26)
  
  // Valores
  doc.setFont('Helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(`R$ ${portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 120, currentY + 10)
  doc.text(`${billingFeeRate.toFixed(2)}% ao mês (${(billingFeeRate * 12).toFixed(2)}% ao ano)`, 120, currentY + 18)
  doc.text(new Date().toLocaleDateString('pt-BR'), 120, currentY + 26)

  // Divisor dentro do faturamento
  doc.setDrawColor(71, 85, 105)
  doc.line(26, currentY + 32, pageWidth - 26, currentY + 32)

  // Total do faturamento
  doc.setFontSize(11)
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.text('VALOR DE CONSULTORIA A SER LIQUIDADO:', 26, currentY + 42)
  doc.setFontSize(13)
  doc.text(`R$ ${(portfolioValue * (billingFeeRate / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 120, currentY + 42)

  // Bloco de Assinatura do Consultor
  currentY += 80
  doc.setDrawColor(148, 163, 184)
  doc.line(60, currentY, pageWidth - 60, currentY)
  
  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('ASSESSORIA E PLANEJAMENTO FINANCEIRO CERRADO', pageWidth / 2, currentY + 5, { align: 'center' })
  doc.text('RELATÓRIO EMITIDO PELO SISTEMA DE GESTÃO DE ATIVOS', pageWidth / 2, currentY + 9, { align: 'center' })

  drawPageFooter(doc, totalPages, totalPages)

  // ==========================================
  // DISPARA O DOWNLOAD DO PDF NO NAVEGADOR
  // ==========================================
  const safeFileName = clientName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  doc.save(`relatorio-cerrado-${safeFileName}-${new Date().toISOString().substring(0, 7)}.pdf`)
}

// Funções Auxiliares de Desenho de Layout do Relatório

function drawPageHeader(doc: jsPDF, title: string, competence: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Faixa do Cabeçalho
  doc.setFillColor(6, 95, 70) // Verde Cerrado
  doc.rect(0, 0, pageWidth, 20, 'F')
  
  // Elemento dourado
  doc.setFillColor(217, 119, 6)
  doc.rect(0, 20, pageWidth, 1.5, 'F')

  // Textos do Cabeçalho
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(title, 20, 13)
  
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`COMPETÊNCIA: ${competence}`, pageWidth - 20, 13, { align: 'right' })
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Divisor cinza superior do rodapé
  doc.setDrawColor(241, 245, 249)
  doc.setLineWidth(0.3)
  doc.line(20, pageHeight - 16, pageWidth - 20, pageHeight - 16)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Cerrado Asset Management • Relatório Exclusivo do Cliente', 20, pageHeight - 11)
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 20, pageHeight - 11, { align: 'right' })
}
