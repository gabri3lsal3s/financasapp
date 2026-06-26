import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Calculator, ChevronDown, Delete } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { formatNumberBR, roundToDecimals } from '@/utils/format'
import IconButton from '@/components/IconButton'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  CALCULATOR_SIDE_SLOT_ID,
  FLOATING_SIDE_BUTTON_NEUTRAL,
  FLOATING_SIDE_FAB_BASE,
  getFloatingSideTabButtonClassName,
  type FloatingSidePosition,
} from '@/components/floatingSideLayout'
import {
  buildIconDragTransform,
  getCalculatorPanelOpenClass,
} from '@/components/calculatorOriginFlip'


const CALCULATOR_STATE_KEY = 'floating-calculator-state'
const CALCULATOR_UI_KEY = 'floating-calculator-ui'
const CALCULATOR_TARGET_CLASS = 'calculator-target-input'
const PANEL_MARGIN = 8
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
const ORIGIN_FLIP_DURATION_MS = 1150

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

function readPersistedIconOrigin(): IconOrigin {
  try {
    const persistedUiRaw = window.localStorage.getItem(CALCULATOR_UI_KEY)
    if (!persistedUiRaw) return 'bottom-right'

    const persistedUi = JSON.parse(persistedUiRaw) as { iconOrigin?: IconOrigin }
    if (persistedUi.iconOrigin === 'top-right' || persistedUi.iconOrigin === 'bottom-right') {
      return persistedUi.iconOrigin
    }
  } catch {
    window.localStorage.removeItem(CALCULATOR_UI_KEY)
  }

  return 'bottom-right'
}

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

interface FloatingCalculatorProps {
  isHidden?: boolean
}

export default function FloatingCalculator({ isHidden = false }: FloatingCalculatorProps) {
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() => isMobileViewport(window.innerWidth))
  const [slotTop, setSlotTop] = useState<number | null>(null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [mounted, setMounted] = useState(false)

  const [isIconLabelExpanded, setIsIconLabelExpanded] = useState(false)
  const iconLabelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasAlertsFab, setHasAlertsFab] = useState(false)

  useEffect(() => {
    const checkAlertsFab = () => {
      const exists = 
        document.getElementById('alerts-fab') !== null || 
        document.querySelector('.alerts-fab-trigger') !== null ||
        document.querySelector('.animate-bell-ring') !== null
      setHasAlertsFab(exists)
    }

    checkAlertsFab()
    const interval = setInterval(checkAlertsFab, 500)

    return () => {
      clearInterval(interval)
    }
  }, [location.pathname])



  useEffect(() => {
    const slot = document.getElementById(CALCULATOR_SIDE_SLOT_ID)
    const stack = document.getElementById('floating-side-stack')
    if (!slot || !stack) return

    const update = () => {
      const rect = slot.getBoundingClientRect()
      setSlotTop(rect.top)
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(stack)

    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [location.pathname, mounted])
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
  const [iconOrigin, setIconOrigin] = useState<IconOrigin>(() => readPersistedIconOrigin())
  const iconDragMovedRef = useRef(false)
  const iconReturnTimeoutRef = useRef<number | null>(null)
  const iconDragWrapperRef = useRef<HTMLDivElement>(null)

  const commitIconOrigin = useCallback((nextOrigin: IconOrigin, previousOrigin: IconOrigin) => {
    if (nextOrigin === previousOrigin) {
      return
    }
    setIconOrigin(nextOrigin)
  }, [])


  useEffect(() => {
    isExpandedRef.current = isExpanded
    panelRectRef.current = panelRect
  })

  useEffect(() => {
    setMounted(true)
    return () => {
      if (iconLabelTimeoutRef.current) {
        clearTimeout(iconLabelTimeoutRef.current)
      }
      if (iconReturnTimeoutRef.current) {
        window.clearTimeout(iconReturnTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isIconReturning && (iconOffset.x !== 0 || iconOffset.y !== 0)) {
      const rafId = requestAnimationFrame(() => {
        setIconOffset({ x: 0, y: 0 })
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [isIconReturning, iconOffset])

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
  const keypadButtonClass = `h-full min-h-0 rounded-xl flex items-center justify-center bg-secondary text-primary ${keypadButtonTextClass} leading-none font-medium motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] border border-glass hover:bg-accent/50`
  const keypadPrimaryButtonClass = `h-full min-h-0 rounded-xl flex items-center justify-center bg-[var(--color-primary)] text-[var(--color-button-text)] ${keypadButtonTextClass} leading-none font-medium motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] border border-[var(--ds-color-accent-primary)]/25 hover:opacity-90`

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

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return
      }

      const deltaX = moveEvent.clientX - startX
      const rawDeltaY = moveEvent.clientY - startY

      if (!iconDragMovedRef.current && Math.hypot(deltaX, rawDeltaY) > 4) {
        iconDragMovedRef.current = true
      }

      // Helper to clean up active drag tracking and trigger CSS transitions immediately
      const terminateDrag = (nextOrigin: IconOrigin) => {
        setIsDraggingIcon(false)
        setIsIconReturning(true)

        // Calculate inverted offset for FLIP transition
        const isMobileVal = window.innerWidth <= MOBILE_BREAKPOINT
        const yFab = window.innerHeight - (isMobileVal ? 120 : 72)
        const xFab = isMobileVal ? 16 : 32
        const ySide = slotTop !== null ? slotTop : yFab

        let invertX = 0
        let invertY = 0

        if (currentOrigin === 'bottom-right' && nextOrigin === 'top-right') {
          // FAB to Side
          invertY = yFab - ySide + rawDeltaY
          invertX = deltaX - xFab
        } else if (currentOrigin === 'top-right' && nextOrigin === 'bottom-right') {
          // Side to FAB
          invertY = ySide - yFab + rawDeltaY
          invertX = xFab + deltaX
        }

        setIconOffset({ x: invertX, y: invertY })

        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerUp)
        
        if (moveEvent.target instanceof Element) {
          try {
            moveEvent.target.releasePointerCapture(pointerId)
          } catch {
            // Ignorar erro se o elemento já tiver sido desmontado
          }
        }

        iconReturnTimeoutRef.current = window.setTimeout(() => {
          setIsIconReturning(false)
        }, ORIGIN_FLIP_DURATION_MS)
      }

      // 1. If currently at bottom-right (on top of bottom nav bar / bottom corner)
      if (currentOrigin === 'bottom-right') {
        if (rawDeltaY < -16) {
          commitIconOrigin('top-right', currentOrigin)
          const next = 'top-right' as const
          terminateDrag(next)
          currentOrigin = next
        } else {
          setIconOffset({ x: deltaX, y: rawDeltaY })
        }
      } 
      // 2. If currently at top-right (vertical sliding tab mode)
      else if (currentOrigin === 'top-right') {
        setIconOffset({ x: deltaX, y: rawDeltaY })

        // If dragged down, snap back to bottom-right
        if (rawDeltaY > 20) {
          commitIconOrigin('bottom-right', currentOrigin)
          const next = 'bottom-right' as const
          terminateDrag(next)
          currentOrigin = next
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
      }, ORIGIN_FLIP_DURATION_MS)
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

    setIsIconLabelExpanded(true)

    if (iconLabelTimeoutRef.current) {
      clearTimeout(iconLabelTimeoutRef.current)
    }

    iconLabelTimeoutRef.current = setTimeout(() => {
      setIsIconLabelExpanded(false)
    }, 3000)

    openCalculator()
  }

  const sidePosition: FloatingSidePosition = 'right'
  const panelOpenClass = getCalculatorPanelOpenClass(iconOrigin, sidePosition)

  const sideTabButtonClassName = cn(
    getFloatingSideTabButtonClassName(sidePosition),
    isDraggingIcon ? 'cursor-grabbing scale-[1.02] transition-none' : 'cursor-grab',
    FLOATING_SIDE_BUTTON_NEUTRAL,
    'calculator-origin-button',
    isDraggingIcon && 'calculator-origin-button--dragging',
    isIconLabelExpanded && 'glass-button-side-expanded'
  )

  const fabButtonClassName = cn(
    FLOATING_SIDE_FAB_BASE,
    isDraggingIcon ? 'cursor-grabbing scale-[1.04]' : 'cursor-grab',
    FLOATING_SIDE_BUTTON_NEUTRAL,
    'calculator-origin-button',
    isDraggingIcon && 'calculator-origin-button--dragging',
    !isDraggingIcon && !isIconReturning && 'calculator-fab-idle',
    isIconLabelExpanded && 'glass-button-side-expanded'
  )

  const iconDragTransform = buildIconDragTransform(iconOffset, isDraggingIcon)
  const wrapperTransform = iconDragTransform


  const handleIconDragTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || event.target !== iconDragWrapperRef.current) {
      return
    }

    if (!isIconReturning) {
      return
    }

    if (iconReturnTimeoutRef.current) {
      window.clearTimeout(iconReturnTimeoutRef.current)
      iconReturnTimeoutRef.current = null
    }

    setIsIconReturning(false)
  }

  const renderCalculatorIconButton = () => (
    <button
      type="button"
      onPointerDown={startIconDrag}
      onClick={handleIconClick}
      aria-label="Abrir calculadora flutuante"
      className={iconOrigin === 'top-right' ? sideTabButtonClassName : fabButtonClassName}
    >
      <Calculator size={isDesktop ? 18 : 16} className={cn("shrink-0 text-primary", iconOrigin === 'bottom-right' && "mx-auto")} aria-hidden />
      {iconOrigin === 'top-right' && !isDraggingIcon && !isIconReturning && (
        <span className="glass-button-label transition-all duration-300 ease-in-out whitespace-nowrap text-xs sm:text-sm font-bold uppercase tracking-wider">
          Calculadora
        </span>
      )}
    </button>
  )

  const renderFloatingIcon = () => {
    if (isExpanded || isHidden) {
      return null
    }

    const iconContent = renderCalculatorIconButton()

    const isSide = iconOrigin === 'top-right'
    const resolvedTop = isSide && slotTop !== null
      ? slotTop
      : window.innerHeight - (isMobile ? 120 : (hasAlertsFab ? 124 : 72))
    const resolvedRight = isSide
      ? 0
      : (isMobile ? 16 : 32)

    const wrapperStyle: React.CSSProperties = {
      top: `${resolvedTop}px`,
      right: `${resolvedRight}px`,
      transform: wrapperTransform,
    }

    const isNoTransition = isDraggingIcon || (isIconReturning && (iconOffset.x !== 0 || iconOffset.y !== 0))

    return (
      <div
        ref={iconDragWrapperRef}
        className={cn(
          'fixed z-[1201] pointer-events-auto calculator-icon-wrapper-transition',
          isNoTransition && 'calculator-icon-wrapper-transition--no-transition',
          isIconReturning && !isNoTransition && 'calculator-icon-wrapper-transition--returning'
        )}
        style={wrapperStyle}
        onTransitionEnd={handleIconDragTransitionEnd}
      >
        {iconContent}
      </div>
    )
  }


  if (!mounted) return null

  return createPortal(
    <>
      {isExpanded && isResizingPanel && resizePreviewRect && (
        <div
          className="fixed z-[1200] pointer-events-none rounded-2xl border border-[var(--ds-color-accent-primary)]/60 bg-transparent calculator-resize-ghost"
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
          className={cn(
            'fixed z-[1201] rounded-2xl border border-glass surface-glass-strong p-3 shadow-2xl motion-emphasis overflow-hidden pointer-events-auto calculator-element',
            panelOpenClass
          )}
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
                <Calculator size={18} className="text-primary" />
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

      {renderFloatingIcon()}
    </>,
    document.body
  )
}
