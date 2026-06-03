export function isCalculatorElement(target: unknown): boolean {
  return (
    target instanceof Element &&
    !!(
      target.closest('.calculator-element') ||
      target.closest('.calculator-origin-button') ||
      target.closest('.calculator-icon-drag')
    )
  )
}
