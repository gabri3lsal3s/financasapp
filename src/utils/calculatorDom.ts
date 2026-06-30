/**
 * Utilitários DOM para a calculadora flutuante.
 * Funções auxiliares para interagir com inputs numéricos e dialogs.
 */

export const CALCULATOR_TARGET_CLASS = 'calculator-target-input'

/**
 * Verifica se um elemento é um input numérico válido (não desabilitado, não readonly).
 */
export function isNumericField(element: Element | null): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false
  if (element.disabled || element.readOnly) return false
  return element.type === 'number' || element.inputMode === 'decimal' || element.inputMode === 'numeric'
}

/**
 * Verifica se um elemento está visível (tem rects no layout).
 */
export function isVisibleElement(element: HTMLElement): boolean {
  return element.getClientRects().length > 0
}

/**
 * Obtém um nome legível para um input, tentando aria-label, name, id, label associado, placeholder.
 */
export function getInputDisplayName(input: HTMLInputElement): string {
  const ariaLabel = input.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const inputName = input.getAttribute('name')?.trim()
  if (inputName) return inputName

  const inputId = input.getAttribute('id')?.trim()
  if (inputId) {
    const explicitLabel = document.querySelector(`label[for="${CSS.escape(inputId)}"]`)?.textContent?.trim()
    if (explicitLabel) return explicitLabel
  }

  const wrapperLabel = input.closest('div')?.querySelector('label')?.textContent?.trim()
  if (wrapperLabel) return wrapperLabel

  const placeholder = input.getAttribute('placeholder')?.trim()
  if (placeholder) return placeholder

  return 'Campo numérico'
}

/**
 * Retorna todos os inputs numéricos visíveis dentro de um root.
 */
export function getNumericInputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll('input')).filter(
    (input) => isNumericField(input) && isVisibleElement(input),
  )
}

/**
 * Verifica se um input é candidato preferencial (contém "valor" no nome/label/placeholder).
 */
export function prefersValorField(input: HTMLInputElement): boolean {
  const label = getInputDisplayName(input).toLowerCase()
  const name = (input.getAttribute('name') || '').toLowerCase()
  const id = (input.getAttribute('id') || '').toLowerCase()
  const placeholder = (input.getAttribute('placeholder') || '').toLowerCase()
  const fullText = `${label} ${name} ${id} ${placeholder}`

  return fullText.includes('valor')
}

/**
 * Retorna o último dialog visível na página (o mais alto na pilha de z-index).
 */
export function getTopDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(isVisibleElement)
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null
}
