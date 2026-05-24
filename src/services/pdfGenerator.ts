import { jsPDF } from 'jspdf'
import { Portfolio, PortfolioGroupTarget, AssetPrice, PortfolioTransaction } from '@/types'
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
  assetPrices?: Record<string, AssetPrice>
  transactions?: PortfolioTransaction[]
}

interface BenchmarkInfo {
  name: string
  rate: number
}

// Cores de classes mapeadas para RGB
const CLASS_COLORS_MAP: Record<string, number[]> = {
  'Ações Nacionais': [99, 102, 241],      // Indigo
  'Ações Internacionais': [6, 182, 212],   // Cyan
  'Fundos Imobiliários': [16, 185, 129],  // Emerald
  'Renda Fixa': [236, 72, 153],           // Pink
  'Criptoativos': [245, 158, 11],          // Amber
  'Saldo em Caixa': [100, 116, 139]       // Slate
}

const BENCHMARK_MAPPING: Record<string, BenchmarkInfo> = {
  'Ações Nacionais': { name: 'IBOVESPA', rate: 11.50 },
  'Ações Internacionais': { name: 'S&P 500', rate: 12.50 },
  'Fundos Imobiliários': { name: 'IFIX', rate: 10.00 },
  'Renda Fixa': { name: 'CDI', rate: 10.75 },
  'Criptoativos': { name: 'Bitcoin (BTC)', rate: 35.00 },
  'Saldo em Caixa': { name: 'CDI', rate: 10.75 }
}

export async function generateConsultingPDF(data: PDFData): Promise<void> {
  const { 
    clientName, 
    positions, 
    shareHistory, 
    metrics, 
    theses, 
    cashBalance, 
    groupTargets, 
    executiveSummary, 
    nextMonthPlan, 
    billingFeeRate = 0.1,
    assetPrices = {},
    transactions = [] 
  } = data

  const attentionAssets = positions.filter(p => Math.abs(p.current_percentage - p.target_percentage) > 5)
  const portfolioValue = positions.reduce((sum, p) => sum + p.total_value, 0) + cashBalance
  const totalYieldPct = shareHistory.length > 0 ? (shareHistory[shareHistory.length - 1].shareValue - 1) * 100 : 0
  const competenceMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()

  // Cores institucionais do Cerrado
  const COLOR_PRIMARY = [6, 95, 70]     // Verde Cerrado #065f46
  const COLOR_SECONDARY = [30, 41, 59]   // Slate Escuro #1e293b
  const COLOR_ACCENT = [217, 119, 6]    // Dourado/Amber #d97706
  const COLOR_MUTED = [100, 116, 139]    // Slate Muted #64748b
  const COLOR_BG_LIGHT = [248, 250, 252] // Cinza Fundo #f8fafc

  // --- 1. Cálculos de Rentabilidade Temporal ---
  // Rentabilidade total desde o início: totalYieldPct

  // Rentabilidade mensal (últimos 30 dias)
  let monthlyYieldPct = 0
  if (shareHistory.length >= 2) {
    const lastEntry = shareHistory[shareHistory.length - 1]
    const lastDate = new Date(lastEntry.date)
    const thirtyDaysAgo = new Date(lastDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    let closestEntry = shareHistory[0]
    let minDiff = Infinity
    const targetTime = thirtyDaysAgo.getTime()
    
    for (const entry of shareHistory) {
      const entryTime = new Date(entry.date).getTime()
      const diff = Math.abs(entryTime - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        closestEntry = entry
      }
    }
    
    if (closestEntry && closestEntry.shareValue > 0) {
      monthlyYieldPct = ((lastEntry.shareValue - closestEntry.shareValue) / closestEntry.shareValue) * 100
    }
  }

  // --- 2. Cálculos Rigorosos de Período Composto ---
  const getHoldingDays = (className: string) => {
    if (className === 'Saldo em Caixa') {
      if (transactions.length === 0) return 365
      const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
      const firstDate = new Date(sorted[0].date)
      const diffTime = Math.abs(new Date().getTime() - firstDate.getTime())
      return Math.max(30, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    }
    
    const classTxs = transactions.filter(t => {
      const priceObj = assetPrices[t.ticker.toUpperCase()]
      const assetClass = priceObj?.asset_class || 'Renda Fixa'
      return assetClass === className
    })
    
    if (classTxs.length === 0) return 365
    
    const sorted = classTxs.sort((a, b) => a.date.localeCompare(b.date))
    const firstDate = new Date(sorted[0].date)
    const diffTime = Math.abs(new Date().getTime() - firstDate.getTime())
    return Math.max(30, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  const getSectorHoldingDays = (sectorName: string) => {
    const sectorTxs = transactions.filter(t => {
      const priceObj = assetPrices[t.ticker.toUpperCase()]
      const sector = priceObj?.sector || 'Outros'
      return sector === sectorName
    })
    
    if (sectorTxs.length === 0) return 365
    
    const sorted = sectorTxs.sort((a, b) => a.date.localeCompare(b.date))
    const firstDate = new Date(sorted[0].date)
    const diffTime = Math.abs(new Date().getTime() - firstDate.getTime())
    return Math.max(30, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  // Consolidar Classes e Setores
  const consolidatedClass = calculateConsolidatedByClass(positions, portfolioValue, groupTargets || [])
  const consolidatedSector = calculateConsolidatedBySector(positions, portfolioValue, groupTargets || [])

  // Configuração das Páginas do PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const thesesForPageCount = positions.filter(pos => theses[pos.ticker])
  const thesisPages = thesesForPageCount.length > 0 ? Math.ceil(thesesForPageCount.length / 5) : 1
  const hasAttentionSection = attentionAssets.length > 0
  
  // Total de Páginas:
  // 1: Capa, 2: Ativos/Posições, 3: Classes, 4: Setores, 5: Ativos vs Metas, 6 (se houver): Atenção, 7: Qualitativo, 8: Risco/Faturamento
  const totalPages = 7 + thesisPages + (hasAttentionSection ? 1 : 0)

  // ==========================================
  // PÁGINA 1: CAPA INSTITUCIONAL E ELEGANTE
  // ==========================================
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(0, 0, 8, pageHeight, 'F')
  doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.rect(8, 0, 2, pageHeight, 'F')

  // Logo Vetorial
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.triangle(45, 60, 60, 45, 75, 60, 'F')
  doc.triangle(45, 60, 60, 75, 75, 60, 'F')
  doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.triangle(52, 60, 60, 52, 68, 60, 'F')
  doc.triangle(52, 60, 60, 68, 68, 60, 'F')

  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('CERRADO ASSET MANAGEMENT', 45, 95)
  
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(14)
  doc.text('Relatório Mensal de Consultoria Patrimonial', 45, 105)

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(45, 115, pageWidth - 30, 115)

  // Metadados
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
    const summaryLines = splitSummary.slice(0, 6)
    doc.text(summaryLines, 45, summaryY + 6)
  }

  doc.setFontSize(8)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('Este relatório contém informações confidenciais destinadas exclusivamente ao cliente.', 45, pageHeight - 30)
  doc.text('Cerrado Asset Management Ltda. Todos os direitos reservados 2026.', 45, pageHeight - 25)

  if (attentionAssets.length > 0) {
    doc.setFontSize(8)
    doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.setFont('Helvetica', 'bold')
    doc.text(`⚠  ${attentionAssets.length} ativo(s) com desvio > 5% da meta.`, 45, pageHeight - 40)
  }

  // ==========================================
  // PÁGINA 2: DEMONSTRATIVO DE ATIVOS (TABELA)
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'DEMONSTRATIVO DE ATIVOS EM CARTEIRA', competenceMonth)

  // PL e Rentabilidade (2 cards)
  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(20, 32, 82, 16, 1.5, 1.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('PATRIMÔNIO LÍQUIDO', 24, 37)
  doc.setFontSize(10)
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(`R$ ${portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 24, 44)

  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(108, 32, 82, 16, 1.5, 1.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('RENTABILIDADE TOTAL', 112, 37)
  doc.setFontSize(10)
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.setFont('Helvetica', 'bold')
  doc.text(`+${totalYieldPct.toFixed(2)}%`, 112, 44)

  let currentY = 56
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text('ATIVO', 23, currentY + 5)
  doc.text('QTD', 54, currentY + 5)
  doc.text('CUSTO MÉDIO', 76, currentY + 5)
  doc.text('COTAÇÃO', 106, currentY + 5)
  doc.text('EXPOSIÇÃO REAL', 134, currentY + 5)
  doc.text('META ALVO', 174, currentY + 5)

  currentY += 7.5
  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

  const positionsByClass: Record<string, AssetPosition[]> = {}
  for (const pos of positions) {
    const clsName = pos.asset_class || 'Renda Fixa'
    if (!positionsByClass[clsName]) positionsByClass[clsName] = []
    positionsByClass[clsName].push(pos)
  }

  let rowIdx = 0
  for (const [className, classPositions] of Object.entries(positionsByClass)) {
    doc.setFillColor(241, 245, 249)
    doc.rect(20, currentY, pageWidth - 40, 6, 'F')
    doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.rect(20, currentY, 1.2, 6, 'F')

    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
    doc.setFontSize(7)
    doc.text(className.toUpperCase(), 23, currentY + 4)
    
    currentY += 6
    doc.setFontSize(7.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

    classPositions.forEach((pos) => {
      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252)
        doc.rect(20, currentY, pageWidth - 40, 7, 'F')
      }
      doc.setFont('Helvetica', 'bold')
      doc.text(pos.ticker, 23, currentY + 4.5)
      doc.setFont('Helvetica', 'normal')
      doc.text(pos.quantity.toLocaleString('pt-BR'), 54, currentY + 4.5)
      doc.text(`R$ ${pos.average_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 76, currentY + 4.5)
      doc.text(`R$ ${pos.current_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 106, currentY + 4.5)
      doc.text(`R$ ${pos.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (${pos.current_percentage.toFixed(1)}%)`, 134, currentY + 4.5)
      doc.setFont('Helvetica', 'bold')
      doc.text(`${pos.target_percentage.toFixed(1)}%`, 174, currentY + 4.5)

      currentY += 7
      rowIdx++
    })
  }



  drawPageFooter(doc, 2, totalPages)

  // ==========================================
  // PÁGINA 3: ALOCAÇÃO POR CLASSES & BENCHMARKS
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'DISTRIBUIÇÃO PATRIMONIAL POR CLASSES', competenceMonth)

  // --- A. GRAFICO DE CLASSES (Segmented Stacked Bar) ---
  currentY = 32
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Gráfico de Alocação por Classe de Ativo', 20, currentY)

  currentY += 5
  // Container do gráfico
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(20, currentY, pageWidth - 40, 8, 1, 1, 'F')

  let currX = 20
  const widthTotal = pageWidth - 40

  consolidatedClass.forEach((grp) => {
    const pct = grp.current_percentage
    if (pct <= 0) return
    const w = (pct / 100) * widthTotal
    const rgb = CLASS_COLORS_MAP[grp.name] || [100, 116, 139]
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(currX, currentY, w, 8, 'F')
    currX += w
  })

  // Legendas sob o gráfico
  currentY += 13
  doc.setFontSize(7.5)
  let legX = 20
  let legY = currentY

  consolidatedClass.forEach((grp) => {
    if (grp.current_percentage <= 0) return
    const rgb = CLASS_COLORS_MAP[grp.name] || [100, 116, 139]
    
    if (legX > pageWidth - 60) {
      legX = 20
      legY += 4.5
    }

    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(legX, legY - 2, 2.5, 2.5, 'F')
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.text(`${grp.name}: ${grp.current_percentage.toFixed(1)}%`, legX + 4, legY)
    legX += 34
  })

  // --- B. TABELA COMPENSADA DE BENCHMARKS POR CLASSE ---
  currentY = legY + 12
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Demonstrativo de Rentabilidade vs Benchmarks Equivalentes', 20, currentY)

  currentY += 5
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text('CLASSE DE ATIVO', 23, currentY + 5)
  doc.text('VALOR ATUAL', 66, currentY + 5)
  doc.text('% REAIS', 98, currentY + 5)
  doc.text('RENTABILIDADE', 120, currentY + 5)
  doc.text('BENCHMARK (REF)', 148, currentY + 5)
  doc.text('DIFERENÇA (ALPHA)', 175, currentY + 5)

  currentY += 7.5
  doc.setFontSize(7.5)

  consolidatedClass.forEach((group, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
    }

    const benchInfo = BENCHMARK_MAPPING[group.name] || { name: 'CDI', rate: 10.75 }
    const days = getHoldingDays(group.name)
    const years = days / 365
    const benchmarkRate = (Math.pow(1 + benchInfo.rate / 100, years) - 1) * 100
    const alpha = group.yield_pct - benchmarkRate
    const isAlphaPositive = alpha >= 0

    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.text(group.name, 23, currentY + 4.5)

    doc.setFont('Helvetica', 'normal')
    doc.text(`R$ ${group.total_value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, 66, currentY + 4.5)
    doc.text(`${group.current_percentage.toFixed(1)}%`, 98, currentY + 4.5)

    // Rentabilidade real
    if (group.yield_pct >= 0) {
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.setFont('Helvetica', 'bold')
      doc.text(`+${group.yield_pct.toFixed(2)}%`, 120, currentY + 4.5)
    } else {
      doc.setTextColor(185, 28, 28)
      doc.setFont('Helvetica', 'bold')
      doc.text(`${group.yield_pct.toFixed(2)}%`, 120, currentY + 4.5)
    }
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')

    // Benchmark Rate
    doc.text(`${benchInfo.name} (${benchmarkRate.toFixed(1)}%)`, 148, currentY + 4.5)

    // Alpha Box
    if (isAlphaPositive) {
      doc.setFillColor(209, 250, 229) // light emerald
      doc.roundedRect(175, currentY + 1.2, 14, 5, 0.8, 0.8, 'F')
      doc.setTextColor(6, 95, 70)
      doc.setFont('Helvetica', 'bold')
      doc.text(`+${alpha.toFixed(1)}%`, 176, currentY + 4.6)
    } else {
      const rgb = feeBoxColor(alpha)
      doc.setFillColor(rgb[0], rgb[1], rgb[2])
      doc.roundedRect(175, currentY + 1.2, 14, 5, 0.8, 0.8, 'F')
      doc.setTextColor(185, 28, 28)
      doc.setFont('Helvetica', 'bold')
      doc.text(`${alpha.toFixed(1)}%`, 176, currentY + 4.6)
    }
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')

    currentY += 7.5
  })

  drawPageFooter(doc, 3, totalPages)

  // ==========================================
  // PÁGINA 4: DISTRIBUIÇÃO SETORIAL & RENTABILIDADE
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'DISTRIBUIÇÃO PATRIMONIAL POR SETORES', competenceMonth)

  // --- A. GRAFICO SETORIAL (Segmented Stacked Bar) ---
  currentY = 32
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Gráfico de Alocação por Setor Econômico', 20, currentY)

  currentY += 5
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(20, currentY, pageWidth - 40, 8, 1, 1, 'F')

  currX = 20
  const SECTOR_COLORS_PALETTE = [
    [59, 130, 246], [16, 185, 129], [245, 158, 11], [239, 68, 68],
    [139, 92, 246], [236, 72, 153], [6, 182, 212], [20, 184, 166],
    [99, 102, 241], [168, 85, 247], [249, 115, 22], [132, 204, 22]
  ]

  consolidatedSector.forEach((grp, idx) => {
    const pct = grp.current_percentage
    if (pct <= 0) return
    const w = (pct / 100) * widthTotal
    const rgb = SECTOR_COLORS_PALETTE[idx % SECTOR_COLORS_PALETTE.length]
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(currX, currentY, w, 8, 'F')
    currX += w
  })

  // Legendas sob o gráfico setorial
  currentY += 13
  doc.setFontSize(7)
  legX = 20
  legY = currentY

  consolidatedSector.forEach((grp, idx) => {
    if (grp.current_percentage <= 0) return
    const rgb = SECTOR_COLORS_PALETTE[idx % SECTOR_COLORS_PALETTE.length]
    
    if (legX > pageWidth - 60) {
      legX = 20
      legY += 4.5
    }

    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(legX, legY - 2, 2.2, 2.2, 'F')
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.text(`${grp.name}: ${grp.current_percentage.toFixed(1)}%`, legX + 3.5, legY)
    legX += 34
  })

  // --- B. TABELA DE RENTABILIDADE POR SETORES ---
  currentY = legY + 12
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Demonstrativo de Rentabilidade Consolidada por Setor', 20, currentY)

  currentY += 5
  doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text('SETOR ECONÔMICO', 23, currentY + 5)
  doc.text('VALOR ATUAL', 66, currentY + 5)
  doc.text('% REAIS', 98, currentY + 5)
  doc.text('RENTABILIDADE', 120, currentY + 5)
  doc.text('BENCHMARK (REF)', 148, currentY + 5)
  doc.text('DIFERENÇA (ALPHA)', 175, currentY + 5)

  currentY += 7.5
  doc.setFontSize(7.5)

  consolidatedSector.forEach((group, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
    }

    // Resolve o benchmark setorial
    const isFixedIncome = group.name === 'Saldo em Caixa' || group.name === 'Caixa' || group.name === 'Outros'
    const benchInfo = isFixedIncome ? { name: 'CDI', rate: 10.75 } : { name: 'IBOVESPA', rate: 11.50 }
    
    const days = getSectorHoldingDays(group.name)
    const years = days / 365
    const benchmarkRate = (Math.pow(1 + benchInfo.rate / 100, years) - 1) * 100
    const alpha = group.yield_pct - benchmarkRate
    const isAlphaPositive = alpha >= 0

    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.text(group.name, 23, currentY + 4.5)

    doc.setFont('Helvetica', 'normal')
    doc.text(`R$ ${group.total_value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, 66, currentY + 4.5)
    doc.text(`${group.current_percentage.toFixed(1)}%`, 98, currentY + 4.5)

    // Rentabilidade real
    if (group.yield_pct >= 0) {
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.setFont('Helvetica', 'bold')
      doc.text(`+${group.yield_pct.toFixed(2)}%`, 120, currentY + 4.5)
    } else {
      doc.setTextColor(185, 28, 28)
      doc.setFont('Helvetica', 'bold')
      doc.text(`${group.yield_pct.toFixed(2)}%`, 120, currentY + 4.5)
    }
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')

    // Benchmark Rate
    doc.text(`${benchInfo.name} (${benchmarkRate.toFixed(1)}%)`, 148, currentY + 4.5)

    // Alpha Box
    if (isAlphaPositive) {
      doc.setFillColor(209, 250, 229)
      doc.roundedRect(175, currentY + 1.2, 14, 5, 0.8, 0.8, 'F')
      doc.setTextColor(6, 95, 70)
      doc.setFont('Helvetica', 'bold')
      doc.text(`+${alpha.toFixed(1)}%`, 176, currentY + 4.6)
    } else {
      const rgb = feeBoxColor(alpha)
      doc.setFillColor(rgb[0], rgb[1], rgb[2])
      doc.roundedRect(175, currentY + 1.2, 14, 5, 0.8, 0.8, 'F')
      doc.setTextColor(185, 28, 28)
      doc.setFont('Helvetica', 'bold')
      doc.text(`${alpha.toFixed(1)}%`, 176, currentY + 4.6)
    }
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')

    currentY += 7.5
  })

  drawPageFooter(doc, 4, totalPages)

  // ==========================================
  // PÁGINA 5: EXPOSIÇÃO VS METAS POR ATIVO (BARRAS H)
  // ==========================================
  doc.addPage()
  drawPageHeader(doc, 'EXPOSIÇÃO REAL VS META DE ALOCAÇÃO', competenceMonth)

  currentY = 32
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Comparativo de Alocação vs Metas Estratégicas (Top 10 Desvios)', 20, currentY)

  // Ordena posições por maior desvio
  const sortedPositions = [...positions]
    .map(p => ({
      ...p,
      deviation: Math.abs(p.current_percentage - p.target_percentage)
    }))
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 10)

  currentY += 10
  
  if (sortedPositions.length === 0) {
    doc.setFontSize(8)
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    doc.text('Nenhum ativo configurado com metas de alocação.', 20, currentY)
  } else {
    sortedPositions.forEach((pos) => {
      // Nome do Ativo com Alerta se desvio > 5%
      const hasHighDev = pos.deviation > 5
      doc.setFontSize(8.5)
      doc.setFont('Helvetica', 'bold')
      
      if (hasHighDev) {
        doc.setTextColor(185, 28, 28) // Vermelho
        doc.text(`⚠ ${pos.ticker}`, 20, currentY + 4)
      } else {
        doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
        doc.text(pos.ticker, 20, currentY + 4)
      }

      // Detalhes numéricos das barras
      doc.setFontSize(7)
      doc.setFont('Helvetica', 'normal')
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
      doc.text(`Real: ${pos.current_percentage.toFixed(1)}% | Meta: ${pos.target_percentage.toFixed(1)}% (Desvio: ${pos.current_percentage > pos.target_percentage ? '+' : ''}${(pos.current_percentage - pos.target_percentage).toFixed(1)}%)`, 20, currentY + 9)

      // Desenhar Barras Paralelas
      // Comprimento da barra de 100% de representação é 100mm
      const scale = 3.2 // 1% = 3.2mm de largura (máximo 30% = 96mm)
      
      // 1. Barra Real (Azul)
      const wReal = Math.min(pos.current_percentage * scale, 96)
      doc.setFillColor(59, 130, 246) // Blue
      doc.rect(78, currentY + 1.2, wReal, 3.2, 'F')

      // 2. Barra Meta (Verde)
      const wMeta = Math.min(pos.target_percentage * scale, 96)
      doc.setFillColor(16, 185, 129) // Emerald/Green
      doc.rect(78, currentY + 5.2, wMeta, 3.2, 'F')

      currentY += 13.5
    })

    // Legenda do Gráfico
    currentY += 3
    doc.setFillColor(59, 130, 246)
    doc.rect(20, currentY, 4, 4, 'F')
    doc.setFontSize(7.5)
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.text('Exposição Real (%)', 26, currentY + 3.2)

    doc.setFillColor(16, 185, 129)
    doc.rect(58, currentY, 4, 4, 'F')
    doc.text('Meta Alvo (%)', 64, currentY + 3.2)
  }

  drawPageFooter(doc, 5, totalPages)

  // ==========================================
  // PÁGINA 6: PONTOS DE ATENÇÃO (se houver)
  // ==========================================
  let pageCounter = 5
  if (hasAttentionSection) {
    pageCounter++
    doc.addPage()
    drawPageHeader(doc, 'PONTOS DE ATENÇÃO — DESVIOS SIGNIFICATIVOS', competenceMonth)

    currentY = 32
    doc.setFontSize(9.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'bold')
    doc.text('Ativos com Desvio Superior a 5% da Meta Estratégica', 20, currentY)

    currentY += 5
    doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.rect(20, currentY, pageWidth - 40, 7.5, 'F')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.setFont('Helvetica', 'bold')
    doc.text('ATIVO', 23, currentY + 5)
    doc.text('ALOCAÇÃO ATUAL', 64, currentY + 5)
    doc.text('META ESTRATÉGICA', 104, currentY + 5)
    doc.text('DESVIO ATUAL', 144, currentY + 5)
    doc.text('AÇÃO SUGERIDA', 168, currentY + 5)

    currentY += 7.5
    doc.setFontSize(7.5)

    attentionAssets.forEach((pos, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(255, 251, 235)
        doc.rect(20, currentY, pageWidth - 40, 7.2, 'F')
      }
      const drift = pos.current_percentage - pos.target_percentage
      const actionText = drift > 0 ? 'REDUZIR EXPOSIÇÃO' : 'AUMENTAR POSIÇÃO'

      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
      doc.text(pos.ticker, 23, currentY + 4.5)
      
      doc.setFont('Helvetica', 'normal')
      doc.text(`${pos.current_percentage.toFixed(1)}%`, 64, currentY + 4.5)
      doc.text(`${pos.target_percentage.toFixed(1)}%`, 104, currentY + 4.5)

      doc.setFont('Helvetica', 'bold')
      if (drift > 0) {
        doc.setTextColor(185, 28, 28)
        doc.text(`+${drift.toFixed(1)}%`, 144, currentY + 4.5)
      } else {
        doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
        doc.text(`${drift.toFixed(1)}%`, 144, currentY + 4.5)
      }

      doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
      doc.text(actionText, 168, currentY + 4.5)
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])

      currentY += 7.2
    })

    currentY += 8
    doc.setFontSize(7.5)
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    doc.setFont('Helvetica', 'normal')
    const noteText = 'Nota: O desvio é calculado como a diferença absoluta entre a exposição atual e a meta. Desvios maiores que 5% requerem a execução prioritária de rebalanceamento sistemático.'
    const splitNote = doc.splitTextToSize(noteText, pageWidth - 40)
    doc.text(splitNote, 20, currentY)

    drawPageFooter(doc, pageCounter, totalPages)
  }

  // ==========================================
  // PÁGINA: ANÁLISE QUALITATIVA & TESES
  // ==========================================
  pageCounter++
  doc.addPage()
  drawPageHeader(doc, 'ANÁLISE QUALITATIVA (TESES DE INVESTIMENTO)', competenceMonth)

  currentY = 32

  // Sumário Executivo
  if (executiveSummary && executiveSummary.trim()) {
    doc.setFontSize(9.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'bold')
    doc.text('Sumário Executivo do Período', 20, currentY)
    currentY += 5

    doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
    const splitSummary = doc.splitTextToSize(executiveSummary.trim(), pageWidth - 52)
    const summaryBoxH = Math.max(18, splitSummary.length * 4 + 8)
    doc.roundedRect(20, currentY, pageWidth - 40, summaryBoxH, 1.5, 1.5, 'F')
    doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
    doc.rect(20, currentY, 1.8, summaryBoxH, 'F')

    doc.setFontSize(8)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')
    doc.text(splitSummary, 26, currentY + 6)
    currentY += summaryBoxH + 8
  }

  // Planejamento
  if (nextMonthPlan && nextMonthPlan.trim()) {
    doc.setFontSize(9.5)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'bold')
    doc.text('Planejamento para o Próximo Mês', 20, currentY)
    currentY += 5

    const splitPlan = doc.splitTextToSize(nextMonthPlan.trim(), pageWidth - 52)
    const planBoxH = Math.max(18, splitPlan.length * 4 + 8)
    doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
    doc.roundedRect(20, currentY, pageWidth - 40, planBoxH, 1.5, 1.5, 'F')
    doc.setFillColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    doc.rect(20, currentY, 1.8, planBoxH, 'F')

    doc.setFontSize(8)
    doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
    doc.setFont('Helvetica', 'normal')
    doc.text(splitPlan, 26, currentY + 6)
    currentY += planBoxH + 10
  }

  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Teses e Justificativas de Posicionamento', 20, currentY)
  currentY += 6

  const activeTheses = positions.filter(pos => theses[pos.ticker])
  if (activeTheses.length === 0) {
    doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
    doc.roundedRect(20, currentY, pageWidth - 40, 20, 1.5, 1.5, 'F')
    doc.setFontSize(8.5)
    doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    doc.text('Sem anotações qualitativas para os ativos este mês.', 25, currentY + 11)
  } else {
    activeTheses.forEach((pos) => {
      const thesis = theses[pos.ticker]
      
      if (currentY > pageHeight - 50) {
        doc.addPage()
        drawPageHeader(doc, 'ANÁLISE QUALITATIVA (TESES DE INVESTIMENTO)', competenceMonth)
        currentY = 32
      }

      doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
      doc.roundedRect(20, currentY, pageWidth - 40, 32, 1.5, 1.5, 'F')
      doc.setFillColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.rect(20, currentY, 1.5, 32, 'F')

      doc.setFontSize(9)
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
      doc.setFont('Helvetica', 'bold')
      doc.text(pos.ticker, 25, currentY + 6)

      doc.setFontSize(7.5)
      doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
      doc.setFont('Helvetica', 'normal')
      doc.text(`Peso sugerido: ${pos.target_percentage.toFixed(1)}%`, 25, currentY + 11)

      doc.setFontSize(8)
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
      const splitThesis = doc.splitTextToSize(thesis, pageWidth - 50)
      doc.text(splitThesis.slice(0, 4), 25, currentY + 17) // no máximo 4 linhas por ativo

      currentY += 36
    })
  }

  drawPageFooter(doc, pageCounter, totalPages)

  // ==========================================
  // PÁGINA FINAL: INDICADORES E PERFORMANCE
  // ==========================================
  doc.addPage()
  pageCounter++
  drawPageHeader(doc, 'PERFORMANCE, RISCO & FATURAMENTO FEE-BASED', competenceMonth)

  // 1. Métricas de Rentabilidade Temporal (Lado a Lado)
  currentY = 32
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Rentabilidade Temporal Real da Carteira', 20, currentY)

  currentY += 5
  // Caixa Rentabilidade Mensal (30 dias)
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(20, currentY, 82, 22, 1.5, 1.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('ÚLTIMOS 30 DIAS', 25, currentY + 7)
  doc.setFontSize(13)
  doc.setTextColor(monthlyYieldPct >= 0 ? COLOR_PRIMARY[0] : 185, monthlyYieldPct >= 0 ? COLOR_PRIMARY[1] : 28, monthlyYieldPct >= 0 ? COLOR_PRIMARY[2] : 28)
  doc.setFont('Helvetica', 'bold')
  doc.text(`${monthlyYieldPct >= 0 ? '+' : ''}${monthlyYieldPct.toFixed(2)}%`, 25, currentY + 16)

  // Caixa Rentabilidade Início (Inception)
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(108, currentY, 82, 22, 1.5, 1.5, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('DESDE O INÍCIO (INCEPTION YIELD)', 113, currentY + 7)
  doc.setFontSize(13)
  doc.setTextColor(totalYieldPct >= 0 ? COLOR_PRIMARY[0] : 185, totalYieldPct >= 0 ? COLOR_PRIMARY[1] : 28, totalYieldPct >= 0 ? COLOR_PRIMARY[2] : 28)
  doc.setFont('Helvetica', 'bold')
  doc.text(`${totalYieldPct >= 0 ? '+' : ''}${totalYieldPct.toFixed(2)}%`, 113, currentY + 16)

  // 2. Indicadores de Risco & Sharpe Gauge
  currentY += 30
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Estatísticas de Volatilidade e Ajuste ao Risco', 20, currentY)

  currentY += 5
  // Gauge Bar do Sharpe
  // Sharpe normalizado de -1.0 a 3.0
  const normalizedS = Math.max(-1.0, Math.min(3.0, metrics.sharpe_ratio))
  const gaugePct = ((normalizedS + 1.0) / 4.0) * 100
  const barW = (gaugePct / 100) * 170

  // Trilho de fundo
  doc.setFillColor(226, 232, 240)
  doc.roundedRect(20, currentY, pageWidth - 40, 5, 0.8, 0.8, 'F')
  
  // Barra preenchida baseada no Sharpe
  let sharpeCol = [245, 158, 11] // Amber
  if (metrics.sharpe_ratio >= 2.0) sharpeCol = [20, 184, 166] // Teal
  else if (metrics.sharpe_ratio >= 1.0) sharpeCol = [99, 102, 241] // Indigo
  else if (metrics.sharpe_ratio < 0) sharpeCol = [239, 68, 68] // Red
  
  doc.setFillColor(sharpeCol[0], sharpeCol[1], sharpeCol[2])
  doc.roundedRect(20, currentY, Math.max(2, barW), 5, 0.8, 0.8, 'F')

  // Marcadores do Sharpe
  doc.setFontSize(6.5)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('-1.0', 20, currentY + 9)
  doc.text('0.0 (CDI)', 20 + 0.25 * 170, currentY + 9)
  doc.text('1.0', 20 + 0.5 * 170, currentY + 9)
  doc.text('2.0', 20 + 0.75 * 170, currentY + 9)
  doc.text('3.0', 190, currentY + 9, { align: 'right' })

  // Valor atual do Sharpe destacado
  doc.setFontSize(8.5)
  doc.setFont('Helvetica', 'bold')
  doc.setTextColor(sharpeCol[0], sharpeCol[1], sharpeCol[2])
  doc.text(`Índice Sharpe Atual: ${metrics.sharpe_ratio.toFixed(2)}`, 20, currentY - 2.5)

  // Outras Métricas de Risco (Grade)
  currentY += 15
  doc.setFillColor(COLOR_BG_LIGHT[0], COLOR_BG_LIGHT[1], COLOR_BG_LIGHT[2])
  doc.roundedRect(20, currentY, pageWidth - 40, 24, 1.5, 1.5, 'F')

  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('VOLATILIDADE MENSAL DA CARTEIRA:', 25, currentY + 7)
  doc.text('COEFICIENTE BETA VS IBOVESPA:', 25, currentY + 14)
  doc.text('COEFICIENTE BETA VS S&P 500:', 25, currentY + 21)

  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.text(`${metrics.volatility_monthly.toFixed(2)}%`, 160, currentY + 7)
  doc.text(metrics.beta_ibov.toFixed(2), 160, currentY + 14)
  doc.text(metrics.beta_sp500.toFixed(2), 160, currentY + 21)

  // 3. Bloco do Demonstrativo de Faturamento Fee-Based
  currentY += 34
  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.setFont('Helvetica', 'bold')
  doc.text('Faturamento Fee-Based de Consultoria', 20, currentY)

  currentY += 5
  doc.setFillColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2])
  doc.roundedRect(20, currentY, pageWidth - 40, 42, 1.5, 1.5, 'F')

  doc.setFontSize(8)
  doc.setTextColor(226, 232, 240)
  doc.setFont('Helvetica', 'normal')
  doc.text('ATIVOS TOTAIS SOB GESTÃO (AUM):', 25, currentY + 9)
  doc.text('TAXA DE CONSULTORIA ACORDADA:', 25, currentY + 16)
  doc.text('DATA DE REFERÊNCIA:', 25, currentY + 23)

  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.text(`R$ ${portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 120, currentY + 9)
  doc.text(`${billingFeeRate.toFixed(2)}% ao mês (${(billingFeeRate * 12).toFixed(2)}% ao ano)`, 120, currentY + 16)
  doc.text(new Date().toLocaleDateString('pt-BR'), 120, currentY + 23)

  doc.setDrawColor(71, 85, 105)
  doc.setLineWidth(0.3)
  doc.line(25, currentY + 28, pageWidth - 25, currentY + 28)

  doc.setFontSize(9.5)
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  doc.text('VALOR DE CONSULTORIA A SER RECOLHIDO:', 25, currentY + 36)
  doc.setFontSize(11)
  doc.text(`R$ ${(portfolioValue * (billingFeeRate / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 120, currentY + 36)

  // Assinatura
  currentY += 66
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(60, currentY, pageWidth - 60, currentY)
  
  doc.setFontSize(7.5)
  doc.setTextColor(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
  doc.setFont('Helvetica', 'normal')
  doc.text('ASSESSORIA E PLANEJAMENTO FINANCEIRO CERRADO', pageWidth / 2, currentY + 4.5, { align: 'center' })
  doc.text('DOCUMENTO EMITIDO AUTOMATICAMENTE PELO SISTEMA DE GESTÃO CERRADO ASSET', pageWidth / 2, currentY + 8.5, { align: 'center' })

  drawPageFooter(doc, totalPages, totalPages)

  // Salvar PDF
  const safeFileName = clientName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  doc.save(`relatorio-cerrado-${safeFileName}-${new Date().toISOString().substring(0, 7)}.pdf`)
}

// Funções Auxiliares de Desenho de Layout do Relatório

function drawPageHeader(doc: jsPDF, title: string, competence: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Faixa do Cabeçalho
  doc.setFillColor(6, 95, 70) // Verde Cerrado
  doc.rect(0, 0, pageWidth, 16, 'F')
  
  // Elemento dourado
  doc.setFillColor(217, 119, 6)
  doc.rect(0, 16, pageWidth, 1.2, 'F')

  // Textos do Cabeçalho
  doc.setTextColor(255, 255, 255)
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(title, 20, 10.5)
  
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(`COMPETÊNCIA: ${competence}`, pageWidth - 20, 10.5, { align: 'right' })
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Divisor cinza superior do rodapé
  doc.setDrawColor(241, 245, 249)
  doc.setLineWidth(0.3)
  doc.line(20, pageHeight - 14, pageWidth - 20, pageHeight - 14)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Cerrado Asset Management • Relatório Exclusivo do Cliente', 20, pageHeight - 9.5)
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 20, pageHeight - 9.5, { align: 'right' })
}

function feeBoxColor(alpha: number) {
  if (alpha < -2.0) return [254, 226, 226] // red-100
  return [254, 243, 199] // amber-100
}
