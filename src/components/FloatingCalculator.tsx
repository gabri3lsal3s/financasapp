import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calculator } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useCalculatorExpression } from '@/hooks/useCalculatorExpression'
import { useCalculatorTargetInput } from '@/hooks/useCalculatorTargetInput'
import { useCalculatorIconDrag } from '@/hooks/useCalculatorIconDrag'
import { useCalculatorKeyboard, type CalculatorKeyboardHandlers } from '@/hooks/useCalculatorKeyboard'
import { useCalculatorPanel } from '@/hooks/useCalculatorPanel'
import { Z_INDEX } from '@/constants/zIndex'
import {
  CALCULATOR_SIDE_SLOT_ID,
  FLOATING_SIDE_BUTTON_NEUTRAL,
  FLOATING_SIDE_BUTTON_BASE,
  FLOATING_SIDE_BUTTON_HEIGHT,
} from '@/components/floatingSideLayout'
import {
  type CalculatorPosition,
  readPersistedPosition,
  persistPosition,
  calculateYFromPercent,
  getCalculatorPanelOpenClass,
  getCalculatorButtonWrapperClass,
  buildIconDragTransform,
  getSafeYRange,
} from '@/components/calculatorOriginFlip'
import {
  clamp,
  getPanelMinWidth,
  getPanelMinHeight,
  getPanelResizeMaxHeight,
  getUniformPanelSize,
  PANEL_MARGIN,
  MAX_PANEL_WIDTH,
} from '@/utils/calculatorGeometry'
import { isNumericField } from '@/utils/calculatorDom'
import CalculatorPanel from '@/components/calculator/CalculatorPanel'

interface FloatingCalculatorProps {
  isHidden?: boolean
}

export default function FloatingCalculator({ isHidden = false }: FloatingCalculatorProps) {
  const location = useLocation()
  const [slotTop, setSlotTop] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  const [isExpanded, setIsExpanded] = useState(false)
  const [isIconLabelExpanded, setIsIconLabelExpanded] = useState(false)
  const iconLabelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { settings: { floatingCalculatorAbsorbed }, updateSetting } = useAppSettings()
  const {
    panelRect,
    setPanelRect,
    isResizingPanel,
    setIsResizingPanel,
    resizePreviewRect,
    setResizePreviewRect,
    startDrag,
    startResize,
    resetPanelRect,
  } = useCalculatorPanel()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [position, setPosition] = useState<CalculatorPosition>(() => readPersistedPosition(isDesktop))

  const { selectedFieldName, resolveTargetInput } = useCalculatorTargetInput(isExpanded)

  const closeCalculator = useCallback(() => setIsExpanded(false), [])

  const expression = useCalculatorExpression({
    resolveTargetInput,
    onClose: closeCalculator,
  })

  // Atualiza a posição (lado e Y percentual) conforme o drag termina
  const commitPosition = useCallback((newSide: 'left' | 'right', newYPercent: number) => {
    const clamped = Math.max(0, Math.min(100, newYPercent))
    setPosition((prev) => {
      const next: CalculatorPosition = { ...prev, side: newSide, yPercent: clamped }
      persistPosition(next, isDesktop)
      return next
    })
  }, [isDesktop])

  const iconDrag = useCalculatorIconDrag({
    slotTop,
    floatingCalculatorAbsorbed,
    updateSetting,
    commitPosition,
  })

  // WHY: ref estável para os handlers do keyboard, quebra cadeia de dependências
  const keyboardHandlersRef = useRef<CalculatorKeyboardHandlers>({
    appendToExpression: expression.appendToExpression,
    applyEvaluation: expression.applyEvaluation,
    backspaceExpression: expression.backspaceExpression,
    clearExpression: expression.clearExpression,
  })

  keyboardHandlersRef.current = {
    appendToExpression: expression.appendToExpression,
    applyEvaluation: expression.applyEvaluation,
    backspaceExpression: expression.backspaceExpression,
    clearExpression: expression.clearExpression,
  }

  useCalculatorKeyboard(isExpanded, keyboardHandlersRef, closeCalculator)

  // WHY: efeito unificado para resize da viewport, posição do slot lateral e mobile toggle
  useEffect(() => {
    const slot = document.getElementById(CALCULATOR_SIDE_SLOT_ID)
    const stack = document.getElementById('floating-side-stack')

    const updateSlotTop = () => {
      if (!slot) return
      const rect = slot.getBoundingClientRect()
      setSlotTop(rect.top)
    }

    const onResizeViewport = () => {
      updateSlotTop()
      setPanelRect((currentRect) => {
        const minWidth = getPanelMinWidth(window.innerWidth)
        const minHeight = getPanelMinHeight(window.innerWidth, window.innerHeight)
        const maxWidthByViewport = Math.max(
          minWidth,
          Math.min(MAX_PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2),
        )
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

    updateSlotTop()

    const resizeObserver = new ResizeObserver(updateSlotTop)
    if (stack) resizeObserver.observe(stack)

    window.addEventListener('resize', onResizeViewport)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', onResizeViewport)
    }
  }, [location.pathname, mounted, setPanelRect])

  // Listen to open events from external components like PageActionButtonHub.tsx
  useEffect(() => {
    const handleOpen = () => {
      setIsExpanded(true)
    }
    window.addEventListener('open-floating-calculator', handleOpen)
    return () => {
      window.removeEventListener('open-floating-calculator', handleOpen)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    return () => {
      if (iconLabelTimeoutRef.current) {
        clearTimeout(iconLabelTimeoutRef.current)
      }
    }
  }, [])

  // A transição de retorno do ícone é gerenciada pelo CSS (calculator-icon-wrapper-transition--returning)

  useEffect(() => {
    setIsExpanded(false)
    setIsResizingPanel(false)
    setResizePreviewRect(null)
    resetPanelRect()
  }, [location.pathname, resetPanelRect, setIsResizingPanel, setResizePreviewRect])

  const openCalculator = () => {
    const activeNumericInput = resolveTargetInput()

    if (activeNumericInput && isNumericField(activeNumericInput) && activeNumericInput.value.trim()) {
      expression.preloadExpression(activeNumericInput.value)
    }

    // Mobile: blur the input to hide the native keyboard when calculator opens
    if (activeNumericInput && !isDesktop) {
      const inputToBlur = activeNumericInput
      // Pequeno delay para garantir que o evento de focus complete antes do blur
      setTimeout(() => {
        inputToBlur?.blur()
      }, 0)
    }

    setIsExpanded(true)
  }

  const startIconDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    event.preventDefault()
    iconDrag.initiateIconDrag(event.clientX, event.clientY, event.pointerId, event.currentTarget)
  }

  const handleIconClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (iconDrag.iconDragMovedRef.current) {
      event.preventDefault()
      iconDrag.iconDragMovedRef.current = false
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

  const panelOpenClass = getCalculatorPanelOpenClass(position.side)

  const isDetached = iconDrag.isDraggingIcon ||
    (iconDrag.isIconReturning && floatingCalculatorAbsorbed) ||
    iconDrag.isIconAbsorbing ||
    iconDrag.isDraggingFromHub

  const sideTabButtonClassName = cn(
    FLOATING_SIDE_BUTTON_BASE,
    FLOATING_SIDE_BUTTON_HEIGHT,
    isDetached
      ? 'rounded-[20px] border w-10 min-w-10 p-0 !justify-center'
      : cn(
          'border rounded-[16px]',
          position.side === 'left'
            ? 'pl-6 pr-4 min-w-10'
            : 'pl-4 pr-6 min-w-10'
        ),
    iconDrag.isDraggingIcon ? 'cursor-grabbing scale-[1.02] transition-none' : 'cursor-grab',
    FLOATING_SIDE_BUTTON_NEUTRAL,
    'calculator-origin-button',
    iconDrag.isDraggingIcon && 'calculator-origin-button--dragging',
    isIconLabelExpanded && 'glass-button-side-expanded'
  )

  const iconDragTransform = buildIconDragTransform(iconDrag.dragOffset, iconDrag.isDraggingIcon)

  const renderCalculatorIconButton = () => (
    <button
      type="button"
      onPointerDown={startIconDrag}
      onClick={handleIconClick}
      aria-label="Abrir calculadora flutuante"
      className={cn(
        sideTabButtonClassName,
        !isDetached && position.side === 'right' && 'flex-row-reverse'
      )}
    >
      <Calculator size={isDesktop ? 18 : 16} className="shrink-0 text-primary calculator-icon" aria-hidden />
      {!isDetached && (
        <span className="glass-button-label whitespace-nowrap text-xs sm:text-sm font-bold uppercase tracking-wider">
          Calculadora
        </span>
      )}
    </button>
  )

  const renderFloatingIcon = () => {
    if (isExpanded || isHidden) return null
    if (floatingCalculatorAbsorbed && !iconDrag.isDraggingFromHub && !iconDrag.isIconReturning && !iconDrag.isIconAbsorbing) return null

    const iconContent = renderCalculatorIconButton()
    const viewportHeight = window.innerHeight
    const buttonHeight = 40
    const [safeMinY] = getSafeYRange(viewportHeight, buttonHeight)
    // Posição Y em pixels baseada no percentual armazenado
    let iconTopPx
    if (iconDrag.dragPreviewY !== null) {
      iconTopPx = iconDrag.dragPreviewY
    } else {
      iconTopPx = calculateYFromPercent(position.yPercent, viewportHeight, buttonHeight)
    }

    // Ajuste fino: se o slot lateral estiver definido e for maior que a posição calculada,
    // usa o slot como referência mínima (para não sobrepor o header)
    const minTop = slotTop !== null ? Math.max(slotTop + 8, safeMinY) : safeMinY
    iconTopPx = Math.max(minTop, iconTopPx)

    // Calculate left position dynamically to allow smooth transition between sides
    const sideMargin = isDesktop ? 12 : 8
    let leftPx = position.side === 'left'
      ? (isDetached ? sideMargin : -16)
      : (isDetached ? window.innerWidth - 40 - sideMargin : window.innerWidth - 240 + 16)

    if (iconDrag.dragPreviewX !== null) {
      leftPx = iconDrag.dragPreviewX
    }

    // Dynamically calculate scale based on proximity to hub and absorbing state
    let currentScale = 1
    if (iconDrag.isIconAbsorbing) {
      currentScale = 0
    } else if (iconDrag.isNearHub) {
      currentScale = 0.68
    }

    // Dynamically calculate opacity style override
    const opacityStyle = iconDrag.isIconAbsorbing || iconDrag.isNearHub
      ? { opacity: iconDrag.isIconAbsorbing ? 0 : 0.48 }
      : {}

    const wrapperStyle: React.CSSProperties = {
      top: `${iconTopPx}px`,
      left: `${leftPx}px`,
      transform: `${iconDragTransform} scale(${currentScale})`,
      ...opacityStyle,
    }

    return (
      <div
        className={cn(
          getCalculatorButtonWrapperClass(
            position.side,
            iconDrag.isDraggingIcon,
            iconDrag.isIconReturning
          ),
          iconDrag.isNearHub && 'calculator-icon-wrapper--near-hub',
          iconDrag.isIconAbsorbing && 'calculator-icon-wrapper--absorbing',
          isDetached ? 'w-10 justify-center' : cn('w-[240px]', position.side === 'right' ? 'justify-end' : 'justify-start'),
          'flex'
        )}
        style={wrapperStyle}
      >
        {iconContent}
      </div>
    )
  }

  const isCompactPanel = panelRect.height < 520 || panelRect.width < 360
  const showScientificButtons = panelRect.width >= 430 || panelRect.height >= 540
  const showExtendedScientificButtons = panelRect.width >= 520 || panelRect.height >= 610

  if (!mounted) return null

  return createPortal(
    <>
      {isExpanded && isResizingPanel && resizePreviewRect && (
        <div
          className={`fixed ${Z_INDEX.SIDE_STACK} pointer-events-none rounded-2xl border border-[var(--ds-color-accent-primary)]/60 bg-transparent calculator-resize-ghost`}
          style={{
            left: resizePreviewRect.left,
            top: resizePreviewRect.top,
            width: resizePreviewRect.width,
            height: resizePreviewRect.height,
          }}
        />
      )}

      {isExpanded && !isHidden && (
        <CalculatorPanel
          selectedFieldName={selectedFieldName}
          displayExpression={expression.displayExpression}
          displayLastResult={expression.displayLastResult}
          hasError={expression.hasError}
          isCompactPanel={isCompactPanel}
          panelOpenClass={panelOpenClass}
          rect={panelRect}
          onMinimize={() => setIsExpanded(false)}
          onPanelPointerDown={startDrag}
          showScientificButtons={showScientificButtons}
          showExtendedScientificButtons={showExtendedScientificButtons}
          onAppend={expression.appendToExpression}
          onAppendConstant={expression.appendConstant}
          onClear={expression.clearExpression}
          onBackspace={expression.backspaceExpression}
          onEvaluate={expression.applyEvaluation}
          onUnary={expression.applyUnaryOperation}
          onSendResult={expression.sendResultToActiveInput}
          onResizeHandlePointerDown={startResize}
          onResizeHandleKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              resetPanelRect()
            }
          }}
        />
      )}

      {renderFloatingIcon()}
    </>,
    document.body
  )
}
