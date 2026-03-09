import { useCallback, useState } from 'react'
import {
  confirmAssistantCommand,
  getActiveAssistantSession,
  getAssistantMonthlyInsights,
  interpretAssistantCommand,
} from '@/services/assistantService'
import type { AssistantConfirmationMode } from '@/services/assistant-core/confirmationPolicy'
import type {
  AssistantConfirmation,
  AssistantConfirmResult,
  AssistantInterpretResult,
  AssistantMonthlyInsightsResult,
  AssistantSession,
  AssistantSlots,
} from '@/types'

interface UseAssistantState {
  loading: boolean
  error: string | null
  session: AssistantSession | null
  lastInterpretation: AssistantInterpretResult | null
  lastConfirmation: AssistantConfirmResult | null
  lastInsights: AssistantMonthlyInsightsResult | null
}

export function useAssistant(deviceId: string = 'web-preview-device') {
  const [state, setState] = useState<UseAssistantState>({
    loading: false,
    error: null,
    session: null,
    lastInterpretation: null,
    lastConfirmation: null,
    lastInsights: null,
  })

  const setLoading = (loading: boolean) => {
    setState((prev) => ({ ...prev, loading }))
  }

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }

  const ensureSession = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getActiveAssistantSession(deviceId)
      setState((prev) => ({ ...prev, session, error: null }))
      return session
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar sessão do assistente.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  const interpret = useCallback(
    async (text: string, options?: { confirmationMode?: AssistantConfirmationMode; locale?: string; forceConfirmation?: boolean }) => {
      setLoading(true)
      try {
        const interpretation = await interpretAssistantCommand({
          deviceId,
          text,
          locale: options?.locale || 'pt-BR',
          confirmationMode: options?.confirmationMode,
          forceConfirmation: options?.forceConfirmation,
        })

        setState((prev) => ({
          ...prev,
          lastInterpretation: interpretation,
          error: null,
        }))

        return interpretation
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao interpretar comando de voz.'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [deviceId],
  )

  const confirm = useCallback(async (
    commandId: string,
    confirmed: boolean,
    spokenText?: string,
    editedDescription?: string,
    editedSlots?: AssistantSlots,
    confirmationMethod?: AssistantConfirmation['confirmation_method'],
  ) => {
    setLoading(true)
    try {
      const result = await confirmAssistantCommand({
        commandId,
        confirmed,
        spokenText,
        editedDescription,
        editedSlots,
        confirmationMethod,
      })
      setState((prev) => ({
        ...prev,
        lastConfirmation: result,
        error: null,
      }))
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao confirmar comando de voz.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getInsights = useCallback(async (month?: string) => {
    setLoading(true)
    try {
      const insights = await getAssistantMonthlyInsights(month)
      setState((prev) => ({
        ...prev,
        lastInsights: insights,
        error: null,
      }))
      return insights
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar insights mensais.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lastInterpretation: null,
      lastConfirmation: null,
      error: null,
    }))
  }, [])

  return {
    ...state,
    ensureSession,
    interpret,
    confirm,
    getInsights,
    reset,
  }
}
