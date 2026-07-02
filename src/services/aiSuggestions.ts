import { formatCurrency, formatMonth, formatNumberWithTwoDecimalsBR } from '@/utils/format'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CategoryExpenseSummary {
  category_name: string
  total: number
  baseTotal: number
}

export interface WeekdayExpense {
  dia: string
  Despesas: number
}

export interface IncomeCategorySummary {
  name: string
  total: number
}

export interface SpendingPaceInfo {
  overPct: number
  isOverBudget: boolean
}

export interface SpendingProjectionInfo {
  daysElapsed: number
  daysInMonth: number
  currentDay: number
  dailyBurnRate: number
  projectedEndOfMonthExpenses: number
  projectedSurplus: number
  onTrack: boolean
  mode: 'past' | 'current'
}

export interface AnalysisInput {
  currentMonth: string
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  savingsRate: number
  categoryExpenseSummaries: CategoryExpenseSummary[]
  previousMonthExpenseTotal: number
  weekdayExpenseData: WeekdayExpense[]
  limitsExceededCount: number
  incomeByCategory: IncomeCategorySummary[]
  spendingPace: SpendingPaceInfo | null
  spendingProjection: SpendingProjectionInfo | null
  balance: number
  /** Número total de despesas no mês (para hash de pin) */
  expensesCount: number
  /** Número total de rendas no mês (para hash de pin) */
  incomesCount: number
}

export interface RawSuggestion {
  id: string
  text: string
  tip: string
  query: string
  iconId: string
}

/* ------------------------------------------------------------------ */
/*  Dynamic Insights Generator (pure, no JSX)                          */
/* ------------------------------------------------------------------ */

export function generateDynamicSuggestions(input: AnalysisInput): RawSuggestion[] {
  const {
    limitsExceededCount,
    totalIncomes,
    savingsRate,
    currentMonth,
    previousMonthExpenseTotal,
    totalExpenses,
    categoryExpenseSummaries,
    weekdayExpenseData,
    totalInvestments,
    incomeByCategory,
    spendingPace,
    spendingProjection,
  } = input

  const list: RawSuggestion[] = []

  // 1. Limits Exceeded (Most critical warning)
  if (limitsExceededCount > 0) {
    list.push({
      id: 'limits-exceeded',
      text: `Limite estourado em ${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'}.`,
      tip: 'Reduza gastos nas demais categorias imediatamente para equilibrar o orçamento.',
      query: `Quais estratégias posso usar para conter gastos nas ${limitsExceededCount} categorias onde estourei o limite de orçamento?`,
      iconId: 'alert-triangle-expense',
    })
  }

  // 2. Savings Rate Insight
  if (totalIncomes > 0) {
    if (savingsRate >= 20) {
      list.push({
        id: 'savings-rate',
        text: `Poupou ${formatNumberWithTwoDecimalsBR(savingsRate)}% da renda em ${formatMonth(currentMonth)} (meta: 20%).`,
        tip: 'Excelente! Direcione este excedente poupado para investimentos e acelere seus planos.',
        query: `Como posso otimizar meus investimentos considerando que poupei ${formatNumberWithTwoDecimalsBR(savingsRate)}% da minha renda este mês?`,
        iconId: 'trending-down-income',
      })
    } else if (savingsRate > 0 && savingsRate < 20) {
      list.push({
        id: 'savings-rate',
        text: `Poupança em ${formatNumberWithTwoDecimalsBR(savingsRate)}% da renda (abaixo da meta de 20%).`,
        tip: 'Corte pequenos gastos supérfluos para tentar atingir a meta recomendada.',
        query: `Como posso aumentar minha taxa de poupança atual de ${formatNumberWithTwoDecimalsBR(savingsRate)}% para a meta saudável de 20%?`,
        iconId: 'trending-up-primary',
      })
    } else if (savingsRate <= 0) {
      list.push({
        id: 'savings-rate',
        text: `Saldo líquido negativo em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% este mês.`,
        tip: 'Alerta: Suas despesas superaram a renda. Evite qualquer compra supérflua de imediato.',
        query: `Quais ações imediatas devo tomar porque minhas despesas superaram minhas receitas em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% este mês?`,
        iconId: 'alert-triangle-expense',
      })
    }
  }

  // 3. Expense Variation
  if (previousMonthExpenseTotal > 0 && totalExpenses > 0) {
    const diffPct = ((totalExpenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100
    if (diffPct < -5) {
      list.push({
        id: 'expense-variance',
        text: `Despesas caíram ${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}% comparado ao mês anterior.`,
        tip: 'Bom trabalho! Continue mantendo esse ritmo disciplinado para poupar mais.',
        query: `Analise a redução de despesas de ${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}% que tive em relação ao mês anterior e como manter essa tendência.`,
        iconId: 'trending-down-income',
      })
    } else if (diffPct > 5) {
      list.push({
        id: 'expense-variance',
        text: `Despesas subiram ${formatNumberWithTwoDecimalsBR(diffPct)}% comparado ao mês anterior.`,
        tip: 'Atenção: Modere o consumo diário nas semanas restantes para conter essa alta.',
        query: `Quais fatores e categorias causaram o aumento de ${formatNumberWithTwoDecimalsBR(diffPct)}% nas minhas despesas em comparação com o mês anterior?`,
        iconId: 'trending-up-expense',
      })
    }
  }

  // 4. Top Category
  if (categoryExpenseSummaries.length > 0 && totalExpenses > 0) {
    const sorted = [...categoryExpenseSummaries].sort((a, b) => b.total - a.total)
    const topCat = sorted[0]
    const topPct = (topCat.total / totalExpenses) * 100
    if (topPct > 15) {
      list.push({
        id: 'top-category',
        text: `"${topCat.category_name}" foi seu maior custo (${formatCurrency(topCat.total)} - ${formatNumberWithTwoDecimalsBR(topPct)}%).`,
        tip: 'Defina um limite específico para esta categoria para reduzir o impacto no total.',
        query: `Como posso economizar e cortar gastos na minha maior categoria de despesas: ${topCat.category_name}, onde gastei ${formatCurrency(topCat.total)}?`,
        iconId: 'sparkles-primary',
      })
    }
  }

  // 5. Peak Weekday
  if (weekdayExpenseData && weekdayExpenseData.length > 0) {
    const sortedDays = [...weekdayExpenseData].sort((a, b) => b.Despesas - a.Despesas)
    const peakDay = sortedDays[0]
    if (peakDay && peakDay.Despesas > 0) {
      const fullDayNames: Record<string, string> = {
        Seg: 'Segunda-feira', Ter: 'Terça-feira', Qua: 'Quarta-feira',
        Qui: 'Quinta-feira', Sex: 'Sexta-feira', Sáb: 'Sábado', Dom: 'Domingo',
      }
      list.push({
        id: 'peak-weekday',
        text: `Pico de gastos na(o) ${fullDayNames[peakDay.dia] || peakDay.dia} (${formatCurrency(peakDay.Despesas)}).`,
        tip: 'Evite compras impulsivas concentradas nesse dia da semana. Planeje os gastos.',
        query: `Como posso controlar melhor as compras por impulso ou despesas recorrentes concentradas no dia: ${fullDayNames[peakDay.dia] || peakDay.dia}?`,
        iconId: 'calendar-primary',
      })
    }
  }

  // 6. Investment Ratio
  if (totalIncomes > 0 && totalInvestments > 0) {
    const investPct = (totalInvestments / totalIncomes) * 100
    if (investPct >= 15) {
      list.push({
        id: 'investment-ratio',
        text: `Aportou ${formatNumberWithTwoDecimalsBR(investPct)}% da renda em investimentos.`,
        tip: 'Continue nesse ritmo para acelerar a construção do seu patrimônio líquido.',
        query: `Como posso otimizar a alocação dos meus ${formatCurrency(totalInvestments)} em investimentos para maximizar retornos ajustados ao risco?`,
        iconId: 'piggy-bank-balance',
      })
    } else if (investPct > 0 && investPct < 15) {
      list.push({
        id: 'investment-ratio',
        text: `Apenas ${formatNumberWithTwoDecimalsBR(investPct)}% da renda foi investida.`,
        tip: 'Tente aumentar para ao menos 15% — reveja assinaturas e gastos recorrentes.',
        query: `Quais despesas posso cortar para aumentar minha taxa de investimento de ${formatNumberWithTwoDecimalsBR(investPct)}% para pelo menos 15%?`,
        iconId: 'piggy-bank-primary',
      })
    }
  }

  // 7. Income Concentration
  if (incomeByCategory.length > 0 && totalIncomes > 0) {
    const topIncome = incomeByCategory[0]
    const topPct = (topIncome.total / totalIncomes) * 100
    if (topPct > 50) {
      list.push({
        id: 'income-concentration',
        text: `${topIncome.name} representa ${formatNumberWithTwoDecimalsBR(topPct)}% da sua renda.`,
        tip: 'Dependência alta de uma única fonte. Considere diversificar para reduzir riscos.',
        query: `Minha renda está muito concentrada em ${topIncome.name} (${formatNumberWithTwoDecimalsBR(topPct)}% do total). Como posso diversificar minhas fontes de receita?`,
        iconId: 'trending-up-warning',
      })
    }
  }

  // 8. Spending Pace
  if (spendingPace && spendingPace.isOverBudget && spendingPace.overPct > 5) {
    list.push({
      id: 'spending-pace',
      text: `Ritmo de gastos ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do esperado para esta altura do mês.`,
      tip: 'Ajuste o ritmo nos próximos dias para não estourar o orçamento mensal.',
      query: `Meus gastos estão ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do ritmo esperado para esta altura do mês. Quais categorias devo priorizar para cortar?`,
      iconId: 'alert-triangle-expense',
    })
  }

  // 9. End-of-Month Projection
  if (spendingProjection && spendingProjection.currentDay >= 10) {
    if (!spendingProjection.onTrack) {
      list.push({
        id: 'end-of-month-projection',
        text: `Projeção de déficit de ${formatCurrency(Math.abs(spendingProjection.projectedSurplus))} no fim do mês.`,
        tip: `Seu ritmo atual de ${formatCurrency(spendingProjection.dailyBurnRate)}/dia excede o orçamento. Corte gastos descartáveis agora para evitar o vermelho.`,
        query: `Minhas despesas projetam um déficit de ${formatCurrency(Math.abs(spendingProjection.projectedSurplus))} para o fim do mês. Quais categorias devo cortar imediatamente para equilibrar as contas?`,
        iconId: 'alert-triangle-expense',
      })
    } else if (spendingProjection.projectedSurplus > 0 && spendingProjection.projectedSurplus < totalIncomes * 0.05) {
      list.push({
        id: 'end-of-month-projection',
        text: `Margem apertada: projeção de superávit de apenas ${formatCurrency(spendingProjection.projectedSurplus)}.`,
        tip: 'Pequenos cortes agora podem transformar este aperto em uma folga confortável para investir.',
        query: `Meu saldo projetado para o fim do mês é de apenas ${formatCurrency(spendingProjection.projectedSurplus)}. Que pequenos cortes posso fazer nas despesas diárias para melhorar essa margem?`,
        iconId: 'trending-up-warning',
      })
    } else if (spendingProjection.projectedSurplus >= totalIncomes * 0.15) {
      list.push({
        id: 'end-of-month-projection',
        text: `Folga de ${formatCurrency(spendingProjection.projectedSurplus)} projetada. Ótimo ritmo!`,
        tip: `Com essa folga, você pode direcionar ${formatCurrency(spendingProjection.projectedSurplus * 0.5)} para investimentos e ainda manter ${formatCurrency(spendingProjection.projectedSurplus * 0.5)} de reserva.`,
        query: `Tenho uma folga projetada de ${formatCurrency(spendingProjection.projectedSurplus)} para o fim do mês. Como alocar esse excedente entre investimentos e reserva de emergência?`,
        iconId: 'check-circle-income',
      })
    }
  }

  // 10. Expense-to-Income Ratio (burn rate)
  if (totalIncomes > 0) {
    const burnRate = (totalExpenses / totalIncomes) * 100
    if (burnRate > 85) {
      list.push({
        id: 'burn-rate',
        text: `${formatNumberWithTwoDecimalsBR(burnRate)}% da renda consumida por despesas.`,
        tip: 'Alerta vermelho: sobra muito pouco para investir. Corte gastos supérfluos agora.',
        query: `Quais são as despesas não-essenciais que mais impactam minha taxa de consumo de ${formatNumberWithTwoDecimalsBR(burnRate)}% e como reduzi-las?`,
        iconId: 'alert-triangle-expense',
      })
    } else if (burnRate <= 50) {
      list.push({
        id: 'burn-rate',
        text: `Apenas ${formatNumberWithTwoDecimalsBR(burnRate)}% da renda vai para despesas.`,
        tip: 'Excelente controle! Considere aumentar seus aportes mensais.',
        query: `Com uma taxa de despesas de apenas ${formatNumberWithTwoDecimalsBR(burnRate)}%, como posso melhor alocar o excedente entre reserva de emergência e investimentos?`,
        iconId: 'check-circle-income',
      })
    }
  }

  // Priority ordering
  const priorityOrder: Record<string, number> = {
    'savings-rate': 0,
    'limits-exceeded': 90,
    'spending-pace': 85,
    'burn-rate': 80,
    'expense-variance': 70,
    'income-concentration': 60,
    'investment-ratio': 50,
    'top-category': 40,
    'peak-weekday': 30,
    'end-of-month-projection': 85,
  }

  list.sort((a, b) => {
    const aIsNeg = a.id === 'savings-rate' && a.text.includes('negativo')
    const bIsNeg = b.id === 'savings-rate' && b.text.includes('negativo')
    if (aIsNeg && !bIsNeg) return -1
    if (!aIsNeg && bIsNeg) return 1

    const aIsHighBurn = a.id === 'burn-rate' && a.text.includes('consumida')
    const bIsHighBurn = b.id === 'burn-rate' && b.text.includes('consumida')
    if (aIsHighBurn && !bIsHighBurn) return -1
    if (!aIsHighBurn && bIsHighBurn) return 1

    const pa = priorityOrder[a.id] ?? 50
    const pb = priorityOrder[b.id] ?? 50
    return pb - pa
  })

  // Limit to at most 3 insights
  return list.slice(0, 3)
}

/* ------------------------------------------------------------------ */
/*  Local Analysis Builder (pure, no JSX)                              */
/* ------------------------------------------------------------------ */

function formatBurnRateBar(rate: number): string {
  const filled = Math.round(rate / 10)
  const empty = 10 - filled
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty))
}

export function buildLocalAnalysis(input: AnalysisInput, _context?: string): string {
  const {
    currentMonth, totalIncomes, totalExpenses, totalInvestments,
    balance, savingsRate, categoryExpenseSummaries, limitsExceededCount,
    previousMonthExpenseTotal, weekdayExpenseData, incomeByCategory,
    spendingPace, spendingProjection,
  } = input

  const lines: string[] = []

  // ── 1. Header ──
  lines.push(`📊 **Panorama Financeiro de ${formatMonth(currentMonth)}**`)
  lines.push('')

  // ── 2. Tabela de Indicadores ──
  lines.push('**Indicador** | ** Valor**')
  lines.push('---|---')
  lines.push(`Receitas | ${formatCurrency(totalIncomes)}`)
  lines.push(`Despesas | ${formatCurrency(totalExpenses)}`)
  if (totalInvestments > 0) lines.push(`Investimentos | ${formatCurrency(totalInvestments)}`)
  lines.push(`Saldo | ${formatCurrency(balance)}`)
  lines.push(`Taxa de Poupança | **${formatNumberWithTwoDecimalsBR(savingsRate)}%**`)
  lines.push('')

  // ── 3. Health Score Bar ──
  if (totalIncomes > 0) {
    const burnRate = (totalExpenses / totalIncomes) * 100
    const bar = formatBurnRateBar(burnRate)
    
    if (burnRate > 85) {
      lines.push(`⚠️ **Risco Alto** — ${formatNumberWithTwoDecimalsBR(burnRate)}% da renda em despesas`)
      lines.push(`\`${bar}\` — Sobra apenas ${formatCurrency(balance)} para investir.`)
    } else if (burnRate > 70) {
      lines.push(`⚡ **Atenção** — ${formatNumberWithTwoDecimalsBR(burnRate)}% da renda em despesas`)
      lines.push(`\`${bar}\` — Margem apertada para poupança.`) 
    } else if (burnRate <= 50) {
      lines.push(`✅ **Saudável** — Apenas ${formatNumberWithTwoDecimalsBR(burnRate)}% da renda em despesas`)
      lines.push(`\`${bar}\` — Excelente controle financeiro!`)
    } else {
      lines.push(`📊 **Consumo Moderado** — ${formatNumberWithTwoDecimalsBR(burnRate)}% da renda em despesas`)
      lines.push(`\`${bar}\` — Considere aumentar aportes para atingir 50%.`)
    }
    lines.push('')
  }

  // ── 4. Top Categorias (formatted as table) ──
  if (categoryExpenseSummaries.length > 0 && totalExpenses > 0) {
    lines.push('**Categoria** | **Valor** | **%**')
    lines.push('---|---|---')
    
    const sortedCats = [...categoryExpenseSummaries].sort((a, b) => b.total - a.total)
    sortedCats.slice(0, 5).forEach((cat) => {
      const pct = (cat.total / totalExpenses) * 100
      lines.push(`${cat.category_name} | ${formatCurrency(cat.total)} | ${formatNumberWithTwoDecimalsBR(pct)}%`)
    })
    lines.push('')
  }

  // ── 5. Variação vs Mês Anterior ──
  if (previousMonthExpenseTotal > 0 && totalExpenses > 0) {
    const diffPct = ((totalExpenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100
    if (Math.abs(diffPct) > 3) {
      const direction = diffPct > 0 ? '📈 **Aumento**' : '📉 **Queda**'
      lines.push(`${direction} de **${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}%** nas despesas vs mês anterior.`)
      if (diffPct > 0) {
        const topGainer = categoryExpenseSummaries
          ?.slice()
          .sort((a, b) => b.total - a.total)[0]
        if (topGainer) {
          lines.push(`   Principal contribuição: **${topGainer.category_name}** (${formatCurrency(topGainer.total)}).`)
        }
      }
      lines.push('')
    }
  }

  // ── 6. Income Concentration ──
  if (incomeByCategory.length > 0 && totalIncomes > 0) {
    const topIncome = incomeByCategory[0]
    const topPct = (topIncome.total / totalIncomes) * 100
    if (topPct > 50) {
      lines.push(`⚠️ **Dependência Financeira** — ${topIncome.name} representa **${formatNumberWithTwoDecimalsBR(topPct)}%** da sua renda.`)
      lines.push('   Considere diversificar para reduzir riscos de concentração.')
      lines.push('')
    }
  }

  // ── 7. Spending Pace ──
  if (spendingPace && spendingPace.isOverBudget && spendingPace.overPct > 5) {
    lines.push(`⚡ **Ritmo Acelerado** — Gastos **${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}%** acima do esperado.`)
    lines.push('   Reveja categorias discricionárias para equilibrar o orçamento.')
    lines.push('')
  }

  // ── 8. End-of-Month Projection ──
  if (spendingProjection && spendingProjection.currentDay >= 10) {
    if (!spendingProjection.onTrack) {
      const deficit = Math.abs(spendingProjection.projectedSurplus)
      lines.push(`🔴 **Déficit Projetado** — ${formatCurrency(deficit)} no fim do mês.`)
      lines.push(`   Ritmo: ${formatCurrency(spendingProjection.dailyBurnRate)}/dia. Corte gastos agora.`)
      const barFilled = Math.round((spendingProjection.currentDay / spendingProjection.daysInMonth) * 10)
      lines.push(`   ${'█'.repeat(barFilled)}${'░'.repeat(10 - barFilled)} Dia ${spendingProjection.currentDay}/${spendingProjection.daysInMonth}`)
      lines.push('')
    } else if (spendingProjection.projectedSurplus > 0 && spendingProjection.projectedSurplus < totalIncomes * 0.05) {
      lines.push(`🟡 **Margem Apertada** — Superávit projetado de apenas ${formatCurrency(spendingProjection.projectedSurplus)}.`)
      lines.push('   Pequenos cortes agora podem gerar folga para investir.')
      lines.push('')
    } else if (spendingProjection.projectedSurplus >= totalIncomes * 0.15) {
      lines.push(`🟢 **Folga Saudável** — ${formatCurrency(spendingProjection.projectedSurplus)} projetados.`)
      lines.push(`   Considere alocar **${formatCurrency(spendingProjection.projectedSurplus * 0.5)}** em investimentos.`)
      lines.push('')
    }
  }

  // ── 9. Limites Estourados ──
  if (limitsExceededCount > 0) {
    lines.push(`🔴 **${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'} com limite estourado.**`)
    lines.push('   Acesse a seção de limites para reajustar o orçamento.')
    lines.push('')
  }

  // ── 10. Peak Weekday ──
  if (weekdayExpenseData && weekdayExpenseData.length > 0) {
    const sortedDays = [...weekdayExpenseData].sort((a, b) => b.Despesas - a.Despesas)
    const peakDay = sortedDays[0]
    if (peakDay && peakDay.Despesas > 0) {
      const fullDayNames: Record<string, string> = {
        Seg: 'Segunda', Ter: 'Terça', Qua: 'Quarta',
        Qui: 'Quinta', Sex: 'Sexta', Sáb: 'Sábado', Dom: 'Domingo',
      }
      lines.push(`📅 **Pico Semanal** — ${fullDayNames[peakDay.dia] || peakDay.dia} (${formatCurrency(peakDay.Despesas)})`)
      lines.push('   Planeje compras e evite gastos impulsivos neste dia.')
      lines.push('')
    }
  }

  // ── 11. Investment Insight ──
  if (totalIncomes > 0 && totalInvestments > 0) {
    const investPct = (totalInvestments / totalIncomes) * 100
    if (investPct >= 15) {
      lines.push(`💰 **Bom Aporte** — ${formatNumberWithTwoDecimalsBR(investPct)}% da renda investida. Continue assim!`)
      lines.push('')
    } else if (investPct > 0 && investPct < 15) {
      lines.push(`💡 **Meta de Investimento** — Atualmente ${formatNumberWithTwoDecimalsBR(investPct)}%. Tente atingir 15%.`)
      const gap = (totalIncomes * 0.15) - totalInvestments
      lines.push(`   Aumente seus aportes mensais em **${formatCurrency(gap)}** para atingir a meta.`)
      lines.push('')
    }
  }

  // ── 12. Savings Rate Goal ──
  if (totalIncomes > 0 && savingsRate < 20) {
    const gap = (totalIncomes * 0.2) - balance
    if (gap > 0) {
      lines.push(`🎯 **Meta de Poupança (20%)** — Faltam **${formatCurrency(gap)}**/mês para atingir.`)
      lines.push('')
    }
  }

  // ── 13. Summary Footer ──
  lines.push('---')
  const summaryParts: string[] = []
  if (totalIncomes > 0) {
    const burnRate = (totalExpenses / totalIncomes) * 100
    if (burnRate <= 50) summaryParts.push('✅ Controle excelente')
    else if (burnRate > 85) summaryParts.push('🔴 Risco alto')
    else summaryParts.push('📊 Consumo moderado')
  }
  if (savingsRate >= 20) summaryParts.push('💰 Poupança na meta')
  if (limitsExceededCount === 0) summaryParts.push('📋 Limites ok')
  else summaryParts.push('📋 Limites precisam de ajuste')
  lines.push(`**Resumo:** ${summaryParts.join(' · ')}`)

  return lines.join('\n')
}
