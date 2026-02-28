export type AssistantBridgeTurnType = 'interpret' | 'confirm' | 'insights'

export interface AssistantBridgeTurnRequest {
  turnType: AssistantBridgeTurnType
  deviceId: string
  locale?: string
  text?: string
  commandId?: string
  confirmed?: boolean
  spokenText?: string
  month?: string
}

export interface AssistantBridgeOptionItem {
  id?: string
  name: string
  confidence?: number
}

export interface AssistantBridgeTurnResponse {
  status: 'ok' | 'error'
  requiresConfirmation: boolean
  speakText: string
  commandId?: string
  intent?: string
  options?: AssistantBridgeOptionItem[]
  payload?: Record<string, unknown>
  error?: string
}
