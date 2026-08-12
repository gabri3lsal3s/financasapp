/**
 * detectSuggestionRuleFromName — infere a regra de sugestão de orçamento
 * (moradia, alimentacao, transporte, etc.) a partir do nome da categoria.
 * Extraída da página Categorias.
 */
export function detectSuggestionRuleFromName(name: string): string {
  const normalized = name.toLowerCase().trim()

  if (
    normalized.includes('morad') ||
    normalized.includes('casa') ||
    normalized.includes('aluguel') ||
    normalized.includes('condominio')
  ) {
    return 'moradia'
  }

  if (
    normalized.includes('aliment') ||
    normalized.includes('comer') ||
    normalized.includes('restaurante') ||
    normalized.includes('supermercado') ||
    normalized.includes('mercado')
  ) {
    return 'alimentacao'
  }

  if (
    normalized.includes('transp') ||
    normalized.includes('carro') ||
    normalized.includes('combustivel') ||
    normalized.includes('gasolina') ||
    normalized.includes('uber')
  ) {
    return 'transporte'
  }

  if (
    normalized.includes('saude') ||
    normalized.includes('medico') ||
    normalized.includes('remedio') ||
    normalized.includes('farmacia') ||
    normalized.includes('hospital')
  ) {
    return 'saude'
  }

  if (
    normalized.includes('educa') ||
    normalized.includes('escola') ||
    normalized.includes('faculdade') ||
    normalized.includes('curso')
  ) {
    return 'educacao'
  }

  if (
    normalized.includes('lazer') ||
    normalized.includes('cinema') ||
    normalized.includes('show') ||
    normalized.includes('festa') ||
    normalized.includes('bar') ||
    normalized.includes('netflix') ||
    normalized.includes('spotify') ||
    normalized.includes('academia')
  ) {
    return 'lazer'
  }

  if (
    normalized.includes('compra') ||
    normalized.includes('vestuario') ||
    normalized.includes('roupa') ||
    normalized.includes('shopping')
  ) {
    return 'compras'
  }

  return 'outros'
}
