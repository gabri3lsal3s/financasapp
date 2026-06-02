import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calculator, ChevronDown, Delete } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { formatNumberBR, roundToDecimals } from '@/utils/format'
import IconButton from '@/components/IconButton'


const CALCULATOR_STATE_KEY = 'floating-calculator-state'
const CALCULATOR_UI_KEY = 'floating-calculator-ui'
const CALCULATOR_TARGET_CLASS = 'calculator-target-input'
const PANEL_MARGIN = 8
const ICON_DRAG_LIMIT = 120
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 620
const MIN_PANEL_HEIGHT = 430
const MOBILE_MIN_PANEL_HEIGHT = 120
const MOBILE_MIN_PANEL_WIDTH = 200
const MAX_PANEL_HEIGHT = 640
const DEFAULT_PANEL_WIDTH = 352
const DEFAULT_PANEL_HEIGHT = 470
const MOBILE_BREAKPOINT = 768
const MOBILE_MAX_HEIGHT_RATIO = 0.5
const MOBILE_RESIZE_MIN_HEIGHT_RATIO = 0.45
const RESIZE_MAX_VIEWPORT_HEIGHT_RATIO = 1
const PANEL_ASPECT_RATIO = DEFAULT_PANEL_WIDTH / DEFAULT_PANEL_HEIGHT
const RESIZE_TAP_MAX_MS = 220
const RESIZE_DRAG_START_DISTANCE = 6

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
  return value.trim().replace(/,/g, '.')
}

function toCanonicalNumericString(value: string): string {
  const compact = value.trim().replace(/\s/g, '')
  if (!compact) return ''

  // Replace all commas with dots for canonical representation
  return compact.replace(/,/g, '.')
}

function formatCanonicalNumberToPtBr(value: string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return formatNumberBR(parsed, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  })
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
    const formattedIntegerPart = formatNumberBR(Number(integerPart), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })

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

    // Use standard JS rounding instead of localized formatNumberBR to avoid commas in intermediate result
    const roundedValue = Math.round(rawValue * 100000000) / 100000000
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

function isMobileViewport(viewportWidth: number): boolean {
  return viewportWidth <= MOBILE_BREAKPOINT
}

function getPanelMinWidth(viewportWidth: number): number {
  return isMobileViewport(viewportWidth) ? MOBILE_MIN_PANEL_WIDTH : MIN_PANEL_WIDTH
}

function getPanelMinHeight(viewportWidth: number, viewportHeight: number): number {
  if (!isMobileViewport(viewportWidth)) {
    return MIN_PANEL_HEIGHT
  }

  const mobileRatioMinHeight = Math.floor(viewportHeight * MOBILE_RESIZE_MIN_HEIGHT_RATIO)
  return Math.max(MOBILE_MIN_PANEL_HEIGHT, mobileRatioMinHeight)
}

function getPanelResizeMaxHeight(viewportWidth: number, viewportHeight: number): number {
  const minHeight = getPanelMinHeight(viewportWidth, viewportHeight)
  const viewportBoundMaxHeight = Math.min(
    MAX_PANEL_HEIGHT,
    Math.floor((viewportHeight - PANEL_MARGIN * 2) * RESIZE_MAX_VIEWPORT_HEIGHT_RATIO),
  )

  return Math.max(minHeight, viewportBoundMaxHeight)
}

function getPanelInitialMaxHeight(viewportWidth: number, viewportHeight: number): number {
  const minHeight = getPanelMinHeight(viewportWidth, viewportHeight)
  const resizeMaxHeight = getPanelResizeMaxHeight(viewportWidth, viewportHeight)

  if (!isMobileViewport(viewportWidth)) {
    return resizeMaxHeight
  }

  const mobileMaxHeight = Math.floor(viewportHeight * MOBILE_MAX_HEIGHT_RATIO)
  return Math.max(minHeight, Math.min(resizeMaxHeight, mobileMaxHeight))
}

function getUniformPanelSize(
  requestedHeight: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): Pick<PanelRect, 'width' | 'height'> {
  const minHeightByRatio = minWidth / PANEL_ASPECT_RATIO
  const maxHeightByRatio = maxWidth / PANEL_ASPECT_RATIO
  const effectiveMinHeight = Math.max(minHeight, minHeightByRatio)
  const effectiveMaxHeight = Math.max(effectiveMinHeight, Math.min(maxHeight, maxHeightByRatio))
  const height = clamp(requestedHeight, effectiveMinHeight, effectiveMaxHeight)
  const width = clamp(Math.round(height * PANEL_ASPECT_RATIO), minWidth, maxWidth)

  return { width, height }
}

function getDefaultPanelRect(): PanelRect {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const minWidth = getPanelMinWidth(viewportWidth)
  const minHeight = getPanelMinHeight(viewportWidth, viewportHeight)

  const maxWidth = Math.max(minWidth, Math.min(MAX_PANEL_WIDTH, viewportWidth - PANEL_MARGIN * 2))
  const maxHeight = getPanelInitialMaxHeight(viewportWidth, viewportHeight)
  const { width, height } = getUniformPanelSize(DEFAULT_PANEL_HEIGHT, minWidth, minHeight, maxWidth, maxHeight)

  const left = clamp(viewportWidth - width - 20, PANEL_MARGIN, viewportWidth - width - PANEL_MARGIN)
  const bottomOffset = viewportWidth < 1024 ? (64 + 16) : PANEL_MARGIN
  const top = clamp(viewportHeight - height - bottomOffset, PANEL_MARGIN, viewportHeight - height - PANEL_MARGIN)

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

interface FloatingCalculatorProps {
  isHidden?: boolean
}

export default function FloatingCalculator({ isHidden = false }: FloatingCalculatorProps) {
  const [isMobile, setIsMobile] = useState(() => isMobileViewport(window.innerWidth))
  const [customTopY, setCustomTopY] = useState(() => Number(window.localStorage.getItem('floating-calculator-custom-top') || '160'))
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
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const [resizePreviewRect, setResizePreviewRect] = useState<PanelRect | null>(null)
  const [iconOffset, setIconOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDraggingIcon, setIsDraggingIcon] = useState(false)
  const [isIconReturning, setIsIconReturning] = useState(false)
  const [iconOrigin, setIconOrigin] = useState<IconOrigin>('bottom-right')
  const iconDragMovedRef = useRef(false)
  const iconReturnTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    window.localStorage.setItem('floating-calculator-custom-top', String(customTopY))
  }, [customTopY])


  useEffect(() => {
    isExpandedRef.current = isExpanded
  }, [isExpanded])

  useEffect(() => {
    panelRectRef.current = panelRect
  }, [panelRect])

  useEffect(() => {
    return () => {
      if (iconReturnTimeoutRef.current) {
        window.clearTimeout(iconReturnTimeoutRef.current)
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
    setIsResizingPanel(false)
    setResizePreviewRect(null)
    setPanelRect(getDefaultPanelRect())
  }, [location.pathname])

  useEffect(() => {
    const onResizeViewport = () => {
      setIsMobile(isMobileViewport(window.innerWidth))
      setPanelRect((currentRect) => {
        const minWidth = getPanelMinWidth(window.innerWidth)
        const minHeight = getPanelMinHeight(window.innerWidth, window.innerHeight)
        const maxWidthByViewport = Math.max(minWidth, Math.min(MAX_PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2))
        const maxHeightByViewport = getPanelResizeMaxHeight(window.innerWidth, window.innerHeight)
        const { width, height } = getUniformPanelSize(
          currentRect.height,
          minWidth,
          minHeight,
          maxWidthByViewport,
          maxHeightByViewport,
        )
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

  const setTargetInput = useCallback((input: HTMLInputElement | null) => {
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
  }, [isExpanded])

  const findDefaultNumericInput = useCallback((): HTMLInputElement | null => {
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
  }, [])

  const resolveTargetInput = useCallback((): HTMLInputElement | null => {
    const currentTarget = activeNumericInputRef.current
    if (currentTarget && isNumericField(currentTarget) && currentTarget.isConnected && isVisibleElement(currentTarget)) {
      return currentTarget
    }

    const fallbackTarget = findDefaultNumericInput()
    setTargetInput(fallbackTarget)

    return fallbackTarget
  }, [findDefaultNumericInput, setTargetInput])

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
  }, [isExpanded, resolveTargetInput])

  useEffect(() => {
    return () => {
      clearHighlightedField()
    }
  }, [])

  const applyEvaluation = useCallback(() => {
    const result = evaluateExpression(expression)
    if (!result) {
      setHasError(true)
      return null
    }

    setHasError(false)
    setLastResult(result)
    setExpression(result)

    return result
  }, [expression])

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
  }, [isExpanded, expression, applyEvaluation])

  const keypadRows = useMemo(
    () => [
      ['7', '8', '9', '/'],
      ['4', '5', '6', '*'],
      ['1', '2', '3', '-'],
      ['0', '(', ')', '+'],
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

  const isCompactPanel = panelRect.height < 520 || panelRect.width < 360
  const keypadGridGapClass = isCompactPanel ? 'gap-1' : 'gap-2'
  const keypadGroupGapClass = isCompactPanel ? 'gap-1' : 'gap-1.5 sm:gap-2'
  const resultMinHeightClass = isCompactPanel ? 'min-h-[10px]' : 'min-h-[12px]'
  const resultTextClass = isCompactPanel ? 'text-[10px]' : 'text-[11px]'
  const keypadButtonTextClass = isCompactPanel ? 'text-sm' : 'text-base'

  const keypadRowClass = `grid grid-cols-4 ${keypadGridGapClass} flex-1 min-h-0`
  const keypadSingleRowClass = `grid grid-cols-1 ${keypadGridGapClass} flex-1 min-h-0`
  const keypadButtonClass = `h-full min-h-0 rounded-xl flex items-center justify-center bg-secondary text-primary ${keypadButtonTextClass} leading-none font-medium hover:shadow-lg motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] border border-primary/20`
  const keypadPrimaryButtonClass = `h-full min-h-0 rounded-xl flex items-center justify-center bg-[var(--color-primary)] text-[var(--color-button-text)] ${keypadButtonTextClass} leading-none font-medium hover:shadow-lg motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]`

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
    const constantAsString = String(roundToDecimals(constantValue, 8))

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

    const roundedValue = String(roundToDecimals(transformedValue, 8))
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

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('button')) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRectRef.current
    const pointerId = event.pointerId

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return
      }

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

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return
      }

      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRectRef.current
    const pointerId = event.pointerId
    const startTimestamp = performance.now()
    let hasStartedDragResize = false
    let latestPreviewRect: PanelRect | null = null

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return
      }

      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      if (!hasStartedDragResize && Math.hypot(deltaX, deltaY) < RESIZE_DRAG_START_DISTANCE) {
        return
      }

      if (!hasStartedDragResize) {
        setIsResizingPanel(true)
        setResizePreviewRect(startRect)
        latestPreviewRect = startRect
      }

      hasStartedDragResize = true

      const minWidth = getPanelMinWidth(window.innerWidth)
      const minHeight = getPanelMinHeight(window.innerWidth, window.innerHeight)
      const maxWidthByViewport = Math.max(minWidth, Math.min(MAX_PANEL_WIDTH, window.innerWidth - startRect.left - PANEL_MARGIN))
      const absoluteMaxHeight = getPanelResizeMaxHeight(window.innerWidth, window.innerHeight)
      const maxHeightByViewport = Math.max(minHeight, Math.min(absoluteMaxHeight, window.innerHeight - startRect.top - PANEL_MARGIN))

      const projectedHeightDeltaFromX = deltaX / PANEL_ASPECT_RATIO
      const projectedHeightDeltaFromY = deltaY
      const dominantHeightDelta = Math.abs(projectedHeightDeltaFromY) >= Math.abs(projectedHeightDeltaFromX)
        ? projectedHeightDeltaFromY
        : projectedHeightDeltaFromX

      const uniformSize = getUniformPanelSize(
        startRect.height + dominantHeightDelta,
        minWidth,
        minHeight,
        maxWidthByViewport,
        maxHeightByViewport,
      )

      const reachedMaxMobileWidth = isMobileViewport(window.innerWidth)
        && (startRect.width >= maxWidthByViewport - 1 || uniformSize.width >= maxWidthByViewport - 1)

      const nextWidth = reachedMaxMobileWidth
        ? maxWidthByViewport
        : uniformSize.width

      const nextHeight = reachedMaxMobileWidth
        ? clamp(startRect.height + deltaY, minHeight, maxHeightByViewport)
        : uniformSize.height

      const nextPreviewRect: PanelRect = {
        left: startRect.left,
        top: startRect.top,
        width: nextWidth,
        height: nextHeight,
      }

      latestPreviewRect = nextPreviewRect
      setResizePreviewRect(nextPreviewRect)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return
      }

      const elapsedMs = performance.now() - startTimestamp

      if (!hasStartedDragResize && elapsedMs <= RESIZE_TAP_MAX_MS) {
        resetPanelRect()
      } else if (hasStartedDragResize && latestPreviewRect) {
        setPanelRect({
          left: latestPreviewRect.left,
          top: latestPreviewRect.top,
          width: latestPreviewRect.width,
          height: latestPreviewRect.height,
        })
      }

      setIsResizingPanel(false)
      setResizePreviewRect(null)

      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
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

  const startIconDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    if (iconReturnTimeoutRef.current) {
      window.clearTimeout(iconReturnTimeoutRef.current)
    }

    setIsIconReturning(false)
    setIsDraggingIcon(true)
    iconDragMovedRef.current = false

    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId

    let currentOrigin = iconOrigin
    let activeStartY = startY
    let activeStartTopY = customTopY

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return
      }

      const deltaX = moveEvent.clientX - startX
      const rawDeltaY = moveEvent.clientY - startY

      if (!iconDragMovedRef.current && Math.hypot(deltaX, rawDeltaY) > 4) {
        iconDragMovedRef.current = true
      }

      // 1. If currently at bottom-right (on top of bottom nav bar / bottom corner)
      if (currentOrigin === 'bottom-right') {
        const snapThreshold = isMobile ? window.innerHeight - 150 : window.innerHeight - 120
        if (moveEvent.clientY < snapThreshold) {
          // Snap/switch to top-right origin (vertical dragging along side)
          currentOrigin = 'top-right'
          setIconOrigin('top-right')
          
          const initialTop = clamp(moveEvent.clientY - 20, 16, window.innerHeight - (isMobile ? 150 : 80))
          setCustomTopY(initialTop)
          activeStartY = moveEvent.clientY
          activeStartTopY = initialTop
          
          // Clear standard offset on switch to keep motion smooth
          setIconOffset({ x: 0, y: 0 })
        } else {
          // Standard relative offset dragging inside bottom area
          const boundedOffset = clampOffsetToIconLimit({ x: deltaX, y: rawDeltaY })
          setIconOffset(boundedOffset)
        }
      } 
      // 2. If currently at top-right (vertical sliding tab mode)
      else if (currentOrigin === 'top-right') {
        const currentDeltaY = moveEvent.clientY - activeStartY
        const newTopY = activeStartTopY + currentDeltaY
        const minTop = 16
        const maxTop = window.innerHeight - (isMobile ? 150 : 80)
        const clampedTopY = clamp(newTopY, minTop, maxTop)
        
        setCustomTopY(clampedTopY)

        // If dragged all the way down near the bottom nav bar, snap back to bottom-right
        const snapBottomThreshold = window.innerHeight - (isMobile ? 120 : 80)
        if (moveEvent.clientY > snapBottomThreshold) {
          currentOrigin = 'bottom-right'
          setIconOrigin('bottom-right')
          // Reset starting drag positions to make bottom relative dragging smooth
          activeStartY = moveEvent.clientY
          setIconOffset({ x: deltaX, y: 0 })
        } else {
          // Allow minor horizontal drag offset for physical spring effect
          const boundedOffset = clampOffsetToIconLimit({ x: deltaX, y: 0 })
          setIconOffset({ x: boundedOffset.x, y: 0 })
        }
      }
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return
      }

      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)

      setIsDraggingIcon(false)
      setIsIconReturning(true)
      setIconOffset({ x: 0, y: 0 })

      iconReturnTimeoutRef.current = window.setTimeout(() => {
        setIsIconReturning(false)
      }, 280)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
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
      {isExpanded && isResizingPanel && resizePreviewRect && (
        <div
          className="fixed z-[1000] pointer-events-none rounded-2xl border border-[var(--ds-color-accent-primary)]/60 bg-transparent calculator-resize-ghost"
          style={{
            left: resizePreviewRect.left,
            top: resizePreviewRect.top,
            width: resizePreviewRect.width,
            height: resizePreviewRect.height,
          }}
        />
      )}

      {isExpanded && !isHidden && (
        <div
          className="fixed z-[1001] rounded-2xl border border-primary bg-primary/95 backdrop-blur-xl p-3 shadow-2xl animate-page-enter motion-emphasis overflow-hidden"
          onPointerDown={startDrag}
          style={{
            left: panelRect.left,
            top: panelRect.top,
            width: panelRect.width,
            height: panelRect.height,
            touchAction: 'none',
          }}
        >
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 select-none">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <Calculator size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary">Calculadora</h3>
                  <p className="text-[10px] text-secondary">Campo: {selectedFieldName}</p>
                </div>
              </div>
              <IconButton
                type="button"
                size="sm"
                icon={<ChevronDown size={20} />}
                onClick={() => setIsExpanded(false)}
                label="Minimizar calculadora"
                onPointerDown={(event) => event.stopPropagation()}
                title="Minimizar"
              />
            </div>

            <div className={`w-full rounded-lg border px-3 py-2 text-right ${isCompactPanel ? 'text-base' : 'text-lg'} font-semibold animate-calculator-display ${hasError ? 'border-[var(--ds-color-intent-danger)] text-[var(--ds-color-intent-danger)]' : 'border-primary text-primary'
              }`}>
              {displayExpression}
            </div>

            <div className={`mt-0.5 ${resultMinHeightClass} flex items-center justify-end`}>
              <p className={`${resultTextClass} text-secondary text-right transition-opacity duration-150 ${displayLastResult && !hasError ? 'opacity-100' : 'opacity-0'}`}>
                Resultado: {displayLastResult || '0'}
              </p>
            </div>

            <div className={`mt-3 flex-1 min-h-0 flex flex-col calculator-keypad ${keypadGroupGapClass}`}>
              <div className={`flex-1 min-h-0 flex flex-col ${keypadGroupGapClass}`}>
                {keypadRows.map((row, rowIndex) => (
                  <div key={`base-row-${rowIndex}`} className={keypadRowClass}>
                    {row.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => appendToExpression(value)}
                        className={keypadButtonClass}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                ))}

                {showScientificButtons && (
                  <div className={keypadRowClass}>
                    <button
                      type="button"
                      onClick={() => applyUnaryOperation((value) => value / 100)}
                      className={keypadButtonClass}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => appendToExpression('^')}
                      className={keypadButtonClass}
                    >
                      xʸ
                    </button>
                    <button
                      type="button"
                      onClick={() => appendConstant(Math.PI)}
                      className={keypadButtonClass}
                    >
                      π
                    </button>
                    <button
                      type="button"
                      onClick={() => appendConstant(Math.E)}
                      className={keypadButtonClass}
                    >
                      e
                    </button>
                  </div>
                )}

                {showExtendedScientificButtons && (
                  <div className={keypadRowClass}>
                    <button
                      type="button"
                      onClick={() => applyUnaryOperation((value) => -value)}
                      className={keypadButtonClass}
                    >
                      +/−
                    </button>
                    <button
                      type="button"
                      onClick={() => applyUnaryOperation((value) => (value === 0 ? null : 1 / value))}
                      className={keypadButtonClass}
                    >
                      1/x
                    </button>
                    <button
                      type="button"
                      onClick={() => applyUnaryOperation((value) => value * value)}
                      className={keypadButtonClass}
                    >
                      x²
                    </button>
                    <button
                      type="button"
                      onClick={() => applyUnaryOperation((value) => (value < 0 ? null : Math.sqrt(value)))}
                      className={keypadButtonClass}
                    >
                      √x
                    </button>
                  </div>
                )}

                <div className={keypadRowClass}>
                  <button
                    type="button"
                    onClick={clearExpression}
                    className={keypadButtonClass}
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={backspaceExpression}
                    aria-label="Apagar último caractere"
                    className={keypadButtonClass}
                  >
                    <Delete size={16} className="mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => appendToExpression('.')}
                    className={keypadButtonClass}
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={applyEvaluation}
                    className={keypadPrimaryButtonClass}
                  >
                    =
                  </button>
                </div>

                <div className={keypadSingleRowClass}>
                  <button
                    type="button"
                    onClick={sendResultToActiveInput}
                    aria-label="Enviar resultado para o campo selecionado"
                    className={keypadPrimaryButtonClass}
                  >
                    <ArrowRight size={16} className="mx-auto" />
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Arraste para redimensionar ou toque rápido para resetar"
                  onPointerDown={startResize}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      resetPanelRect()
                    }
                  }}
                  style={{ touchAction: 'none' }}
                  className="mx-auto mt-1 h-1.5 w-16 rounded-full border border-primary/40 bg-tertiary/90 opacity-95 cursor-ns-resize focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] calculator-handle-idle"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!isExpanded && !isHidden && (
        <div
          className={
            iconOrigin === 'top-right'
              ? 'fixed right-0 z-[1001] w-10 safe-area-right'
              : 'fixed right-4 z-[1001] h-10 w-10 safe-area-right bottom-[calc(6.2rem+env(safe-area-inset-bottom))] lg:bottom-8 safe-area-bottom'
          }
          style={iconOrigin === 'top-right' ? { top: `${customTopY}px`, touchAction: 'none' } : { touchAction: 'none' }}
        >
          {/* Old drag limits indicator omitted in cyberpunk mode for cleaner interaction */}
          {(isDraggingIcon || isIconReturning) && (
            <div
              className={`pointer-events-none absolute rounded-full border border-primary ${isDraggingIcon ? 'opacity-80' : 'opacity-0'} motion-emphasis`}
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
            onPointerDown={startIconDrag}
            onClick={handleIconClick}
            aria-label="Abrir calculadora flutuante"
            style={{
              transform: `translate(${iconOffset.x}px, ${iconOrigin === 'top-right' ? 0 : iconOffset.y}px)`,
              touchAction: 'none',
            }}
            className={
              iconOrigin === 'top-right'
                ? `h-12 w-10 rounded-l-2xl rounded-r-none border-y border-l border-glass surface-glass-strong text-primary hover:text-accent press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                    isDraggingIcon ? 'cursor-grabbing' : 'cursor-grab'
                  } transition-all duration-300 hover:-translate-x-1.5 hover:w-11 shadow-lg flex items-center justify-center`
                : `h-10 w-10 rounded-full border border-glass surface-glass-strong text-primary hover:text-accent press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                    isDraggingIcon ? 'cursor-grabbing' : 'cursor-grab'
                  } ${
                    isIconReturning ? 'transition-transform duration-300 ease-out' : 'motion-standard hover-lift-subtle calculator-fab-idle'
                  } shadow-lg flex items-center justify-center`
            }
          >
            <Calculator size={17} className="mx-auto" />
          </button>
        </div>
      )}
    </>
  )
}
