import { useCallback, useEffect, useState } from 'react'
import { useAssistant } from '@/hooks/useAssistant'
import { resolveConfirmationPolicy } from '@/services/assistant-core/confirmationPolicy'
import type { AssistantConfirmationMode } from '@/services/assistant-core/confirmationPolicy'
import { assistantParserInternals } from '@/services/assistantService'
import type { AssistantConfirmation, AssistantConfirmResult, AssistantInterpretResult, AssistantSlots } from '@/types'
import { trackAssistantTelemetry } from '@/utils/assistantTelemetry'
import { enqueueAssistantOfflineCommand } from '@/utils/assistantOfflineQueue'
import {
  learnAssistantMemoryFromConfirmation,
} from '@/utils/assistantMemory'
import {
  rememberAssistantSessionPreference,
  resolveAssistantContextWithPriority,
} from '@/utils/assistantContextResolver'
import {
  clearAssistantPendingContext,
  getAssistantPendingContext,
  saveAssistantPendingContext,
} from '@/utils/assistantSessionContext'

interface OfflinePendingCommand {
  text: string
  confirmationMode?: AssistantConfirmationMode
  forceConfirmation?: boolean
}

interface UseAssistantTurnPreferences {
  locale?: 'pt-BR'
  offlineBehavior?: 'write_fallback' | 'strict_online'
  responseDepth?: 'concise' | 'consultive'
}

interface ConfirmLastInterpretationParams {
  confirmed: boolean
  spokenText?: string
  includeEditable?: boolean
  confirmationMethod?: AssistantConfirmation['confirmation_method']
}

export function useAssistantTurn(deviceId: string, preferences?: UseAssistantTurnPreferences) {
  const {
    loading: assistantLoading,
    error: assistantError,
    lastInterpretation,
    lastConfirmation,
    ensureSession,
    interpret,
    confirm,
    reset,
  } = useAssistant(deviceId)

  const [assistantText, setAssistantText] = useState('')
  const [editableConfirmationText, setEditableConfirmationText] = useState('')
  const [editableSlots, setEditableSlots] = useState<AssistantSlots | null>(null)
  const [localInterpretation, setLocalInterpretation] = useState<AssistantInterpretResult | null>(null)
  const [localConfirmation, setLocalConfirmation] = useState<AssistantConfirmResult | null>(null)
  const [offlinePendingCommands, setOfflinePendingCommands] = useState<Record<string, OfflinePendingCommand>>({})
  const [pendingContextExpiresAt, setPendingContextExpiresAt] = useState<string | null>(null)

  const locale = preferences?.locale || 'pt-BR'
  const offlineBehavior = preferences?.offlineBehavior || 'write_fallback'
  const responseDepth = preferences?.responseDepth || 'consultive'

  const activeInterpretation = localInterpretation || lastInterpretation
  const activeConfirmation = localConfirmation || lastConfirmation

  useEffect(() => {
    const pendingContext = getAssistantPendingContext(deviceId)
    if (!pendingContext) {
      setPendingContextExpiresAt(null)
      return
    }

    setLocalInterpretation((current) => current || pendingContext.interpretation)
    setPendingContextExpiresAt(pendingContext.expiresAt)

    if (pendingContext.offlinePending) {
      const offlineCommandId = pendingContext.interpretation.command.id
      setOfflinePendingCommands((previous) => {
        if (previous[offlineCommandId]) return previous
        return {
          ...previous,
          [offlineCommandId]: pendingContext.offlinePending as OfflinePendingCommand,
        }
      })
    }
  }, [deviceId])

  useEffect(() => {
    if (!pendingContextExpiresAt) return undefined

    const expirationTime = Date.parse(pendingContextExpiresAt)
    if (Number.isNaN(expirationTime)) {
      clearAssistantPendingContext(deviceId)
      setPendingContextExpiresAt(null)
      return undefined
    }

    const delay = expirationTime - Date.now()

    if (delay <= 0) {
      clearAssistantPendingContext(deviceId)
      setPendingContextExpiresAt(null)
      setLocalInterpretation(null)
      return undefined
    }

    const timer = window.setTimeout(() => {
      clearAssistantPendingContext(deviceId)
      setPendingContextExpiresAt(null)
      setLocalInterpretation(null)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [deviceId, pendingContextExpiresAt])

  useEffect(() => {
    if (!activeInterpretation) return
    setEditableConfirmationText(activeInterpretation.confirmationText)
    setEditableSlots(JSON.parse(JSON.stringify(activeInterpretation.slots || {})) as AssistantSlots)
  }, [activeInterpretation])

  const updateEditableSlots = useCallback((updater: (previous: AssistantSlots) => AssistantSlots) => {
    setEditableSlots((previous) => {
      const base = previous || {}
      return updater(base)
    })
  }, [])

  const interpretCommand = useCallback(async (text: string, options?: { confirmationMode?: AssistantConfirmationMode; forceConfirmation?: boolean }) => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const startedAt = Date.now()

    try {
      await ensureSession()
      const result = await interpret(trimmed, {
        ...options,
        locale,
      })
      const contextResolved = resolveAssistantContextWithPriority(deviceId, result.intent, result.slots)
      const interpretedResult = contextResolved.source !== 'command' && contextResolved.source !== 'none'
        ? {
            ...result,
            slots: contextResolved.slots,
            command: {
              ...result.command,
              slots_json: contextResolved.slots,
            },
          }
        : result

      setLocalInterpretation(contextResolved.source !== 'command' && contextResolved.source !== 'none' ? interpretedResult : null)
      setLocalConfirmation(null)

      if (interpretedResult.requiresConfirmation) {
        const pendingContext = saveAssistantPendingContext(deviceId, interpretedResult)
        setPendingContextExpiresAt(pendingContext?.expiresAt || null)
      } else {
        clearAssistantPendingContext(deviceId)
        setPendingContextExpiresAt(null)
      }

      trackAssistantTelemetry({
        eventType: 'interpret',
        deviceId,
        commandId: interpretedResult.command.id,
        intent: interpretedResult.intent,
        confidence: interpretedResult.confidence,
        requiresConfirmation: interpretedResult.requiresConfirmation,
        confirmationMode: options?.confirmationMode,
        forceConfirmation: options?.forceConfirmation,
        status: 'success',
        durationMs: Date.now() - startedAt,
      })

      return interpretedResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao interpretar comando'

      const shouldFallbackOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine)
        || /network|fetch|offline|rede/i.test(errorMessage)

      if (shouldFallbackOffline) {
        if (offlineBehavior === 'strict_online') {
          throw new Error(responseDepth === 'concise'
            ? 'Sem internet para executar este comando. Reconecte e tente novamente.'
            : 'Sem internet para executar este comando no modo online estrito. Reconecte para interpretar e confirmar com segurança.')
        }

        const { intent, confidence } = assistantParserInternals.inferIntent(trimmed)
        const slots = assistantParserInternals.buildSlots(trimmed, intent)
        const policy = resolveConfirmationPolicy({
          intent,
          slots,
          confidence,
          mode: options?.confirmationMode || 'write_only',
        })

        if (intent === 'add_expense' || intent === 'add_income' || intent === 'add_investment') {
          const offlineCommandId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

          setOfflinePendingCommands((previous) => ({
            ...previous,
            [offlineCommandId]: {
              text: trimmed,
              confirmationMode: options?.confirmationMode,
              forceConfirmation: options?.forceConfirmation,
            },
          }))

          const offlineInterpretation: AssistantInterpretResult = {
            command: {
              id: offlineCommandId,
              session_id: 'offline-session',
              command_text: trimmed,
              interpreted_intent: intent,
              confidence,
              slots_json: slots,
              requires_confirmation: true,
              status: 'pending_confirmation',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            intent,
            confidence,
            slots,
            requiresConfirmation: policy.requiresConfirmation,
            confirmationText: 'Sem internet no momento. Posso enfileirar este comando para sincronizar automaticamente quando a conexão voltar. Confirmar?',
          }

          const contextResolved = resolveAssistantContextWithPriority(deviceId, offlineInterpretation.intent, offlineInterpretation.slots)
          const offlineResult = contextResolved.source !== 'command' && contextResolved.source !== 'none'
            ? {
                ...offlineInterpretation,
                slots: contextResolved.slots,
                command: {
                  ...offlineInterpretation.command,
                  slots_json: contextResolved.slots,
                },
              }
            : offlineInterpretation

          setLocalInterpretation(offlineResult)
          setLocalConfirmation(null)

          const pendingContext = saveAssistantPendingContext(deviceId, offlineResult, {
            offlinePending: {
              text: trimmed,
              confirmationMode: options?.confirmationMode,
              forceConfirmation: options?.forceConfirmation,
            },
          })
          setPendingContextExpiresAt(pendingContext?.expiresAt || null)

          trackAssistantTelemetry({
            eventType: 'interpret',
            deviceId,
            commandId: offlineCommandId,
            intent,
            confidence,
            requiresConfirmation: true,
            confirmationMode: options?.confirmationMode,
            forceConfirmation: options?.forceConfirmation,
            status: 'success',
            durationMs: Date.now() - startedAt,
          })

          return offlineResult
        }

        throw new Error('Sem internet: no modo offline só é possível cadastrar despesas, rendas e investimentos. Para consultas e edições, reconecte e tente novamente.')
      }

      trackAssistantTelemetry({
        eventType: 'interpret',
        deviceId,
        confirmationMode: options?.confirmationMode,
        status: 'error',
        durationMs: Date.now() - startedAt,
        errorMessage,
      })
      throw error
    }
  }, [deviceId, ensureSession, interpret, locale, offlineBehavior, responseDepth])

  const confirmLastInterpretation = useCallback(async ({
    confirmed,
    spokenText,
    includeEditable = true,
    confirmationMethod,
  }: ConfirmLastInterpretationParams): Promise<AssistantConfirmResult | null> => {
    const commandId = activeInterpretation?.command.id
    if (!commandId) return null

    if (pendingContextExpiresAt && Date.parse(pendingContextExpiresAt) <= Date.now()) {
      clearAssistantPendingContext(deviceId)
      setPendingContextExpiresAt(null)
      setLocalInterpretation(null)

      const expiredResult: AssistantConfirmResult = {
        status: 'expired',
        message: 'Janela de confirmação expirada. Interprete o comando novamente.',
        commandId,
      }

      setLocalConfirmation(expiredResult)
      return expiredResult
    }

    const startedAt = Date.now()

    const resolvedSpokenText = spokenText ?? (editableConfirmationText.trim() || undefined)
    const editedDescription = includeEditable
      ? (editableSlots?.description?.trim() || undefined)
      : undefined
    const editedSlots = includeEditable
      ? (editableSlots || undefined)
      : undefined
    const resolvedConfirmationMethod = confirmationMethod || (spokenText ? 'voice' : 'touch')

    if (commandId.startsWith('offline-')) {
      const pending = offlinePendingCommands[commandId]
      if (!pending) return null

      if (!confirmed) {
        const deniedResult: AssistantConfirmResult = {
          status: 'denied',
          message: 'Comando offline cancelado.',
          commandId,
        }

        setLocalConfirmation(deniedResult)
        setLocalInterpretation(null)
        clearAssistantPendingContext(deviceId)
        setPendingContextExpiresAt(null)
        setOfflinePendingCommands((previous) => {
          const next = { ...previous }
          delete next[commandId]
          return next
        })

        trackAssistantTelemetry({
          eventType: 'confirm',
          deviceId,
          commandId,
          intent: activeInterpretation?.intent,
          confirmationMethod: resolvedConfirmationMethod,
          status: 'denied',
          durationMs: Date.now() - startedAt,
        })

        return deniedResult
      }

      enqueueAssistantOfflineCommand({
        deviceId,
        text: pending.text,
        locale,
        confirmationMode: pending.confirmationMode,
        confirmationMethod: resolvedConfirmationMethod,
        spokenText: resolvedSpokenText,
        editedDescription,
        editedSlots,
        idempotencyKey: commandId,
      })

      if (confirmed && editedSlots) {
        rememberAssistantSessionPreference(deviceId, activeInterpretation.intent, editedSlots)
        learnAssistantMemoryFromConfirmation(activeInterpretation.intent, editedSlots)
      }

      const queuedResult: AssistantConfirmResult = {
        status: 'executed',
        message: 'Comando enfileirado para sincronização automática quando a internet voltar.',
        commandId,
      }

      setLocalConfirmation(queuedResult)
      setLocalInterpretation(null)
      clearAssistantPendingContext(deviceId)
      setPendingContextExpiresAt(null)
      setOfflinePendingCommands((previous) => {
        const next = { ...previous }
        delete next[commandId]
        return next
      })

      trackAssistantTelemetry({
        eventType: 'confirm',
        deviceId,
        commandId,
        intent: activeInterpretation?.intent,
        confirmationMethod: resolvedConfirmationMethod,
        status: 'executed',
        durationMs: Date.now() - startedAt,
      })

      return queuedResult
    }

    try {
      const result = await confirm(
        commandId,
        confirmed,
        resolvedSpokenText,
        editedDescription,
        editedSlots,
        resolvedConfirmationMethod,
      )

      if (!result) {
        throw new Error('Resposta inválida de confirmação do assistente.')
      }

      trackAssistantTelemetry({
        eventType: 'confirm',
        deviceId,
        commandId,
        intent: activeInterpretation?.intent,
        confirmationMethod: resolvedConfirmationMethod,
        status: result.status,
        durationMs: Date.now() - startedAt,
      })

      clearAssistantPendingContext(deviceId)
      setPendingContextExpiresAt(null)

      if (confirmed && result.status === 'executed' && editedSlots) {
        rememberAssistantSessionPreference(deviceId, activeInterpretation.intent, editedSlots)
        learnAssistantMemoryFromConfirmation(activeInterpretation.intent, editedSlots)
      }

      return result
    } catch (error) {
      trackAssistantTelemetry({
        eventType: 'confirm',
        deviceId,
        commandId,
        intent: activeInterpretation?.intent,
        confirmationMethod: resolvedConfirmationMethod,
        status: 'error',
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : 'Erro ao confirmar comando',
      })
      throw error
    }
  }, [
    activeInterpretation?.command.id,
    activeInterpretation?.intent,
    confirm,
    deviceId,
    editableConfirmationText,
    editableSlots,
    offlinePendingCommands,
    pendingContextExpiresAt,
    locale,
  ])

  const resetAssistantTurn = useCallback(() => {
    reset()
    setLocalInterpretation(null)
    setLocalConfirmation(null)
    setAssistantText('')
    setEditableConfirmationText('')
    setEditableSlots(null)
    setPendingContextExpiresAt(null)
    clearAssistantPendingContext(deviceId)
  }, [deviceId, reset])

  return {
    assistantLoading,
    assistantError,
    lastInterpretation: activeInterpretation,
    lastConfirmation: activeConfirmation,
    assistantText,
    setAssistantText,
    editableConfirmationText,
    setEditableConfirmationText,
    editableSlots,
    updateEditableSlots,
    interpretCommand,
    confirmLastInterpretation,
    resetAssistantTurn,
  }
}
