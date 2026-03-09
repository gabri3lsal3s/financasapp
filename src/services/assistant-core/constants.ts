export const EXPENSE_CONTEXT_HINTS = [
  'almoco', 'almoçar', 'jantar', 'lanche', 'restaurante', 'mercado', 'compra', 'compras', 'ifood',
  'padaria', 'uber', 'taxi', 'onibus', 'ônibus', 'gasolina', 'combustivel', 'combustível', 'farmacia',
  'farmácia', 'medico', 'médico', 'exame', 'conta', 'despesa', 'gasto',
]

export const EXPENSE_ACTION_HINTS = ['gastei', 'paguei', 'comprei', 'deu', 'custou', 'fui', 'pagar', 'gastou']

export const INCOME_CONTEXT_HINTS = [
  'recebi', 'recebemos', 'recebimento', 'ganhei', 'caiu', 'entrou', 'salario', 'salário', 'renda', 'receita',
  'freela', 'dividendo', 'provento', 'comissao', 'comissão',
]

export const INVESTMENT_CONTEXT_HINTS = ['investi', 'investimento', 'aporte', 'apliquei', 'aplicacao', 'aplicação', 'corretora']

export const EXPENSE_KEYWORDS: Record<string, string[]> = {
  Alimentação: ['almoço', 'jantar', 'lanche', 'restaurante', 'mercado', 'ifood', 'padaria'],
  Transporte: ['uber', '99', 'taxi', 'ônibus', 'onibus', 'combustível', 'combustivel', 'gasolina'],
  Moradia: ['aluguel', 'energia', 'água', 'agua', 'internet', 'condomínio', 'condominio'],
  Saúde: ['saúde', 'saude', 'farmácia', 'farmacia', 'médico', 'medico', 'exame'],
}

export const INCOME_KEYWORDS: Record<string, string[]> = {
  Salário: ['salário', 'salario', 'folha', 'pagamento'],
  Freelancer: ['freela', 'freelancer', 'projeto', 'job'],
  Dividendos: ['dividendos', 'dividendo', 'proventos', 'juros'],
  Aluguel: ['aluguel recebido', 'locação', 'locacao'],
}

export const CATEGORY_CONFIDENCE_AUTO_ASSIGN = 0.8
export const CATEGORY_CONFIDENCE_DISAMBIGUATION = 0.5
export const CONFIRMATION_WINDOW_MS = 2 * 60 * 1000
