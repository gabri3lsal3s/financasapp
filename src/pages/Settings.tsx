import { useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Input from '@/components/Input'
import { PAGE_HEADERS } from '@/constants/pages'
import Button from '@/components/Button'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ColorPaletteSwitcher from '@/components/ColorPaletteSwitcher'
import { useAssistant } from '@/hooks/useAssistant'
import { AlertCircle, Check } from 'lucide-react'

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
  details?: any
}

export default function Settings() {
  const {
    loading: assistantLoading,
    error: assistantError,
    lastInterpretation,
    lastConfirmation,
    lastInsights,
    ensureSession,
    interpret,
    confirm,
    getInsights,
  } = useAssistant('web-settings-device')

  const [connectionTest, setConnectionTest] = useState<TestResult>({
    status: 'idle',
    message: '',
  })
  const [tableTest, setTableTest] = useState<TestResult>({
    status: 'idle',
    message: '',
  })
  const [assistantText, setAssistantText] = useState('')
  const [confirmationSpokenText, setConfirmationSpokenText] = useState('confirmar')
  const [voiceStatus, setVoiceStatus] = useState<string>('')
  const [voiceListening, setVoiceListening] = useState(false)
  const assistantInputRef = useRef<HTMLInputElement | null>(null)

  const voiceSupport = useMemo(() => {
    if (typeof window === 'undefined') {
      return { recognition: false, synthesis: false }
    }

    const hasRecognition = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    const hasSynthesis = Boolean(window.speechSynthesis)

    return {
      recognition: hasRecognition,
      synthesis: hasSynthesis,
    }
  }, [])

  const testConnection = async () => {
    if (!isSupabaseConfigured) {
      setConnectionTest({
        status: 'error',
        message: 'Variáveis de ambiente não configuradas',
      })
      return
    }

    setConnectionTest({ status: 'testing', message: 'Testando conexão...' })

    try {
      // Teste básico de conexão
      const { error } = await supabase.from('categories').select('count').limit(0)

      if (error) {
        // Se o erro for de tabela não encontrada, ainda é uma conexão válida
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          setConnectionTest({
            status: 'success',
            message: 'Conexão estabelecida! (Tabelas ainda não criadas)',
            details: 'O Supabase está conectado, mas as tabelas precisam ser criadas.',
          })
        } else {
          throw error
        }
      } else {
        setConnectionTest({
          status: 'success',
          message: 'Conexão estabelecida com sucesso!',
          details: 'O Supabase está funcionando corretamente.',
        })
      }
    } catch (error: any) {
      setConnectionTest({
        status: 'error',
        message: 'Erro ao conectar',
        details: error.message || 'Erro desconhecido',
      })
    }
  }

  const testTables = async () => {
    if (!isSupabaseConfigured) {
      setTableTest({
        status: 'error',
        message: 'Variáveis de ambiente não configuradas',
      })
      return
    }

    setTableTest({ status: 'testing', message: 'Verificando tabelas...' })

    const tables = [
      'categories',
      'expenses',
      'incomes',
      'investments',
      'assistant_sessions',
      'assistant_commands',
      'assistant_confirmations',
      'assistant_category_mappings',
    ]
    const results: { [key: string]: boolean } = {}

    try {
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1)
          results[table] = !error
        } catch (err) {
          results[table] = false
        }
      }

      const allExist = Object.values(results).every((exists) => exists)
      const missingTables = Object.entries(results)
        .filter(([_, exists]) => !exists)
        .map(([table]) => table)

      if (allExist) {
        setTableTest({
          status: 'success',
          message: 'Todas as tabelas existem!',
          details: `Tabelas verificadas: ${tables.join(', ')}`,
        })
      } else {
        setTableTest({
          status: 'error',
          message: 'Algumas tabelas estão faltando',
          details: `Tabelas faltando: ${missingTables.join(', ')}. Execute o script database.sql no Supabase.`,
        })
      }
    } catch (error: any) {
      setTableTest({
        status: 'error',
        message: 'Erro ao verificar tabelas',
        details: error.message || 'Erro desconhecido',
      })
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'testing':
        return 'border-[var(--color-focus)] bg-tertiary'
      case 'success':
        return 'border-[var(--color-success)] bg-tertiary'
      case 'error':
        return 'border-[var(--color-danger)] bg-tertiary'
      default:
        return 'border-primary bg-secondary'
    }
  }

  const handleInterpretAssistant = async () => {
    if (!assistantText.trim() || !isSupabaseConfigured) return
    await ensureSession()
    const result = await interpret(assistantText.trim())
    await speakText(result.confirmationText)
  }

  const handleConfirmAssistant = async (confirmed: boolean) => {
    if (!lastInterpretation?.command.id || !isSupabaseConfigured) return
    const result = await confirm(lastInterpretation.command.id, confirmed, confirmationSpokenText.trim() || undefined)
    await speakText(result.message)
  }

  const handleInsightsAssistant = async () => {
    if (!isSupabaseConfigured) return
    const insights = await getInsights()
    const speakMessage = [
      `Insights de ${insights.month}.`,
      ...insights.highlights,
      ...insights.recommendations,
    ].join(' ')
    await speakText(speakMessage)
  }

  const speakText = async (text: string) => {
    if (!voiceSupport.synthesis || !text.trim()) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    window.speechSynthesis.speak(utterance)
  }

  const resolveVoiceConfirmation = (spokenText: string) => {
    const normalized = spokenText.trim().toLowerCase()
    if (!normalized) return true

    if (
      normalized.includes('não')
      || normalized.includes('nao')
      || normalized.includes('cancelar')
      || normalized.includes('negar')
    ) {
      return false
    }

    return true
  }

  const getSpeechRecognitionErrorMessage = (errorCode?: string) => {
    const code = (errorCode || '').toLowerCase()

    if (code === 'network') {
      return 'Falha de rede no reconhecimento de voz. Verifique internet ativa, HTTPS e, se persistir, use o comando em texto no campo abaixo.'
    }

    if (code === 'not-allowed' || code === 'service-not-allowed') {
      return 'Permissão de microfone negada. Libere o microfone nas permissões do navegador.'
    }

    if (code === 'no-speech') {
      return 'Nenhuma fala detectada. Fale novamente após tocar no botão.'
    }

    if (code === 'audio-capture') {
      return 'Não foi possível acessar o microfone. Verifique se outro app está usando o áudio.'
    }

    if (code === 'aborted') {
      return 'Captura de voz interrompida. Tente novamente.'
    }

    return 'Erro ao capturar voz. Use o modo de texto como alternativa.'
  }

  const moveToTextFallback = () => {
    assistantInputRef.current?.focus()
    setVoiceStatus((previous) => {
      if (!previous) {
        return 'Fallback ativado: digite o comando no campo de texto e toque em Interpretar.'
      }
      return `${previous} Fallback: use o campo de texto e toque em Interpretar.`
    })
  }

  const captureSpeech = async (prompt?: string): Promise<string> => {
    if (!voiceSupport.recognition) {
      throw new Error('Reconhecimento de voz não suportado neste navegador/dispositivo.')
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('Reconhecimento de voz requer contexto seguro (HTTPS ou localhost).')
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Você está offline. Conecte-se à internet para usar reconhecimento de voz.')
    }

    return new Promise((resolve, reject) => {
      const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new RecognitionCtor()

      recognition.lang = 'pt-BR'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.continuous = false

      setVoiceStatus(prompt || 'Ouvindo...')
      setVoiceListening(true)

      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim() || ''
        setVoiceListening(false)
        setVoiceStatus(transcript ? `Reconhecido: ${transcript}` : 'Nenhuma fala reconhecida.')
        resolve(transcript)
      }

      recognition.onerror = (event: any) => {
        setVoiceListening(false)
        const errorMessage = getSpeechRecognitionErrorMessage(event?.error)
        setVoiceStatus(errorMessage)
        reject(new Error(errorMessage))
      }

      recognition.onend = () => {
        setVoiceListening(false)
      }

      recognition.start()
    })
  }

  const handleVoiceInterpret = async () => {
    if (!isSupabaseConfigured || assistantLoading) return

    try {
      const transcript = await captureSpeech('Fale o comando inicial')
      if (!transcript) return

      setAssistantText(transcript)
      await ensureSession()
      const result = await interpret(transcript)
      await speakText(result.confirmationText)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao interpretar comando por voz.'
      setVoiceStatus(message)
      if (message.toLowerCase().includes('rede') || message.toLowerCase().includes('network')) {
        moveToTextFallback()
      }
    }
  }

  const handleVoiceConfirm = async () => {
    if (!isSupabaseConfigured || assistantLoading || !lastInterpretation?.command.id) return

    try {
      const transcript = await captureSpeech('Confirme por voz')
      if (!transcript) return

      setConfirmationSpokenText(transcript)
      const confirmed = resolveVoiceConfirmation(transcript)
      const result = await confirm(lastInterpretation.command.id, confirmed, transcript)
      await speakText(result.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao confirmar por voz.'
      setVoiceStatus(message)
      if (message.toLowerCase().includes('rede') || message.toLowerCase().includes('network')) {
        moveToTextFallback()
      }
    }
  }

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.settings.title} subtitle={PAGE_HEADERS.settings.description} />
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Aparência</h2>
            <p className="text-secondary text-sm">Personalize tema e paleta de cores da interface</p>
          </div>
          <ThemeSwitcher />
          <ColorPaletteSwitcher />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-primary mb-2">Banco de Dados</h2>
            <p className="text-secondary text-sm">Verifique a conexão com o Supabase</p>
          </div>

          <Card>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-primary mb-2">
                  Status da Configuração
                </h3>
                <div className="flex items-center gap-2 mb-4">
                  {isSupabaseConfigured ? (
                    <>
                      <Check className="text-[var(--color-success)]" size={20} />
                      <span className="text-sm text-primary">
                        Variáveis de ambiente configuradas
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-[var(--color-warning)]" size={20} />
                      <span className="text-sm text-primary">
                        Variáveis de ambiente não configuradas
                      </span>
                    </>
                  )}
                </div>
                {isSupabaseConfigured && (
                  <div className="text-xs text-secondary space-y-1 bg-tertiary p-3 rounded-lg">
                    <p>
                      <strong>URL:</strong>{' '}
                      {import.meta.env.VITE_SUPABASE_URL?.substring(0, 30)}...
                    </p>
                    <p>
                      <strong>Key:</strong>{' '}
                      {import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20)}...
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  {connectionTest.message && (
                    <div
                      className={`p-3 rounded-lg border ${getStatusColor(
                        connectionTest.status
                      )}`}
                    >
                      <p className="text-sm font-medium text-primary mb-1">
                        {connectionTest.message}
                      </p>
                      {connectionTest.details && (
                        <p className="text-xs text-secondary mt-1">
                          {connectionTest.details}
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={testConnection}
                    disabled={connectionTest.status === 'testing'}
                    size="sm"
                    variant="outline"
                    fullWidth
                    className="mt-2"
                  >
                    Testar Conexão
                  </Button>
                </div>

                <div>
                  {tableTest.message && (
                    <div
                      className={`p-3 rounded-lg border ${getStatusColor(
                        tableTest.status
                      )}`}
                    >
                      <p className="text-sm font-medium text-primary mb-1">{tableTest.message}</p>
                      {tableTest.details && (
                        <p className="text-xs text-secondary mt-1">
                          {tableTest.details}
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={testTables}
                    disabled={tableTest.status === 'testing'}
                    size="sm"
                    variant="outline"
                    fullWidth
                    className="mt-2"
                  >
                    Verificar Tabelas
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section id="assistant-mvp" className="space-y-4 scroll-mt-24">
          <div>
            <h2 className="text-xl font-semibold text-primary mb-2">Assistente (MVP)</h2>
            <p className="text-secondary text-sm">Teste o fluxo: interpretar comando, confirmar e executar</p>
          </div>

          <Card>
            <div className="space-y-4">
              <Input
                ref={assistantInputRef}
                label="Comando de voz (texto de teste)"
                value={assistantText}
                onChange={(event) => setAssistantText(event.target.value)}
                placeholder="Ex.: adicionar despesa de 42 almoço"
                disabled={assistantLoading || !isSupabaseConfigured}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={handleInterpretAssistant}
                  disabled={assistantLoading || !assistantText.trim() || !isSupabaseConfigured}
                  variant="outline"
                  fullWidth
                >
                  Interpretar
                </Button>
                <Button
                  onClick={handleInsightsAssistant}
                  disabled={assistantLoading || !isSupabaseConfigured}
                  variant="outline"
                  fullWidth
                >
                  Gerar Insights do Mês
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={handleVoiceInterpret}
                  disabled={assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition || voiceListening}
                  variant="secondary"
                  fullWidth
                >
                  {voiceListening ? 'Ouvindo...' : 'Falar Comando'}
                </Button>
                <Button
                  onClick={handleVoiceConfirm}
                  disabled={
                    assistantLoading
                    || !isSupabaseConfigured
                    || !voiceSupport.recognition
                    || voiceListening
                    || !lastInterpretation?.requiresConfirmation
                    || !lastInterpretation?.command.id
                  }
                  variant="secondary"
                  fullWidth
                >
                  {voiceListening ? 'Ouvindo...' : 'Responder por Voz'}
                </Button>
              </div>

              {!voiceSupport.recognition && (
                <p className="text-xs text-secondary">
                  Reconhecimento de voz indisponível neste navegador. Use Chrome/Edge Android com HTTPS.
                </p>
              )}

              {voiceStatus && (
                <div className="p-3 rounded-lg border border-primary bg-tertiary">
                  <p className="text-xs text-secondary">{voiceStatus}</p>
                </div>
              )}

              {assistantError && (
                <div className="p-3 rounded-lg border border-[var(--color-danger)] bg-tertiary">
                  <p className="text-sm font-medium text-primary">Erro no assistente</p>
                  <p className="text-xs text-secondary mt-1">{assistantError}</p>
                </div>
              )}

              {lastInterpretation && (
                <div className="space-y-3 p-3 rounded-lg border border-primary bg-secondary">
                  <div className="space-y-1">
                    <p className="text-sm text-primary">
                      <strong>Intenção:</strong> {lastInterpretation.intent}
                    </p>
                    <p className="text-sm text-primary">
                      <strong>Confiança:</strong> {(lastInterpretation.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-sm text-primary">
                      <strong>Resumo:</strong> {lastInterpretation.confirmationText}
                    </p>
                  </div>

                  {lastInterpretation.requiresConfirmation && (
                    <div className="space-y-2">
                      <Input
                        label="Texto falado da confirmação"
                        value={confirmationSpokenText}
                        onChange={(event) => setConfirmationSpokenText(event.target.value)}
                        placeholder="confirmar"
                        disabled={assistantLoading || !isSupabaseConfigured}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          onClick={() => handleConfirmAssistant(true)}
                          disabled={assistantLoading || !isSupabaseConfigured}
                          variant="primary"
                          fullWidth
                        >
                          Confirmar
                        </Button>
                        <Button
                          onClick={() => handleConfirmAssistant(false)}
                          disabled={assistantLoading || !isSupabaseConfigured}
                          variant="outline"
                          fullWidth
                        >
                          Negar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {lastConfirmation && (
                <div className="p-3 rounded-lg border border-primary bg-tertiary">
                  <p className="text-sm font-medium text-primary">Resultado da confirmação</p>
                  <p className="text-xs text-secondary mt-1">{lastConfirmation.message}</p>
                </div>
              )}

              {lastInsights && (
                <div className="p-3 rounded-lg border border-primary bg-tertiary space-y-2">
                  <p className="text-sm font-medium text-primary">Insights de {lastInsights.month}</p>
                  <p className="text-xs text-secondary">Destaques:</p>
                  <ul className="space-y-1 text-xs text-secondary list-disc list-inside">
                    {lastInsights.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-secondary pt-1">Recomendações:</p>
                  <ul className="space-y-1 text-xs text-secondary list-disc list-inside">
                    {lastInsights.recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
