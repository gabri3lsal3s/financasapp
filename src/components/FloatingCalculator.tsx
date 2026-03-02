import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calculator, ChevronDown, Delete, RotateCcw } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const CALCULATOR_STATE_KEY = 'floating-calculator-state'
const CALCULATOR_UI_KEY = 'floating-calculator-ui'
const CALCULATOR_TARGET_CLASS = 'calculator-target-input'
const PANEL_MARGIN = 8
const ICON_DRAG_LIMIT = 120
const ICON_HOLD_TO_PIN_MS = 900
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 620
const MIN_PANEL_HEIGHT = 430
const MAX_PANEL_HEIGHT = 640
const DEFAULT_PANEL_WIDTH = 352
const DEFAULT_PANEL_HEIGHT = 470

interface PersistedCalculatorState {
  expression: string
  lastResult: string
}

interface PanelRect {
  left: number
  top: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

type IconOrigin = 'bottom-right' | 'top-right'

const DEFAULT_STATE: PersistedCalculatorState = {
  expression: '0',
  lastResult: '',
}

function isNumericField(element: Element | null): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) {
    return false
  }

  if (element.disabled || element.readOnly) {
    return false
  }

  return element.type === 'number' || element.inputMode === 'decimal' || element.inputMode === 'numeric'
}

function normalizeInputValue(value: string): string {
  return value.trim().replace(',', '.')
}

function toCanonicalNumericString(value: string): string {
  const compact = value.trim().replace(/\s/g, '')
  if (!compact) return ''

  if (compact.includes(',')) {
    return compact.replace(/\./g, '').replace(',', '.')
  }

  return compact
}

function formatCanonicalNumberToPtBr(value: string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(parsed)
}

function formatExpressionForDisplay(expression: string): string {
  let formatted = ''
  let numericToken = ''

  const flushNumericToken = () => {
    if (!numericToken) {
      return
    }

    const hasTrailingDot = numericToken.endsWith('.')
    const [rawIntegerPart = '', rawDecimalPart = ''] = numericToken.split('.')
    const integerPart = rawIntegerPart.replace(/\D/g, '') || '0'
    const formattedIntegerPart = Number(integerPart).toLocaleString('pt-BR')

    if (hasTrailingDot) {
      formatted += `${formattedIntegerPart},`
      numericToken = ''
      return
    }

    if (numericToken.includes('.')) {
      formatted += `${formattedIntegerPart},${rawDecimalPart}`
      numericToken = ''
      return
    }

    formatted += formattedIntegerPart
    numericToken = ''
  }

  for (const char of expression) {
    if (/\d|\./.test(char)) {
      numericToken += char
      continue
    }

    flushNumericToken()
    formatted += char
  }

  flushNumericToken()

  return formatted
}

function evaluateExpression(expression: string): string | null {
  const normalizedExpression = normalizeInputValue(expression)

  if (!normalizedExpression) {
    return null
  }

  if (!/^[0-9+\-*/().\s%^]+$/.test(normalizedExpression)) {
    return null
  }

  const executableExpression = normalizedExpression.replace(/\^/g, '**')

  try {
    const rawValue = Function(`"use strict"; return (${executableExpression})`)()
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return null
    }

    const roundedValue = Number(rawValue.toFixed(8))
    return String(roundedValue)
  } catch {
    return null
  }
}

function isVisibleElement(element: HTMLElement): boolean {
  return element.getClientRects().length > 0
}

function getInputDisplayName(input: HTMLInputElement): string {
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

function getNumericInputs(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll('input')).filter((input) => isNumericField(input) && isVisibleElement(input))
}

function prefersValorField(input: HTMLInputElement): boolean {
  const label = getInputDisplayName(input).toLowerCase()
  const name = (input.getAttribute('name') || '').toLowerCase()
  const id = (input.getAttribute('id') || '').toLowerCase()
  const placeholder = (input.getAttribute('placeholder') || '').toLowerCase()
  const fullText = `${label} ${name} ${id} ${placeholder}`

  return fullText.includes('valor')
}

function getTopDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(isVisibleElement)
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getDefaultPanelRect(): PanelRect {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const width = clamp(DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, viewportWidth - PANEL_MARGIN * 2))
  const height = clamp(DEFAULT_PANEL_HEIGHT, MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, viewportHeight - PANEL_MARGIN * 2))

  const left = clamp(viewportWidth - width - 20, PANEL_MARGIN, viewportWidth - width - PANEL_MARGIN)
  const top = clamp(viewportHeight - height - 80, PANEL_MARGIN, viewportHeight - height - PANEL_MARGIN)

  return { left, top, width, height }
}

function clampOffsetToIconLimit(offset: Point): Point {
  const distance = Math.hypot(offset.x, offset.y)
  if (distance <= ICON_DRAG_LIMIT) {
    return offset
  }

  const ratio = ICON_DRAG_LIMIT / distance
  return {
    x: offset.x * ratio,
    y: offset.y * ratio,
  }
}

export default function FloatingCalculator() {
  const location = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [expression, setExpression] = useState(DEFAULT_STATE.expression)
  const [lastResult, setLastResult] = useState(DEFAULT_STATE.lastResult)
  const [hasError, setHasError] = useState(false)
  const [selectedFieldName, setSelectedFieldName] = useState('Nenhum')
  const activeNumericInputRef = useRef<HTMLInputElement | null>(null)
  const highlightedInputRef = useRef<HTMLInputElement | null>(null)
  const isExpandedRef = useRef(false)
  const [panelRect, setPanelRect] = useState<PanelRect>(() => getDefaultPanelRect())
  const panelRectRef = useRef<PanelRect>(panelRect)
  const [iconOffset, setIconOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDraggingIcon, setIsDraggingIcon] = useState(false)
  const [isIconReturning, setIsIconReturning] = useState(false)
  const [iconOrigin, setIconOrigin] = useState<IconOrigin>('bottom-right')
  const [isTopRightPinReady, setIsTopRightPinReady] = useState(false)
  const isTopRightPinReadyRef = useRef(false)
  const iconDragMovedRef = useRef(false)
  const iconReturnTimeoutRef = useRef<number | null>(null)
  const iconPinTimeoutRef = useRef<number | null>(null)
  const pendingIconOriginRef = useRef<IconOrigin | null>(null)

  useEffect(() => {
    isExpandedRef.current = isExpanded
  }, [isExpanded])

  useEffect(() => {
    panelRectRef.current = panelRect
  }, [panelRect])

  useEffect(() => {
    isTopRightPinReadyRef.current = isTopRightPinReady
  }, [isTopRightPinReady])

  useEffect(() => {
    return () => {
      if (iconReturnTimeoutRef.current) {
        window.clearTimeout(iconReturnTimeoutRef.current)
      }
      if (iconPinTimeoutRef.current) {
        window.clearTimeout(iconPinTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    try {
      const persistedUiRaw = window.localStorage.getItem(CALCULATOR_UI_KEY)
      if (!persistedUiRaw) return

      const persistedUi = JSON.parse(persistedUiRaw) as { iconOrigin?: IconOrigin }
      if (persistedUi.iconOrigin === 'top-right' || persistedUi.iconOrigin === 'bottom-right') {
        setIconOrigin(persistedUi.iconOrigin)
      }
    } catch {
      window.localStorage.removeItem(CALCULATOR_UI_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CALCULATOR_UI_KEY, JSON.stringify({ iconOrigin }))
  }, [iconOrigin])

  useEffect(() => {
    setIsExpanded(false)
    setPanelRect(getDefaultPanelRect())
  }, [location.pathname])

  useEffect(() => {
    const onResizeViewport = () => {
      setPanelRect((currentRect) => {
        const maxWidthByViewport = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2))
        const maxHeightByViewport = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, window.innerHeight - PANEL_MARGIN * 2))
        const width = clamp(currentRect.width, MIN_PANEL_WIDTH, maxWidthByViewport)
        const height = clamp(currentRect.height, MIN_PANEL_HEIGHT, maxHeightByViewport)
        const left = clamp(currentRect.left, PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)
        const top = clamp(currentRect.top, PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)

        return { left, top, width, height }
      })
    }

    window.addEventListener('resize', onResizeViewport)
    return () => {
      window.removeEventListener('resize', onResizeViewport)
    }
  }, [])

  useEffect(() => {
    try {
      const persistedStateRaw = window.localStorage.getItem(CALCULATOR_STATE_KEY)
      if (!persistedStateRaw) return

      const persistedState = JSON.parse(persistedStateRaw) as PersistedCalculatorState
      if (typeof persistedState.expression === 'string') {
        setExpression(persistedState.expression || DEFAULT_STATE.expression)
      }
      if (typeof persistedState.lastResult === 'string') {
        setLastResult(persistedState.lastResult)
      }
    } catch {
      window.localStorage.removeItem(CALCULATOR_STATE_KEY)
    }
  }, [])

  useEffect(() => {
    const persistableState: PersistedCalculatorState = {
      expression,
      lastResult,
    }

    window.localStorage.setItem(CALCULATOR_STATE_KEY, JSON.stringify(persistableState))
  }, [expression, lastResult])

  useEffect(() => {
    const updateActiveNumericInput = (event: FocusEvent) => {
      const target = event.target as Element | null
      if (!isNumericField(target)) {
        return
      }

      activeNumericInputRef.current = target
      setSelectedFieldName(getInputDisplayName(target))

      if (!isExpandedRef.current) {
        return
      }

      if (highlightedInputRef.current && highlightedInputRef.current !== target) {
        highlightedInputRef.current.classList.remove(CALCULATOR_TARGET_CLASS)
      }

      target.classList.add(CALCULATOR_TARGET_CLASS)
      highlightedInputRef.current = target
    }

    document.addEventListener('focusin', updateActiveNumericInput)

    return () => {
      document.removeEventListener('focusin', updateActiveNumericInput)
    }
  }, [])

  const clearHighlightedField = () => {
    if (!highlightedInputRef.current) {
      return
    }

    highlightedInputRef.current.classList.remove(CALCULATOR_TARGET_CLASS)
    highlightedInputRef.current = null
  }

  const setTargetInput = (input: HTMLInputElement | null) => {
    clearHighlightedField()

    activeNumericInputRef.current = input

    if (!input) {
      setSelectedFieldName('Nenhum')
      return
    }

    setSelectedFieldName(getInputDisplayName(input))

    if (isExpanded) {
      input.classList.add(CALCULATOR_TARGET_CLASS)
      highlightedInputRef.current = input
    }
  }

  const findDefaultNumericInput = (): HTMLInputElement | null => {
    const activeElement = document.activeElement as Element | null
    const activeForm = activeElement?.closest('form')
    const topDialog = getTopDialog()

    const searchRoots: ParentNode[] = []
    if (topDialog) {
      searchRoots.push(topDialog)
    }
    if (activeForm) {
      searchRoots.push(activeForm)
    }
    searchRoots.push(document)

    for (const root of searchRoots) {
      const numericInputs = getNumericInputs(root)
      if (numericInputs.length === 0) {
        continue
      }

      const preferredValorInput = numericInputs.find(prefersValorField)
      if (preferredValorInput) {
        return preferredValorInput
      }

      return numericInputs[0]
    }

    return null
  }

  const resolveTargetInput = (): HTMLInputElement | null => {
    const currentTarget = activeNumericInputRef.current
    if (currentTarget && isNumericField(currentTarget) && currentTarget.isConnected && isVisibleElement(currentTarget)) {
      return currentTarget
    }

    const fallbackTarget = findDefaultNumericInput()
    setTargetInput(fallbackTarget)

    return fallbackTarget
  }

  useEffect(() => {
    if (isExpanded) {
      const resolvedTarget = resolveTargetInput()
      if (resolvedTarget) {
        resolvedTarget.classList.add(CALCULATOR_TARGET_CLASS)
        highlightedInputRef.current = resolvedTarget
      }
      return
    }

    clearHighlightedField()
  }, [isExpanded])

  useEffect(() => {
    return () => {
      clearHighlightedField()
    }
  }, [])

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event

      const isNumericKey = /^[0-9]$/.test(key)
      const isOperatorKey = key === '+' || key === '-' || key === '*' || key === '/'
      const isParenthesisKey = key === '(' || key === ')'

      if (isNumericKey || isOperatorKey || isParenthesisKey) {
        event.preventDefault()
        event.stopPropagation()
        appendToExpression(key)
        return
      }

      if (key === '.' || key === ',') {
        event.preventDefault()
        event.stopPropagation()
        appendToExpression('.')
        return
      }

      if (key === 'Enter' || key === '=') {
        event.preventDefault()
        event.stopPropagation()
        applyEvaluation()
        return
      }

      if (key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        backspaceExpression()
        return
      }

      if (key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        clearExpression()
        return
      }

      if (key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setIsExpanded(false)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [isExpanded, expression])

  const keypadRows = useMemo(
    () => [
      ['7', '8', '9', '/'],
      ['4', '5', '6', '*'],
      ['1', '2', '3', '-'],
      ['0', '.', '(', ')'],
    ],
    []
  )

  const showScientificButtons = panelRect.width >= 430 || panelRect.height >= 540
  const showExtendedScientificButtons = panelRect.width >= 520 || panelRect.height >= 610

  const displayExpression = useMemo(() => formatExpressionForDisplay(expression), [expression])

  const displayLastResult = useMemo(() => {
    if (!lastResult) {
      return ''
    }

    return formatCanonicalNumberToPtBr(lastResult)
  }, [lastResult])

  const openCalculator = () => {
    const activeNumericInput = resolveTargetInput()

    if (activeNumericInput && isNumericField(activeNumericInput) && activeNumericInput.value.trim()) {
      setExpression(toCanonicalNumericString(activeNumericInput.value))
      setHasError(false)
    }

    setIsExpanded(true)
  }

  const appendToExpression = (value: string) => {
    setHasError(false)
    setExpression((previousValue) => (previousValue === '0' ? value : `${previousValue}${value}`))
  }

  const appendConstant = (constantValue: number) => {
    const constantAsString = String(Number(constantValue.toFixed(8)))

    setHasError(false)
    setExpression((previousValue) => {
      if (previousValue === '0') {
        return constantAsString
      }

      if (/[\d)]$/.test(previousValue)) {
        return `${previousValue}*${constantAsString}`
      }

      return `${previousValue}${constantAsString}`
    })
  }

  const clearExpression = () => {
    setHasError(false)
    setExpression('0')
    setLastResult('')
  }

  const backspaceExpression = () => {
    setHasError(false)
    setExpression((previousValue) => {
      if (previousValue.length <= 1) {
        return '0'
      }

      return previousValue.slice(0, -1)
    })
  }

  const applyEvaluation = () => {
    const result = evaluateExpression(expression)
    if (!result) {
      setHasError(true)
      return null
    }

    setHasError(false)
    setLastResult(result)
    setExpression(result)

    return result
  }

  const applyUnaryOperation = (operation: (value: number) => number | null) => {
    const result = evaluateExpression(expression)
    if (!result) {
      setHasError(true)
      return
    }

    const numericValue = Number(result)
    if (!Number.isFinite(numericValue)) {
      setHasError(true)
      return
    }

    const transformedValue = operation(numericValue)
    if (transformedValue === null || !Number.isFinite(transformedValue)) {
      setHasError(true)
      return
    }

    const roundedValue = String(Number(transformedValue.toFixed(8)))
    setHasError(false)
    setExpression(roundedValue)
    setLastResult(roundedValue)
  }

  const sendResultToActiveInput = () => {
    const result = applyEvaluation()
    if (!result) return

    const activeNumericInput = resolveTargetInput()

    if (!activeNumericInput || !isNumericField(activeNumericInput) || !activeNumericInput.isConnected) {
      return
    }

    activeNumericInput.value = result

    if (activeNumericInput.type !== 'number') {
      activeNumericInput.value = formatCanonicalNumberToPtBr(result)
    }

    activeNumericInput.dispatchEvent(new Event('input', { bubbles: true }))
    activeNumericInput.dispatchEvent(new Event('change', { bubbles: true }))
    activeNumericInput.focus()
    setHasError(false)
    setExpression('0')
    setLastResult('')
    setIsExpanded(false)
  }

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button')) {
      return
    }

    event.preventDefault()

    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRectRef.current

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      const nextLeft = clamp(startRect.left + deltaX, PANEL_MARGIN, window.innerWidth - startRect.width - PANEL_MARGIN)
      const nextTop = clamp(startRect.top + deltaY, PANEL_MARGIN, window.innerHeight - startRect.height - PANEL_MARGIN)

      setPanelRect((currentRect) => ({
        ...currentRect,
        left: nextLeft,
        top: nextTop,
      }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const startResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRectRef.current

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      const maxWidthByViewport = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - startRect.left - PANEL_MARGIN))
      const maxHeightByViewport = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, window.innerHeight - startRect.top - PANEL_MARGIN))
      const nextWidth = clamp(startRect.width + deltaX, MIN_PANEL_WIDTH, maxWidthByViewport)
      const nextHeight = clamp(startRect.height + deltaY, MIN_PANEL_HEIGHT, maxHeightByViewport)

      setPanelRect((currentRect) => ({
        ...currentRect,
        width: nextWidth,
        height: nextHeight,
      }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const resetPanelRect = () => {
    const defaultRect = getDefaultPanelRect()
    setPanelRect({
      left: defaultRect.left,
      top: defaultRect.top,
      width: defaultRect.width,
      height: defaultRect.height,
    })
  }

  const startIconDrag = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    if (iconReturnTimeoutRef.current) {
      window.clearTimeout(iconReturnTimeoutRef.current)
    }
    if (iconPinTimeoutRef.current) {
      window.clearTimeout(iconPinTimeoutRef.current)
      iconPinTimeoutRef.current = null
    }

    setIsIconReturning(false)
    setIsDraggingIcon(true)
    setIsTopRightPinReady(false)
    iconDragMovedRef.current = false
    pendingIconOriginRef.current = null

    const startX = event.clientX
    const startY = event.clientY

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rawOffset = {
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      }

      const boundedOffset = clampOffsetToIconLimit(rawOffset)
      if (!iconDragMovedRef.current && Math.hypot(rawOffset.x, rawOffset.y) > 4) {
        iconDragMovedRef.current = true
      }

      const distance = Math.hypot(boundedOffset.x, boundedOffset.y)
      const isNearVerticalAxis = Math.abs(boundedOffset.x) <= ICON_DRAG_LIMIT * 0.45
      const isAtTopZone = distance >= ICON_DRAG_LIMIT - 6
        && boundedOffset.y <= -ICON_DRAG_LIMIT * 0.75
        && isNearVerticalAxis
      const isAtBottomZone = distance >= ICON_DRAG_LIMIT - 6
        && boundedOffset.y >= ICON_DRAG_LIMIT * 0.75
        && isNearVerticalAxis

      const shouldTriggerOriginSwap =
        (iconOrigin === 'bottom-right' && isAtTopZone) ||
        (iconOrigin === 'top-right' && isAtBottomZone)

      if (shouldTriggerOriginSwap) {
        if (!iconPinTimeoutRef.current && !isTopRightPinReadyRef.current) {
          iconPinTimeoutRef.current = window.setTimeout(() => {
            pendingIconOriginRef.current = iconOrigin === 'bottom-right' ? 'top-right' : 'bottom-right'
            setIsTopRightPinReady(true)
            iconPinTimeoutRef.current = null
          }, ICON_HOLD_TO_PIN_MS)
        }
      } else {
        if (iconPinTimeoutRef.current) {
          window.clearTimeout(iconPinTimeoutRef.current)
          iconPinTimeoutRef.current = null
        }
        if (pendingIconOriginRef.current) {
          pendingIconOriginRef.current = null
          setIsTopRightPinReady(false)
        }
      }

      setIconOffset(boundedOffset)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      if (iconPinTimeoutRef.current) {
        window.clearTimeout(iconPinTimeoutRef.current)
        iconPinTimeoutRef.current = null
      }

      if (pendingIconOriginRef.current) {
        setIconOrigin(pendingIconOriginRef.current)
        pendingIconOriginRef.current = null
      }

      setIsDraggingIcon(false)
      setIsTopRightPinReady(false)
      setIsIconReturning(true)
      setIconOffset({ x: 0, y: 0 })

      iconReturnTimeoutRef.current = window.setTimeout(() => {
        setIsIconReturning(false)
      }, 280)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleIconClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (iconDragMovedRef.current) {
      event.preventDefault()
      iconDragMovedRef.current = false
      return
    }

    openCalculator()
  }

  return (
    <>
      {isExpanded && (
        <div
          className="fixed z-[1001] rounded-2xl border border-primary bg-primary shadow-lg p-3 animate-surface-enter motion-emphasis overflow-hidden"
          onMouseDown={startDrag}
          style={{
            left: panelRect.left,
            top: panelRect.top,
            width: panelRect.width,
            height: panelRect.height,
          }}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 select-none">
            <div>
              <h3 className="text-sm font-semibold text-primary">Calculadora</h3>
              <p className="text-[11px] text-secondary mt-0.5">Campo: {selectedFieldName}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Minimizar calculadora"
              onMouseDown={(event) => event.stopPropagation()}
              className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            >
              <ChevronDown size={18} />
            </button>
            </div>

            <div className={`w-full rounded-lg border px-3 py-2 text-right text-lg font-semibold ${
            hasError ? 'border-[var(--color-danger)] text-[var(--color-danger)]' : 'border-primary text-primary'
          }`}>
              {displayExpression}
            </div>

            {displayLastResult && !hasError && (
              <p className="mt-1 text-xs text-secondary text-right">Resultado: {displayLastResult}</p>
            )}

            <div className="mt-3 flex-1 min-h-0 flex flex-col gap-2">
              {keypadRows.map((row, rowIndex) => (
                <div key={`base-row-${rowIndex}`} className="grid grid-cols-4 gap-2 flex-1 min-h-0">
                  {row.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => appendToExpression(value)}
                      className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ))}

              <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
                <button
                  type="button"
                  onClick={clearExpression}
                  className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={backspaceExpression}
                  aria-label="Apagar último caractere"
                  className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  <Delete size={16} className="mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => appendToExpression('+')}
                  className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={applyEvaluation}
                  className="h-full min-h-10 rounded-lg bg-[var(--color-primary)] text-[var(--color-button-text)] font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  =
                </button>
              </div>

              {showScientificButtons && (
                <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
                  <button
                    type="button"
                    onClick={() => applyUnaryOperation((value) => value / 100)}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => appendToExpression('^')}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    xʸ
                  </button>
                  <button
                    type="button"
                    onClick={() => appendConstant(Math.PI)}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    π
                  </button>
                  <button
                    type="button"
                    onClick={() => appendConstant(Math.E)}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    e
                  </button>
                </div>
              )}

              {showExtendedScientificButtons && (
                <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
                  <button
                    type="button"
                    onClick={() => applyUnaryOperation((value) => -value)}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    +/−
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUnaryOperation((value) => (value === 0 ? null : 1 / value))}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    1/x
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUnaryOperation((value) => value * value)}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUnaryOperation((value) => (value < 0 ? null : Math.sqrt(value)))}
                    className="h-full min-h-10 rounded-lg bg-tertiary text-primary font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                  >
                    √x
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 flex-1 min-h-0">
                <button
                  type="button"
                  onClick={sendResultToActiveInput}
                  aria-label="Enviar resultado para o campo selecionado"
                  className="h-full min-h-10 rounded-lg bg-[var(--color-primary)] text-[var(--color-button-text)] font-medium hover:shadow-md motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  <ArrowRight size={16} className="mx-auto" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  aria-label="Resetar posição e tamanho da calculadora"
                  onClick={(event) => {
                    resetPanelRect()
                    event.currentTarget.blur()
                  }}
                  onMouseUp={(event) => event.currentTarget.blur()}
                  className="h-6 w-6 rounded-md text-secondary hover:text-primary hover:bg-tertiary/70 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  <RotateCcw size={12} className="mx-auto" />
                </button>

                <button
                  type="button"
                  aria-label="Redimensionar calculadora"
                  onMouseDown={startResize}
                  className="h-6 w-6 rounded-md text-secondary hover:text-primary hover:bg-tertiary/70 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] cursor-nwse-resize"
                >
                  <span className="block text-xs leading-none">◢</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isExpanded && (
        <div className={`fixed right-4 z-[1001] h-10 w-10 safe-area-right ${iconOrigin === 'top-right' ? 'top-4 safe-area-top' : 'bottom-4 safe-area-bottom'}`}>
          {(isDraggingIcon || isIconReturning) && (
            <div
              className={`pointer-events-none absolute rounded-full border ${isTopRightPinReady ? 'border-[var(--color-success)]' : 'border-primary'} ${isDraggingIcon ? 'opacity-80' : 'opacity-0'} motion-emphasis`}
              style={{
                width: `${ICON_DRAG_LIMIT * 2 + 40}px`,
                height: `${ICON_DRAG_LIMIT * 2 + 40}px`,
                left: `${-(ICON_DRAG_LIMIT + 15)}px`,
                top: `${-(ICON_DRAG_LIMIT + 15)}px`,
              }}
            />
          )}

          <button
            type="button"
            onMouseDown={startIconDrag}
            onClick={handleIconClick}
            aria-label="Abrir calculadora flutuante"
            style={{ transform: `translate(${iconOffset.x}px, ${iconOffset.y}px)` }}
            className={`h-10 w-10 rounded-full border border-primary bg-primary text-secondary shadow-md hover:text-primary hover:bg-tertiary press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${isDraggingIcon ? 'cursor-grabbing' : 'cursor-grab'} ${isIconReturning ? 'transition-transform duration-300 ease-out' : 'motion-standard hover-lift-subtle'}`}
          >
            <Calculator size={17} className="mx-auto" />
          </button>
        </div>
      )}
    </>
  )
}
