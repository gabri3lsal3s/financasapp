import { describe, expect, it } from 'vitest'
import { assistantParserInternals } from '@/services/assistantService'

describe('assistant parser - interpretação contextual', () => {
  it('interpreta despesa sem verbo de comando e extrai dados do contexto', () => {
    const text = 'Fui almoçar hoje na Unit, deu 140,96'
    const { intent, confidence } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(confidence).toBeGreaterThanOrEqual(0.8)
    expect(slots.amount).toBe(140.96)
    expect(slots.description).toBe('Almoço na Unit')
  })

  it('mantém localização quando disponível e usa palavra única', () => {
    const text = 'Compras em Aracaju 88,90'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.description).toBe('Compras em Aracaju')
  })

  it('evita artigo solto e usa fallback de palavra única sem localização', () => {
    const text = 'O almoço deu 35,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.description).toBe('Almoço')
  })

  it('usa descrição curta quando não há localização disponível', () => {
    const text = 'Fiz compras 57,30'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.description).toBe('Compras')
  })

  it('mantém padrão palavra-chave + local com contração no/na', () => {
    const text = 'Jantei no Giraffas 42,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(42)
    expect(slots.description).toBe('Jantar no Giraffas')
  })

  it('normaliza ifood com localização quando disponível', () => {
    const text = 'Pedi iFood em casa 63,50'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(63.5)
    expect(slots.description).toBe('Ifood em Casa')
  })
})

describe('assistant insights - momento do mês', () => {
  it('classifica início do mês como análise em andamento sem comparações fortes', () => {
    const profile = assistantParserInternals.getInsightTimingProfile('2026-03', new Date('2026-03-01T12:00:00'))

    expect(profile.analysisPhase).toBe('early')
    expect(profile.isFinalizedAnalysis).toBe(false)
    expect(profile.allowsConclusiveComparisons).toBe(false)
    expect(profile.allowsMixedComparisons).toBe(false)
  })

  it('classifica meio do mês como análise em andamento com comparações mistas', () => {
    const profile = assistantParserInternals.getInsightTimingProfile('2026-03', new Date('2026-03-16T12:00:00'))

    expect(profile.analysisPhase).toBe('middle')
    expect(profile.isFinalizedAnalysis).toBe(false)
    expect(profile.allowsConclusiveComparisons).toBe(false)
    expect(profile.allowsMixedComparisons).toBe(true)
  })

  it('classifica último dia do mês como análise finalizada com comparações conclusivas', () => {
    const profile = assistantParserInternals.getInsightTimingProfile('2026-03', new Date('2026-03-31T12:00:00'))

    expect(profile.analysisPhase).toBe('closing')
    expect(profile.isFinalizedAnalysis).toBe(true)
    expect(profile.allowsConclusiveComparisons).toBe(true)
    expect(profile.allowsMixedComparisons).toBe(false)
  })

  it('classifica mês anterior como fechado e finalizado', () => {
    const profile = assistantParserInternals.getInsightTimingProfile('2026-03', new Date('2026-04-01T12:00:00'))

    expect(profile.analysisPhase).toBe('closed')
    expect(profile.isFinalizedAnalysis).toBe(true)
    expect(profile.allowsConclusiveComparisons).toBe(true)
    expect(profile.allowsMixedComparisons).toBe(false)
  })
})

describe('assistant insights - regressões de narrativa', () => {
  it('mescla over-limit e concentração da mesma categoria em frase única', () => {
    const merged = assistantParserInternals.mergeRelatedConclusiveHighlights([
      'Compras passou do limite em 1329%.',
      'Seu padrão semanal mostra maior pressão na quarta-feira, quando seus gastos costumam pesar mais.',
      'Compras concentrou 55% das despesas do mês.',
    ])

    expect(merged).toContain('Compras passou do limite em 1329% concentrando 55% das despesas.')
    expect(merged).toContain('Seu padrão semanal mostra maior pressão na quarta-feira, quando seus gastos costumam pesar mais.')
    expect(merged.some((line) => line === 'Compras passou do limite em 1329%.')).toBe(false)
    expect(merged.some((line) => line === 'Compras concentrou 55% das despesas do mês.')).toBe(false)
  })

  it('não mescla frases quando as categorias são diferentes', () => {
    const merged = assistantParserInternals.mergeRelatedConclusiveHighlights([
      'Compras passou do limite em 1329%.',
      'Alimentação concentrou 55% das despesas do mês.',
    ])

    expect(merged).toHaveLength(2)
    expect(merged).toContain('Compras passou do limite em 1329%.')
    expect(merged).toContain('Alimentação concentrou 55% das despesas do mês.')
  })

  it('gera somente recomendações contextuais para mês em andamento', () => {
    const recommendations = assistantParserInternals.buildInProgressRecommendations(
      [
        'Alimentação está concentrando 100% das despesas do mês.',
        'Há um pico de gastos em terça-feira acima do seu padrão diário até aqui.',
      ],
      [
        'Use os padrões já vistos no mês para reduzir pressão nos dias restantes e preservar margem de segurança.',
      ],
    )

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.length).toBeLessThanOrEqual(3)
    expect(recommendations.some((line) => /Com base no andamento atual do mês/i.test(line))).toBe(true)
    expect(recommendations.some((line) => line.includes('Alimentação está concentrando 100% das despesas do mês'))).toBe(true)
  })
})

describe('assistant parser - despesas por contexto de categoria', () => {
  it('identifica transporte com uber sem verbo de comando', () => {
    const text = 'Paguei uber 23,90 ontem'
    const { intent, confidence } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(confidence).toBeGreaterThanOrEqual(0.8)
    expect(slots.amount).toBe(23.9)
    expect(slots.description).toBe('Uber')
  })

  it('identifica moradia com conta de internet', () => {
    const text = 'Conta de internet 120,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(120)
    expect(slots.description).toBe('Internet')
  })

  it('identifica saúde com farmácia e local', () => {
    const text = 'Farmácia no centro 75,20'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(75.2)
    expect(slots.description).toBe('Farmácia no Centro')
  })
})

describe('assistant parser - rendas por contexto de categoria', () => {
  it('identifica renda de salário em contexto natural', () => {
    const text = 'Recebi salário hoje 3500,00'
    const { intent, confidence } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    expect(confidence).toBeGreaterThanOrEqual(0.8)
    expect(slots.amount).toBe(3500)
    expect(slots.date).toBeDefined()
  })

  it('identifica renda de freelancer', () => {
    const text = 'Ganhei freela 800,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    expect(slots.amount).toBe(800)
  })

  it('identifica renda de dividendos', () => {
    const text = 'Entrou dividendo 120,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    expect(slots.amount).toBe(120)
  })

  it('identifica renda de aluguel recebido', () => {
    const text = 'Recebi aluguel 1500,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    expect(slots.amount).toBe(1500)
  })

  it('classifica pix recebido como renda', () => {
    const text = 'Recebi pix do cliente 480,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    expect(slots.amount).toBe(480)
  })

  it('classifica pagamento via pix como despesa', () => {
    const text = 'Paguei pix do aluguel 1200,00'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(1200)
  })
})

describe('assistant parser - investimentos e casos de controle', () => {
  it('identifica investimento por contexto de aporte/corretora', () => {
    const text = 'Apliquei 500,00 na corretora'
    const { intent, confidence } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_investment')
    expect(confidence).toBeGreaterThanOrEqual(0.8)
    expect(slots.amount).toBe(500)
    expect(slots.month).toBeDefined()
  })

  it('classifica aporte no tesouro como investimento', () => {
    const text = 'Aportei 350 no tesouro'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_investment')
    expect(slots.amount).toBe(350)
  })

  it('interpreta decimal com vírgula sem quebrar em dois lançamentos', () => {
    const text = 'Paguei 19,98 reais no café'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(19.98)
    expect(slots.items).toBeUndefined()
  })

  it('interpreta decimal com ponto sem quebrar em dois lançamentos', () => {
    const text = 'Paguei 19.98 reais no café'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(19.98)
    expect(slots.items).toBeUndefined()
  })

  it('interpreta valor falado com reais e centavos por extenso', () => {
    const text = 'Paguei dezenove e noventa e oito reais no café'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(19.98)
    expect(slots.items).toBeUndefined()
  })

  it('interpreta valor com conectivo "com"', () => {
    const text = 'Paguei 19 com 98 no café'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(19.98)
    expect(slots.items).toBeUndefined()
  })

  it('interpreta valor com reais e centavos numéricos', () => {
    const text = 'Paguei 19 reais e 98 centavos no café'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(19.98)
    expect(slots.items).toBeUndefined()
  })

  it('interpreta valor com reais e centavos por extenso', () => {
    const text = 'Paguei dezenove reais e noventa e oito centavos no café'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(19.98)
    expect(slots.items).toBeUndefined()
  })

  it('extrai parcelamento no formato "em X parcelas"', () => {
    const text = 'Paguei 1200 em 6 parcelas no notebook'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(1200)
    expect(slots.installment_count).toBe(6)
  })

  it('extrai parcelamento no formato "Xx"', () => {
    const text = 'Registre despesa de 450 3x academia'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.amount).toBe(450)
    expect(slots.installment_count).toBe(3)
  })

  it('não confunde divisão de conta com parcelamento', () => {
    const text = 'Jantar 90 e dividimos em 3'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.installment_count).toBeUndefined()
  })

  it('mantém unknown quando não há valor financeiro', () => {
    const text = 'Fui almoçar na Unit'
    const { intent, confidence } = assistantParserInternals.inferIntent(text)

    expect(intent).toBe('unknown')
    expect(confidence).toBeLessThan(0.5)
  })

  it('interpreta comando composto com despesas e investimento no mesmo contexto', () => {
    const text = 'Hoje comprei a capinha do meu celular, ficou 80 reais, em seguida almocei com Glenda, deu 20,50, mas dividimos a conta para os dois e consegui investir 100 reais na bolsa.'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(slots.items).toBeDefined()
    expect(slots.items).toHaveLength(3)

    const [first, second, third] = slots.items || []

    expect(first.transactionType).toBe('expense')
    expect(first.amount).toBe(80)
    expect(first.description).toBe('Capinha do Meu Celular')

    expect(second.transactionType).toBe('expense')
    expect(second.amount).toBe(20.5)
    expect(second.description).toBe('Almoço com Glenda')
    expect(second.report_weight).toBe(0.5)

    expect(third.transactionType).toBe('investment')
    expect(third.amount).toBe(100)
    expect(third.description).toBe('Investimento na Bolsa')
  })

  it('calcula valor no relatório para despesa compartilhada com amigos', () => {
    const text = 'Fui ao parque com 5 amigos, a conta deu 48,50, dividimos entre nós.'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    expect(slots.items).toBeDefined()
    expect(slots.items).toHaveLength(1)

    const [item] = slots.items || []
    expect(item.transactionType).toBe('expense')
    expect(item.description).toBe('Parque com 5 Amigos')
    expect(item.amount).toBe(48.5)
    expect(item.report_weight).toBe(0.2)
    expect(Number((item.amount * Number(item.report_weight)).toFixed(2))).toBe(9.7)
  })

  it('aplica lógica de divisão também para renda compartilhada', () => {
    const text = 'Recebi 1200 de um projeto com 3 parceiros e dividimos entre nós.'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    expect(slots.items).toBeDefined()
    expect(slots.items).toHaveLength(1)

    const [item] = slots.items || []
    expect(item.transactionType).toBe('income')
    expect(item.amount).toBe(1200)
    expect(item.report_weight).toBeCloseTo(1 / 3, 4)
  })

  it('entende divisão com "dividimos por X"', () => {
    const text = 'Fomos ao cinema, deu 90,00 e dividimos por 3'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(90)
    expect(item.report_weight).toBeCloseTo(1 / 3, 4)
  })

  it('entende divisão com "dividimos em X"', () => {
    const text = 'No churrasco gastamos 120 e dividimos em 4'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(120)
    expect(item.report_weight).toBe(0.25)
  })

  it('prioriza valor explícito da minha parte no cálculo de relatório', () => {
    const text = 'Jantar com amigos deu 120, minha parte foi 30'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(120)
    expect(item.report_weight).toBe(0.25)
  })

  it('entende expressão "cada um pagou" para renda compartilhada', () => {
    const text = 'Recebemos 1500 no projeto, cada um pagou 500'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_income')
    const [item] = slots.items || []
    expect(item.amount).toBe(1500)
    expect(item.report_weight).toBeCloseTo(1 / 3, 4)
  })

  it('entende expressão "por cabeça"', () => {
    const text = 'Conta do bar deu 84, por cabeça 21'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(84)
    expect(item.report_weight).toBe(0.25)
  })

  it('entende expressão coloquial "o meu saiu"', () => {
    const text = 'Rodízio deu 160, o meu saiu 40'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(160)
    expect(item.report_weight).toBe(0.25)
  })

  it('entende expressão coloquial "cada um deu"', () => {
    const text = 'Pizza 120, cada um deu 30'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(120)
    expect(item.report_weight).toBe(0.25)
  })

  it('mantém fallback de divisão meio a meio com "rachou"', () => {
    const text = 'Almoço 54, rachou'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(54)
    expect(item.report_weight).toBe(0.5)
  })

  it('entende variação abreviada "pra mim deu"', () => {
    const text = 'Conta deu 80, pra mim deu 20'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(80)
    expect(item.report_weight).toBe(0.25)
  })

  it('entende variação curta "meu foi"', () => {
    const text = 'Jantar 100, meu foi 25'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(100)
    expect(item.report_weight).toBe(0.25)
  })

  it('entende variação numérica "cada 1 pagou"', () => {
    const text = 'Compras 150, cada 1 pagou 50'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(150)
    expect(item.report_weight).toBeCloseTo(1 / 3, 4)
  })

  it('entende transcrição sem espaço "pramim"', () => {
    const text = 'Conta 90, pramim deu 30'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(90)
    expect(item.report_weight).toBeCloseTo(1 / 3, 4)
  })

  it('entende transcrição sem espaço "porcabeca"', () => {
    const text = 'Bar 84, porcabeca 21'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(84)
    expect(item.report_weight).toBe(0.25)
  })

  it('entende transcrição sem espaço "cadaum"', () => {
    const text = 'Lanche 60, cadaum pagou 20'
    const { intent } = assistantParserInternals.inferIntent(text)
    const slots = assistantParserInternals.buildSlots(text, intent)

    expect(intent).toBe('add_expense')
    const [item] = slots.items || []
    expect(item.amount).toBe(60)
    expect(item.report_weight).toBeCloseTo(1 / 3, 4)
  })
})
