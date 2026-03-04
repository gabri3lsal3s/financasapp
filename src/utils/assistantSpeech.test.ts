import { describe, expect, it } from 'vitest'
import { formatAssistantSpeechText } from '@/utils/assistantSpeech'

describe('assistantSpeech', () => {
  it('retorna versão concisa com primeira sentença', () => {
    const result = formatAssistantSpeechText('Confirme o lançamento de R$ 30,00. Em seguida posso sugerir ajustes.', 'concise')
    expect(result).toBe('Confirme o lançamento de R$ 30,00.')
  })

  it('retorna versão consultiva preservando conteúdo', () => {
    const result = formatAssistantSpeechText('Comando enfileirado para sincronização automática quando a internet voltar', 'consultive')
    expect(result).toBe('Comando enfileirado para sincronização automática quando a internet voltar.')
  })
})
