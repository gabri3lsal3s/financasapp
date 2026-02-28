import type {
  AssistantBridgeTurnRequest,
  AssistantBridgeTurnResponse,
} from '@/types/assistantBridge'
import {
  confirmAssistantCommand,
  getAssistantMonthlyInsights,
  interpretAssistantCommand,
} from '@/services/assistantService'

const buildDisambiguationOptions = (categoryResolutionJson: unknown) => {
  const rawCandidates = (categoryResolutionJson as { candidates?: Array<{ id?: string; name: string; confidence?: number }> } | undefined)?.candidates || []
  return rawCandidates.slice(0, 3).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    confidence: candidate.confidence,
  }))
}

export async function processAssistantBridgeTurn(
  request: AssistantBridgeTurnRequest,
): Promise<AssistantBridgeTurnResponse> {
  try {
    if (request.turnType === 'interpret') {
      if (!request.text?.trim()) {
        return {
          status: 'error',
          requiresConfirmation: false,
          speakText: 'Não entendi o comando de voz.',
          error: 'Campo text é obrigatório no turno interpret.',
        }
      }

      const result = await interpretAssistantCommand({
        deviceId: request.deviceId,
        locale: request.locale || 'pt-BR',
        text: request.text,
      })

      const options = buildDisambiguationOptions(result.command.category_resolution_json)

      return {
        status: 'ok',
        requiresConfirmation: result.requiresConfirmation,
        speakText: result.confirmationText,
        commandId: result.command.id,
        intent: result.intent,
        options,
        payload: {
          confidence: result.confidence,
          slots: result.slots,
        },
      }
    }

    if (request.turnType === 'confirm') {
      if (!request.commandId) {
        return {
          status: 'error',
          requiresConfirmation: false,
          speakText: 'Comando inválido para confirmação.',
          error: 'Campo commandId é obrigatório no turno confirm.',
        }
      }

      const result = await confirmAssistantCommand({
        commandId: request.commandId,
        confirmed: !!request.confirmed,
        spokenText: request.spokenText,
      })

      return {
        status: result.status === 'failed' ? 'error' : 'ok',
        requiresConfirmation: false,
        speakText: result.message,
        commandId: result.commandId,
        payload: {
          transactionId: result.transactionId,
          resultStatus: result.status,
        },
        error: result.status === 'failed' ? result.message : undefined,
      }
    }

    if (request.turnType === 'insights') {
      const insights = await getAssistantMonthlyInsights(request.month)

      const speakText = [
        `Insights de ${insights.month}.`,
        ...insights.highlights,
        ...insights.recommendations,
      ].join(' ')

      return {
        status: 'ok',
        requiresConfirmation: false,
        speakText,
        intent: 'monthly_insights',
        payload: {
          month: insights.month,
          highlights: insights.highlights,
          recommendations: insights.recommendations,
        },
      }
    }

    return {
      status: 'error',
      requiresConfirmation: false,
      speakText: 'Tipo de turno não suportado.',
      error: `turnType inválido: ${request.turnType}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no bridge do assistente.'

    return {
      status: 'error',
      requiresConfirmation: false,
      speakText: 'Ocorreu um erro ao processar o comando de voz.',
      error: message,
    }
  }
}
