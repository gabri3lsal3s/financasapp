import {
  ScuttlebuttAnswer,
  ScuttlebuttPillar,
  ScuttlebuttQuestion,
  PortfolioQuantPreferences
} from '@/types'

/**
 * Calcula o Score Qualitativo (Scuttlebutt) baseado em pilares dinâmicos e normalização de N/A.
 */
export function calculateScuttlebuttScore(
  answers: ScuttlebuttAnswer[],
  pillars: ScuttlebuttPillar[],
  questions: ScuttlebuttQuestion[]
): {
  score: number
  pillarScores: Record<string, number>
  activePillarWeights: Record<string, number>
} {
  const pillarScores: Record<string, number> = {}
  const activePillarWeights: Record<string, number> = {}
  let totalActivePillarWeight = 0

  // 1. Calcular a pontuação de cada pilar individualmente
  for (const pillar of pillars) {
    const pillarQuestions = questions.filter(q => q.pillar_id === pillar.id)
    if (pillarQuestions.length === 0) {
      continue
    }

    let totalActiveQuestionWeight = 0
    let earnedQuestionWeight = 0
    let hasAnswers = false

    for (const question of pillarQuestions) {
      const answerObj = answers.find(a => a.question_id === question.id)
      const answer = answerObj ? answerObj.answer : 'na'

      if (answer === 'yes') {
        earnedQuestionWeight += Number(question.weight)
        totalActiveQuestionWeight += Number(question.weight)
        hasAnswers = true
      } else if (answer === 'no') {
        totalActiveQuestionWeight += Number(question.weight)
        hasAnswers = true
      }
      // N/A ignora o peso da pergunta (exclui do cálculo deste pilar)
    }

    if (hasAnswers && totalActiveQuestionWeight > 0) {
      const pScore = (earnedQuestionWeight / totalActiveQuestionWeight) * 100
      pillarScores[pillar.id] = Number(pScore.toFixed(2))
      activePillarWeights[pillar.id] = Number(pillar.weight_percentage)
      totalActivePillarWeight += Number(pillar.weight_percentage)
    }
  }

  // 2. Calcular a pontuação Scuttlebutt ponderada apenas com os pilares ativos
  let finalScore = 0
  if (totalActivePillarWeight > 0) {
    let weightedSum = 0
    for (const pillarId of Object.keys(pillarScores)) {
      const score = pillarScores[pillarId]
      const weight = activePillarWeights[pillarId]
      weightedSum += score * weight
    }
    finalScore = weightedSum / totalActivePillarWeight
  }

  return {
    score: Number(finalScore.toFixed(2)),
    pillarScores,
    activePillarWeights
  }
}

/**
 * Calcula o Score Quantitativo (Fundamentos) com base na classe do ativo e indicadores atuais
 */
export function calculateQuantitativeScore(
  assetClass: string,
  fundamentals: {
    roic: number
    dividend_yield: number
    pe_ratio: number | null
    ev_ebitda: number | null
    net_debt_ebitda: number | null
    pe_5y_average: number | null
    ev_ebitda_5y_average: number | null
    net_debt_trend_up_2y: boolean
    p_vp?: number | null
    vacancy?: number | null
    etf_fee?: number | null
    etf_tracking_error?: number | null
  },
  preferences: PortfolioQuantPreferences
): number {
  const c = assetClass.trim().toUpperCase()

  // 1. Ações (Nacionais ou Internacionais se aplicável)
  if (c.includes('AÇÃO') || c.includes('ACOES') || c.includes('AÇÕES') || c.includes('EQUITY') || c.includes('STOCK')) {
    let score = 0

    // Regra A: ROIC >= Excelente (15%) -> 30 pts. Entre 10% e 15% -> 15 pts.
    const roic = fundamentals.roic
    const minRoic = preferences.min_roic_excelente
    if (roic >= minRoic) {
      score += 30
    } else if (roic >= 10) {
      score += 15
    }

    // Regra B: Net Debt / EBITDA <= 2.5 -> 30 pts. Entre 2.5 e 4.0 -> 15 pts.
    const ndEbitda = fundamentals.net_debt_ebitda
    const maxNd = preferences.max_divida_ebitda
    if (ndEbitda !== null) {
      if (ndEbitda <= maxNd) {
        score += 30
      } else if (ndEbitda <= 4.0) {
        score += 15
      }
    } else {
      // Se não tem dívida (ex: empresas de tecnologia leves em ativos ou bancos), ganha pontuação completa pela saúde
      score += 30
    }

    // Regra C: Valuations Múltiplos <= Média 5 anos -> 20 pts.
    // Se tiver P/L usa P/L. Caso contrário usa EV/EBITDA. Se não houver histórico, ganha 20 pts por padrão (em linha)
    const pe = fundamentals.pe_ratio
    const peAvg = fundamentals.pe_5y_average
    const evEb = fundamentals.ev_ebitda
    const evEbAvg = fundamentals.ev_ebitda_5y_average

    if (pe !== null && peAvg !== null) {
      if (pe <= peAvg) score += 20
    } else if (evEb !== null && evEbAvg !== null) {
      if (evEb <= evEbAvg) score += 20
    } else {
      score += 20 // Default em linha
    }

    // Regra D: Tendência de Endividamento 2 anos. Se NÃO cresceu (falso) -> 20 pts.
    if (!fundamentals.net_debt_trend_up_2y) {
      score += 20
    }

    return score
  }

  // 2. FIIs
  if (c.includes('FII') || c.includes('IMOBILIARIO') || c.includes('IMOBILIÁRIO') || c.includes('REAL ESTATE')) {
    let score = 0

    // Regra A: Dividend Yield >= 8% (ou IPCA + 6%) -> 40 pts. Entre 6% e 8% -> 20 pts.
    const dy = fundamentals.dividend_yield
    if (dy >= 8) {
      score += 40
    } else if (dy >= 6) {
      score += 20
    }

    // Regra B: P/VP <= 1.05 -> 30 pts. Entre 1.05 e 1.15 -> 15 pts.
    const pvp = fundamentals.p_vp !== undefined ? fundamentals.p_vp : null
    if (pvp !== null) {
      if (pvp <= 1.05) {
        score += 30
      } else if (pvp <= 1.15) {
        score += 15
      }
    } else {
      score += 30 // Default em linha
    }

    // Regra C: Vacância Física <= 10% -> 30 pts. Entre 10% e 20% -> 15 pts.
    const vacancy = fundamentals.vacancy !== undefined ? fundamentals.vacancy : null
    if (vacancy !== null) {
      if (vacancy <= 10) {
        score += 30
      } else if (vacancy <= 20) {
        score += 15
      }
    } else {
      score += 30 // Default em linha
    }

    return score
  }

  // 3. ETFs
  if (c.includes('ETF')) {
    let score = 0

    // Regra A: Taxa de Administração <= 0.3% -> 50 pts. Entre 0.3% e 0.6% -> 25 pts.
    const fee = fundamentals.etf_fee !== undefined ? fundamentals.etf_fee : null
    if (fee !== null) {
      if (fee <= 0.3) {
        score += 50
      } else if (fee <= 0.6) {
        score += 25
      }
    } else {
      score += 50 // Default em linha
    }

    // Regra B: Tracking Error <= 2% -> 50 pts. Entre 2% e 4% -> 25 pts.
    const te = fundamentals.etf_tracking_error !== undefined ? fundamentals.etf_tracking_error : null
    if (te !== null) {
      if (te <= 2) {
        score += 50
      } else if (te <= 4) {
        score += 25
      }
    } else {
      score += 50 // Default em linha
    }

    return score
  }

  // Outros (Renda Fixa, Caixa, Cripto) -> Não se aplica
  return 100
}

export interface QuantitativeCriteriaDetail {
  name: string
  description: string
  valueFormatted: string
  pointsEarned: number
  pointsPossible: number
  passed: 'yes' | 'partial' | 'no'
}

export function getQuantitativeScoreDetails(
  assetClass: string,
  fundamentals: {
    roic: number
    dividend_yield: number
    pe_ratio: number | null
    ev_ebitda: number | null
    net_debt_ebitda: number | null
    pe_5y_average: number | null
    ev_ebitda_5y_average: number | null
    net_debt_trend_up_2y: boolean
    p_vp?: number | null
    vacancy?: number | null
    etf_fee?: number | null
    etf_tracking_error?: number | null
  },
  preferences: PortfolioQuantPreferences
): QuantitativeCriteriaDetail[] {
  const c = assetClass.trim().toUpperCase()
  const details: QuantitativeCriteriaDetail[] = []

  if (c.includes('AÇÃO') || c.includes('ACOES') || c.includes('AÇÕES') || c.includes('EQUITY') || c.includes('STOCK')) {
    // Regra A: ROIC
    const roic = fundamentals.roic
    const minRoic = preferences.min_roic_excelente
    let roicPassed: 'yes' | 'partial' | 'no' = 'no'
    let roicPoints = 0
    if (roic >= minRoic) {
      roicPassed = 'yes'
      roicPoints = 30
    } else if (roic >= 10) {
      roicPassed = 'partial'
      roicPoints = 15
    }
    details.push({
      name: 'ROIC (Retorno sobre Capital Investido)',
      description: `Alvo: >= ${minRoic}% para pontuação máxima, >= 10% para pontuação parcial`,
      valueFormatted: `${roic != null ? roic.toFixed(2) : '0.00'}%`,
      pointsEarned: roicPoints,
      pointsPossible: 30,
      passed: roicPassed
    })

    // Regra B: Net Debt / EBITDA
    const ndEbitda = fundamentals.net_debt_ebitda
    const maxNd = preferences.max_divida_ebitda
    let ndPassed: 'yes' | 'partial' | 'no' = 'yes'
    let ndPoints = 30
    if (ndEbitda !== null) {
      if (ndEbitda <= maxNd) {
        ndPassed = 'yes'
        ndPoints = 30
      } else if (ndEbitda <= 4.0) {
        ndPassed = 'partial'
        ndPoints = 15
      } else {
        ndPassed = 'no'
        ndPoints = 0
      }
    }
    details.push({
      name: 'Dívida Líquida / EBITDA',
      description: `Alvo: <= ${maxNd} para pontuação máxima, <= 4.0 para pontuação parcial`,
      valueFormatted: ndEbitda !== null ? ndEbitda.toFixed(2) : 'Sem dívida (N/A)',
      pointsEarned: ndPoints,
      pointsPossible: 30,
      passed: ndPassed
    })

    // Regra C: Valuations Múltiplos
    const pe = fundamentals.pe_ratio
    const peAvg = fundamentals.pe_5y_average
    const evEb = fundamentals.ev_ebitda
    const evEbAvg = fundamentals.ev_ebitda_5y_average
    let multPassed: 'yes' | 'no' = 'yes'
    let multPoints = 20
    let multValStr = 'Sem histórico (N/A)'
    const multDesc = 'Alvo: Múltiplo atual (P/L ou EV/EBITDA) <= média de 5 anos'

    if (pe !== null && peAvg !== null) {
      multValStr = `P/L: ${pe.toFixed(2)} (Média 5a: ${peAvg.toFixed(2)})`
      if (pe <= peAvg) {
        multPassed = 'yes'
        multPoints = 20
      } else {
        multPassed = 'no'
        multPoints = 0
      }
    } else if (evEb !== null && evEbAvg !== null) {
      multValStr = `EV/EBITDA: ${evEb.toFixed(2)} (Média 5a: ${evEbAvg.toFixed(2)})`
      if (evEb <= evEbAvg) {
        multPassed = 'yes'
        multPoints = 20
      } else {
        multPassed = 'no'
        multPoints = 0
      }
    }
    details.push({
      name: 'Múltiplos de Valuation vs Histórico',
      description: multDesc,
      valueFormatted: multValStr,
      pointsEarned: multPoints,
      pointsPossible: 20,
      passed: multPassed
    })

    // Regra D: Tendência de Endividamento
    const debtTrend = fundamentals.net_debt_trend_up_2y
    details.push({
      name: 'Tendência de Endividamento (2 anos)',
      description: 'Alvo: Dívida líquida NÃO ter crescido de forma consistente nos últimos 2 anos',
      valueFormatted: debtTrend ? 'Cresceu' : 'Estável / Diminuiu',
      pointsEarned: debtTrend ? 0 : 20,
      pointsPossible: 20,
      passed: debtTrend ? 'no' : 'yes'
    })
  } else if (c.includes('FII') || c.includes('IMOBILIARIO') || c.includes('IMOBILIÁRIO') || c.includes('REAL ESTATE')) {
    // Regra A: Dividend Yield
    const dy = fundamentals.dividend_yield
    let dyPassed: 'yes' | 'partial' | 'no' = 'no'
    let dyPoints = 0
    if (dy >= 8) {
      dyPassed = 'yes'
      dyPoints = 40
    } else if (dy >= 6) {
      dyPassed = 'partial'
      dyPoints = 20
    }
    details.push({
      name: 'Dividend Yield (%)',
      description: 'Alvo: >= 8% para pontuação máxima, >= 6% para pontuação parcial',
      valueFormatted: `${dy != null ? dy.toFixed(2) : '0.00'}%`,
      pointsEarned: dyPoints,
      pointsPossible: 40,
      passed: dyPassed
    })

    // Regra B: P/VP
    const pvp = fundamentals.p_vp !== undefined ? fundamentals.p_vp : null
    let pvpPassed: 'yes' | 'partial' | 'no' = 'yes'
    let pvpPoints = 30
    if (pvp !== null) {
      if (pvp <= 1.05) {
        pvpPassed = 'yes'
        pvpPoints = 30
      } else if (pvp <= 1.15) {
        pvpPassed = 'partial'
        pvpPoints = 15
      } else {
        pvpPassed = 'no'
        pvpPoints = 0
      }
    }
    details.push({
      name: 'Preço / Valor Patrimonial (P/VP)',
      description: 'Alvo: <= 1.05 para pontuação máxima, <= 1.15 para pontuação parcial',
      valueFormatted: pvp !== null ? pvp.toFixed(2) : 'Em linha (N/A)',
      pointsEarned: pvpPoints,
      pointsPossible: 30,
      passed: pvpPassed
    })

    // Regra C: Vacância
    const vacancy = fundamentals.vacancy !== undefined ? fundamentals.vacancy : null
    let vacPassed: 'yes' | 'partial' | 'no' = 'yes'
    let vacPoints = 30
    if (vacancy !== null) {
      if (vacancy <= 10) {
        vacPassed = 'yes'
        vacPoints = 30
      } else if (vacancy <= 20) {
        vacPassed = 'partial'
        vacPoints = 15
      } else {
        vacPassed = 'no'
        vacPoints = 0
      }
    }
    details.push({
      name: 'Vacância Física (%)',
      description: 'Alvo: <= 10% para pontuação máxima, <= 20% para pontuação parcial',
      valueFormatted: vacancy !== null ? `${vacancy.toFixed(2)}%` : 'Em linha (N/A)',
      pointsEarned: vacPoints,
      pointsPossible: 30,
      passed: vacPassed
    })
  } else if (c.includes('ETF')) {
    // Regra A: Taxa
    const fee = fundamentals.etf_fee !== undefined ? fundamentals.etf_fee : null
    let feePassed: 'yes' | 'partial' | 'no' = 'yes'
    let feePoints = 50
    if (fee !== null) {
      if (fee <= 0.3) {
        feePassed = 'yes'
        feePoints = 50
      } else if (fee <= 0.6) {
        feePassed = 'partial'
        feePoints = 25
      } else {
        feePassed = 'no'
        feePoints = 0
      }
    }
    details.push({
      name: 'Taxa de Administração (%)',
      description: 'Alvo: <= 0.30% para pontuação máxima, <= 0.60% para pontuação parcial',
      valueFormatted: fee !== null ? `${fee.toFixed(2)}%` : 'Em linha (N/A)',
      pointsEarned: feePoints,
      pointsPossible: 50,
      passed: feePassed
    })

    // Regra B: Tracking Error
    const te = fundamentals.etf_tracking_error !== undefined ? fundamentals.etf_tracking_error : null
    let tePassed: 'yes' | 'partial' | 'no' = 'yes'
    let tePoints = 50
    if (te !== null) {
      if (te <= 2) {
        tePassed = 'yes'
        tePoints = 50
      } else if (te <= 4) {
        tePassed = 'partial'
        tePoints = 25
      } else {
        tePassed = 'no'
        tePoints = 0
      }
    }
    details.push({
      name: 'Tracking Error (%)',
      description: 'Alvo: <= 2.0% para pontuação máxima, <= 4.0% para pontuação parcial',
      valueFormatted: te !== null ? `${te.toFixed(2)}%` : 'Em linha (N/A)',
      pointsEarned: tePoints,
      pointsPossible: 50,
      passed: tePassed
    })
  }

  return details
}

/**
 * Determina o Tier com base no Score de Qualidade Híbrido
 */
export function determineTier(score: number): 'S' | 'A' | 'B' | 'C' {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 50) return 'B'
  return 'C'
}

/**
 * Verifica se a data da última resposta Scuttlebutt está expirada (obsoleta)
 */
export function checkScuttlebuttDecay(
  lastUpdatedStr: string | undefined,
  decayDays: number
): boolean {
  if (!lastUpdatedStr) return true // Sem resposta = obsoleto
  const lastUpdated = new Date(lastUpdatedStr)
  const diffTime = Math.abs(new Date().getTime() - lastUpdated.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > decayDays
}

/**
 * Calcula o Limite Absoluto de Alocação de um Ativo
 */
export function calculateAbsoluteLimit(
  classTargetPercentage: number,
  tierLimitFactor: number // ex: 20 para 20%, 10 para 10%
): number {
  // Limite Absoluto = Target Classe * Limite Tier (fator)
  // Ex: Target Renda Variável = 40%, Tier S = 20% do target.
  // Limite Absoluto = 40% * 0.20 = 8% do total do portfólio.
  return classTargetPercentage * (tierLimitFactor / 100)
}

/**
 * Determina o estado de enquadramento do ativo
 */
export function determineEnquadramentoState(
  currentPercentage: number,
  absoluteLimit: number,
  isDecayed: boolean
): 'em_linha' | 'limite_atingido' | 'desenquadrado_excesso' | 'desenquadrado_obsoleto' {
  if (isDecayed) {
    return 'desenquadrado_obsoleto'
  }
  
  const diff = currentPercentage - absoluteLimit
  
  if (diff > 0.05) { // Tolerância de 0.05% para evitar oscilações de flutuação de cotação
    return 'desenquadrado_excesso'
  }
  
  if (Math.abs(diff) <= 0.05) {
    return 'limite_atingido'
  }
  
  return 'em_linha'
}

export interface SmartAporteSuggestion {
  ticker: string
  quantity: number
  price: number
  totalBrl: number
  currency: 'BRL' | 'USD'
  currentPercentage: number
  newPercentage: number
  convictionTier: 'S' | 'A' | 'B' | 'C'
  qualityScore: number
  absoluteLimit: number
}

export function simulateSmartAporte(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  positions: any[],
  preferences: PortfolioQuantPreferences,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupTargets: any[],
  totalValue: number,
  aporteAmount: number
): {
  suggestions: SmartAporteSuggestion[]
  fallbackAmount: number
  routingLog: string[]
} {
  const suggestions: SmartAporteSuggestion[] = []
  const routingLog: string[] = []
  let remainingAporte = aporteAmount

  routingLog.push(`Iniciando simulação com R$ ${aporteAmount.toFixed(2)} disponíveis para aporte.`)

  // 1. Identificar e calcular a defasagem macro das classes
  const classTargets = groupTargets.filter(g => g.group_type === 'class')
  if (classTargets.length === 0) {
    routingLog.push("Aviso: Nenhuma meta de classe macro definida nas configurações. Direcionando tudo para Caixa.")
    return { suggestions, fallbackAmount: remainingAporte, routingLog }
  }

  // Agrupar posições por classe para calcular a alocação atual de cada classe
  const classCurrentAllocations: Record<string, number> = {}
  for (const pos of positions) {
    const cls = pos.asset_class || 'Outros'
    classCurrentAllocations[cls] = (classCurrentAllocations[cls] || 0) + (pos.current_percentage || 0)
  }

  // Calcular defasagem para cada classe cadastrada
  const classDefasagens = classTargets.map(target => {
    const cls = target.group_name
    const current = classCurrentAllocations[cls] || 0
    const targetPct = Number(target.target_percentage)
    return {
      className: cls,
      targetPct,
      currentPct: current,
      defasagem: targetPct - current
    }
  })
  
  // Filtrar apenas as classes defasadas (defasagem > 0) e ordenar decrescente
  const defasagedClasses = classDefasagens
    .filter(c => c.defasagem > 0)
    .sort((a, b) => b.defasagem - a.defasagem)

  if (defasagedClasses.length === 0) {
    routingLog.push("Todas as classes de ativos estão em linha ou acima das metas macro.")
  } else {
    routingLog.push("Classes defasadas identificadas em ordem de prioridade:")
    for (const c of defasagedClasses) {
      routingLog.push(`- ${c.className}: defasagem de ${c.defasagem.toFixed(2)}% (Alvo: ${c.targetPct}%, Atual: ${c.currentPct.toFixed(2)}%)`)
    }
  }

  // Setores valores correntes para controle de travas setoriais
  const sectorCurrentValues: Record<string, number> = {}
  for (const pos of positions) {
    const sec = pos.sector || 'Indefinido'
    const valBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
    sectorCurrentValues[sec] = (sectorCurrentValues[sec] || 0) + valBrl
  }

  // 2. Roteamento por classe
  for (const defCls of defasagedClasses) {
    if (remainingAporte <= 0.01) break

    routingLog.push(`\n[Classe: ${defCls.className}] Tentando distribuir capital...`)

    // Identificar ativos desconsiderados por avaliação qualitativa obsoleta
    const decayedAssets = positions.filter(pos =>
      pos.asset_class === defCls.className &&
      pos.is_decayed === true
    )
    if (decayedAssets.length > 0) {
      routingLog.push(`  ↳ Aviso: Ativos desconsiderados por avaliação qualitativa expirada: ${decayedAssets.map(a => a.ticker).join(', ')}.`)
    }

    // Filtra posições da classe que estão "em linha" e com qualidade calculada
    const classPositions = positions.filter(pos => 
      pos.asset_class === defCls.className && 
      pos.enquadramento_state === 'em_linha' &&
      pos.pricing_mode !== 'cash'
    )

    if (classPositions.length === 0) {
      routingLog.push(`Nenhum ativo da classe ${defCls.className} está com status 'Em Linha' ou com avaliação qualitativa em dia.`)
      continue
    }

    // Ordenar ativos por quality_score decrescente
    const sortedPositions = [...classPositions].sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))

    routingLog.push(`Ativos elegíveis ordenados por Convicção:`)
    for (const pos of sortedPositions) {
      routingLog.push(`- ${pos.ticker}: Score ${pos.quality_score || '100'} (Tier ${pos.conviction_tier || 'S'})`)
    }

    // Distribuir para ativos elegíveis
    for (const pos of sortedPositions) {
      if (remainingAporte <= 0.01) break

      const ticker = pos.ticker.toUpperCase()
      const priceBrl = pos.currency === 'USD' ? pos.current_price * pos.usd_rate : pos.current_price
      
      if (priceBrl <= 0) {
        routingLog.push(`- ${ticker}: Preço inválido (R$ ${priceBrl.toFixed(2)}). Ignorando.`)
        continue
      }

      // Limite absoluto financeiro do ativo após o aporte
      const absoluteLimitPct = pos.absolute_limit || 100
      const currentValBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
      const maxValBrlAfterAporte = (absoluteLimitPct / 100) * (totalValue + aporteAmount)
      const roomBrl = maxValBrlAfterAporte - currentValBrl

      if (roomBrl <= 0) {
        routingLog.push(`- ${ticker}: Sem margem financeira restante para o limite absoluto (${absoluteLimitPct.toFixed(2)}%).`)
        continue
      }

      // Limite setorial para travas
      const sector = pos.sector || 'Indefinido'
      const isStock = defCls.className.toLowerCase().includes('ação') || defCls.className.toLowerCase().includes('acoes') || defCls.className.toLowerCase().includes('ações')
      const isFii = defCls.className.toLowerCase().includes('fii') || defCls.className.toLowerCase().includes('imobil')
      
      let sectorCapPct = 100
      if (isStock) sectorCapPct = preferences.max_sector_acoes
      else if (isFii) sectorCapPct = preferences.max_sector_fiis

      const sectorValBrl = sectorCurrentValues[sector] || 0
      const maxSectorValBrl = (sectorCapPct / 100) * (totalValue + aporteAmount)
      const sectorRoomBrl = maxSectorValBrl - sectorValBrl

      if (sectorRoomBrl <= 0) {
        routingLog.push(`- ${ticker}: Travado pelo limite do setor ${sector} (${sectorCapPct.toFixed(2)}%).`)
        continue
      }

      // O orçamento disponível para este ativo é o menor entre o aporte restante, roomBrl e sectorRoomBrl
      const budgetBrl = Math.min(remainingAporte, roomBrl, sectorRoomBrl)

      // Quantidade inteira de cotas/ações a comprar
      const quantity = Math.floor(budgetBrl / priceBrl)

      if (quantity > 0) {
        const costBrl = quantity * priceBrl
        remainingAporte -= costBrl
        
        sectorCurrentValues[sector] = (sectorCurrentValues[sector] || 0) + costBrl
        
        const newPct = ((currentValBrl + costBrl) / (totalValue + aporteAmount)) * 100

        suggestions.push({
          ticker: pos.ticker,
          quantity,
          price: pos.current_price,
          totalBrl: costBrl,
          currency: pos.currency,
          currentPercentage: pos.current_percentage,
          newPercentage: newPct,
          convictionTier: pos.conviction_tier || 'S',
          qualityScore: pos.quality_score || 100,
          absoluteLimit: absoluteLimitPct
        })

        routingLog.push(`- ${ticker}: Alocado R$ ${costBrl.toFixed(2)} (${quantity} cotas). Novo peso estimado: ${newPct.toFixed(2)}% (Limite: ${absoluteLimitPct.toFixed(2)}%)`)
      } else {
        routingLog.push(`- ${ticker}: Preço unitário (R$ ${priceBrl.toFixed(2)}) maior que o orçamento disponível (R$ ${budgetBrl.toFixed(2)}).`)
      }
    }
  }

  // 3. Sobra de caixa ou Rota de Fuga geral
  if (remainingAporte > 0.01) {
    routingLog.push(`\n[Sobra de Caixa] Direcionando R$ ${remainingAporte.toFixed(2)} residual para a classe de Caixa / Reserva Tática.`)
  }

  return {
    suggestions,
    fallbackAmount: Number(remainingAporte.toFixed(2)),
    routingLog
  }
}
