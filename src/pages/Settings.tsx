import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { PAGE_HEADERS } from '@/constants/pages'
import Button from '@/components/Button'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ColorPaletteSwitcher from '@/components/ColorPaletteSwitcher'
import { useAssistant } from '@/hooks/useAssistant'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useAppSettings } from '@/hooks/useAppSettings'
import { formatMoneyInput, parseMoneyInput } from '@/utils/format'
import type { AssistantResolvedCategory, AssistantSlots } from '@/types'
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
    ensureSession,
    interpret,
    confirm,
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
  const [editableConfirmationText, setEditableConfirmationText] = useState('')
  const [editableSlots, setEditableSlots] = useState<AssistantSlots | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<string>('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'idle' | 'listening' | 'stopped'>('idle')
  const [lastHeardCommand, setLastHeardCommand] = useState('')
  const assistantInputRef = useRef<HTMLInputElement | null>(null)
  const activeRecognitionRef = useRef<any | null>(null)
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { monthlyInsightsEnabled, setMonthlyInsightsEnabled } = useAppSettings()

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
    const spokenText = editableConfirmationText.trim() || undefined
    const editedDescription = editableSlots?.description?.trim() || undefined
    const result = await confirm(lastInterpretation.command.id, confirmed, spokenText, editedDescription, editableSlots || undefined)
    await speakText(result.message)
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

  useEffect(() => {
    if (!lastInterpretation) return
    setEditableConfirmationText(lastInterpretation.confirmationText)
    setEditableSlots(JSON.parse(JSON.stringify(lastInterpretation.slots || {})) as AssistantSlots)
  }, [lastInterpretation])

  const updateEditableSlots = (updater: (previous: AssistantSlots) => AssistantSlots) => {
    setEditableSlots((previous) => {
      const base = previous || {}
      return updater(base)
    })
  }

  const setSlotCategory = (categoryId: string, transactionType: 'expense' | 'income') => {
    const sourceList = transactionType === 'expense' ? categories : incomeCategories
    const selected = sourceList.find((item) => item.id === categoryId)
    if (!selected) return

    const categoryPayload: AssistantResolvedCategory = {
      id: selected.id,
      name: selected.name,
      confidence: 0.99,
      source: 'name_match',
    }

    updateEditableSlots((previous) => ({ ...previous, category: categoryPayload }))
  }

  const setItemCategory = (index: number, categoryId: string, transactionType: 'expense' | 'income') => {
    const sourceList = transactionType === 'expense' ? categories : incomeCategories
    const selected = sourceList.find((item) => item.id === categoryId)
    if (!selected) return

    const categoryPayload: AssistantResolvedCategory = {
      id: selected.id,
      name: selected.name,
      confidence: 0.99,
      source: 'name_match',
    }

    updateEditableSlots((previous) => ({
      ...previous,
      items: (previous.items || []).map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, category: categoryPayload }
          : item
      )),
    }))
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
      let isSettled = false
      let hasHeardSpeech = false
      let transcriptBuffer = ''
      let silenceTimer: ReturnType<typeof setTimeout> | null = null
      let initialSpeechTimer: ReturnType<typeof setTimeout> | null = null

      const scheduleSilenceStop = (delayMs: number) => {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (!isSettled) {
            recognition.stop()
          }
        }, delayMs)
      }

      recognition.lang = 'pt-BR'
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.continuous = false

      setVoiceStatus(prompt || 'Ouvindo...')
      setVoiceListening(true)
      setVoicePhase('listening')
      activeRecognitionRef.current = recognition
      initialSpeechTimer = setTimeout(() => {
        if (!isSettled) {
          setVoiceStatus('Não detectei sua voz ainda. Tente falar mais próximo ao microfone.')
          recognition.stop()
        }
      }, 7000)

      recognition.onspeechstart = () => {
        hasHeardSpeech = true
        if (initialSpeechTimer) {
          clearTimeout(initialSpeechTimer)
          initialSpeechTimer = null
        }
      }

      recognition.onresult = (event: any) => {
        const chunks: string[] = []

        for (let index = 0; index < (event.results?.length || 0); index += 1) {
          const result = event.results[index]
          const chunk = result?.[0]?.transcript?.trim()
          if (chunk) chunks.push(chunk)
        }

        const mergedTranscript = chunks.join(' ').replace(/\s+/g, ' ').trim()

        if (mergedTranscript) {
          hasHeardSpeech = true
          if (initialSpeechTimer) {
            clearTimeout(initialSpeechTimer)
            initialSpeechTimer = null
          }
          transcriptBuffer = mergedTranscript
          setVoiceStatus(`Escutando: ${transcriptBuffer}`)
          scheduleSilenceStop(2500)
        }
      }

      recognition.onspeechend = () => {
        if (!isSettled && hasHeardSpeech) {
          scheduleSilenceStop(1200)
        }
      }

      recognition.onerror = (event: any) => {
        if (isSettled) return
        isSettled = true
        if (silenceTimer) clearTimeout(silenceTimer)
        if (initialSpeechTimer) clearTimeout(initialSpeechTimer)
        setVoiceListening(false)
        setVoicePhase('stopped')
        activeRecognitionRef.current = null

        if (event?.error === 'no-speech') {
          const transcript = transcriptBuffer.trim()
          setLastHeardCommand(transcript)
          if (transcript) {
            setVoiceStatus(`Reconhecido: ${transcript}`)
            resolve(transcript)
            return
          }

          setVoiceStatus('Nenhuma fala detectada. Tente novamente falando logo após tocar no botão.')
          resolve('')
          return
        }

        const errorMessage = getSpeechRecognitionErrorMessage(event?.error)
        setVoiceStatus(errorMessage)
        reject(new Error(errorMessage))
      }

      recognition.onend = () => {
        if (isSettled) return
        isSettled = true
        if (silenceTimer) clearTimeout(silenceTimer)
        if (initialSpeechTimer) clearTimeout(initialSpeechTimer)
        setVoiceListening(false)
        setVoicePhase('stopped')
        activeRecognitionRef.current = null

        const transcript = transcriptBuffer.trim()
        setLastHeardCommand(transcript)
        setVoiceStatus(transcript ? `Reconhecido: ${transcript}` : 'Nenhuma fala reconhecida.')
        resolve(transcript)
      }

      recognition.start()
    })
  }

  const stopActiveListening = () => {
    if (!activeRecognitionRef.current) return
    setVoiceStatus('Finalizando escuta...')
    activeRecognitionRef.current.stop()
  }

  const handleVoiceInterpret = async () => {
    if (!isSupabaseConfigured || assistantLoading) return

    if (voiceListening) {
      stopActiveListening()
      return
    }

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

    if (lastInterpretation.intent === 'add_expense') {
      setVoiceStatus('Para despesas, a confirmação é manual pelos botões Confirmar/Negar.')
      return
    }

    try {
      const transcript = await captureSpeech('Confirme por voz')
      if (!transcript) return

      const confirmed = resolveVoiceConfirmation(transcript)
      const editedDescription = editableSlots?.description?.trim() || undefined
      const result = await confirm(lastInterpretation.command.id, confirmed, transcript, editedDescription, editableSlots || undefined)
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
            <h2 className="text-xl font-semibold text-primary mb-1">Preferências do App</h2>
            <p className="text-secondary text-sm">Controle funcionalidades automáticas do dashboard</p>
          </div>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-primary">Insights personalizados do mês</h3>
                <p className="text-sm text-secondary mt-1">
                  Quando ativado, o assistente analisa o comportamento financeiro do mês e atualiza os insights automaticamente.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={monthlyInsightsEnabled}
                onClick={() => setMonthlyInsightsEnabled(!monthlyInsightsEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border motion-standard focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                  monthlyInsightsEnabled ? 'bg-tertiary border-[var(--color-primary)]' : 'bg-secondary border-primary'
                }`}
                title={monthlyInsightsEnabled ? 'Desativar insights do mês' : 'Ativar insights do mês'}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full motion-standard ${
                    monthlyInsightsEnabled ? 'translate-x-6 bg-[var(--color-primary)]' : 'translate-x-1 bg-[var(--color-text-secondary)]'
                  }`}
                />
              </button>
            </div>
          </Card>
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
            <p className="text-secondary text-sm">Diagnóstico e testes do assistente por voz/texto, com edição completa antes da confirmação</p>
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
                  onClick={handleVoiceInterpret}
                  disabled={assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition}
                  variant="primary"
                  fullWidth
                >
                  {voiceListening ? 'Parar Escuta' : 'Falar Comando'}
                </Button>
                <Button
                  onClick={handleInterpretAssistant}
                  disabled={assistantLoading || !assistantText.trim() || !isSupabaseConfigured}
                  variant="outline"
                  fullWidth
                >
                  Interpretar Texto
                </Button>
              </div>

              {!voiceSupport.recognition && (
                <p className="text-xs text-secondary">
                  Reconhecimento de voz indisponível neste navegador. Use Chrome/Edge Android com HTTPS.
                </p>
              )}

              <div className="p-3 rounded-lg border border-primary bg-secondary space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-secondary">Status de escuta</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${voicePhase === 'listening' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]'}`} />
                  <p className="text-sm text-primary">
                    {voicePhase === 'listening' ? 'Escutando...' : voicePhase === 'stopped' ? 'Parou de escutar' : 'Pronto para iniciar'}
                  </p>
                </div>
                {lastHeardCommand && (
                  <p className="text-sm text-primary">
                    <strong>Comando ouvido:</strong> {lastHeardCommand}
                  </p>
                )}
              </div>

              {voiceStatus && (
                <div className="p-3 rounded-lg border border-primary bg-tertiary">
                  <p className="text-xs text-secondary">{voiceStatus}</p>
                </div>
              )}

              {assistantError && (
                <div className="p-3 rounded-lg border border-[var(--color-danger)] bg-tertiary">
                  <p className="text-sm font-medium text-[var(--color-danger)]">Erro no assistente</p>
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
                    <div className="space-y-3">
                      <div className="rounded-lg border border-primary bg-primary p-3 space-y-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-secondary">Campos editáveis antes do lançamento</p>

                        <Input
                          label="Resumo da confirmação"
                          value={editableConfirmationText}
                          onChange={(event) => setEditableConfirmationText(event.target.value)}
                          disabled={assistantLoading || !isSupabaseConfigured}
                        />

                        {(editableSlots?.items?.length || 0) > 0 ? (
                          <div className="space-y-3">
                            {(editableSlots?.items || []).map((item, index) => {
                              const transactionType = item.transactionType || 'expense'
                              const reportAmount = item.amount > 0 && Number.isFinite(item.report_weight)
                                ? item.amount * Number(item.report_weight)
                                : item.amount

                              return (
                                <div key={`assistant-settings-item-${index}`} className="rounded-md border border-primary bg-tertiary p-3 space-y-2">
                                  <p className="text-xs font-medium text-secondary">Lançamento {index + 1}</p>

                                  <Select
                                    label="Tipo"
                                    value={transactionType}
                                    onChange={(event) => {
                                      const nextType = event.target.value as 'expense' | 'income' | 'investment'
                                      updateEditableSlots((previous) => ({
                                        ...previous,
                                        items: (previous.items || []).map((currentItem, itemIndex) => (
                                          itemIndex === index
                                            ? { ...currentItem, transactionType: nextType }
                                            : currentItem
                                        )),
                                      }))
                                    }}
                                    options={[
                                      { value: 'expense', label: 'Despesa' },
                                      { value: 'income', label: 'Renda' },
                                      { value: 'investment', label: 'Investimento' },
                                    ]}
                                    disabled={assistantLoading || !isSupabaseConfigured}
                                  />

                                  <Input
                                    label="Descrição"
                                    value={item.description || ''}
                                    onChange={(event) => {
                                      const value = event.target.value
                                      updateEditableSlots((previous) => ({
                                        ...previous,
                                        items: (previous.items || []).map((currentItem, itemIndex) => (
                                          itemIndex === index
                                            ? { ...currentItem, description: value }
                                            : currentItem
                                        )),
                                      }))
                                    }}
                                    disabled={assistantLoading || !isSupabaseConfigured}
                                  />

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Input
                                      label="Valor"
                                      type="text"
                                      inputMode="decimal"
                                      value={formatMoneyInput(Number(item.amount || 0))}
                                      onChange={(event) => {
                                        const parsed = parseMoneyInput(event.target.value)
                                        if (Number.isNaN(parsed)) return
                                        updateEditableSlots((previous) => ({
                                          ...previous,
                                          items: (previous.items || []).map((currentItem, itemIndex) => (
                                            itemIndex === index
                                              ? { ...currentItem, amount: parsed }
                                              : currentItem
                                          )),
                                        }))
                                      }}
                                      disabled={assistantLoading || !isSupabaseConfigured}
                                    />

                                    {transactionType !== 'investment' && (
                                      <Input
                                        label="Valor no relatório"
                                        type="text"
                                        inputMode="decimal"
                                        value={formatMoneyInput(Number(reportAmount || 0))}
                                        onChange={(event) => {
                                          const parsed = parseMoneyInput(event.target.value)
                                          if (Number.isNaN(parsed) || !item.amount || item.amount <= 0) return
                                          const reportWeight = Math.min(1, Math.max(0, Number((parsed / item.amount).toFixed(4))))
                                          updateEditableSlots((previous) => ({
                                            ...previous,
                                            items: (previous.items || []).map((currentItem, itemIndex) => (
                                              itemIndex === index
                                                ? { ...currentItem, report_weight: reportWeight }
                                                : currentItem
                                            )),
                                          }))
                                        }}
                                        disabled={assistantLoading || !isSupabaseConfigured}
                                      />
                                    )}
                                  </div>

                                  {transactionType === 'expense' && (
                                    <Select
                                      label="Categoria"
                                      value={item.category?.id || ''}
                                      onChange={(event) => setItemCategory(index, event.target.value, 'expense')}
                                      options={[{ value: '', label: 'Selecionar categoria' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
                                      disabled={assistantLoading || !isSupabaseConfigured}
                                    />
                                  )}

                                  {transactionType === 'income' && (
                                    <Select
                                      label="Categoria de renda"
                                      value={item.category?.id || ''}
                                      onChange={(event) => setItemCategory(index, event.target.value, 'income')}
                                      options={[{ value: '', label: 'Selecionar categoria' }, ...incomeCategories.map((category) => ({ value: category.id, label: category.name }))]}
                                      disabled={assistantLoading || !isSupabaseConfigured}
                                    />
                                  )}

                                  {transactionType === 'investment' ? (
                                    <Input
                                      label="Mês"
                                      type="month"
                                      value={item.month || editableSlots?.month || ''}
                                      onChange={(event) => {
                                        const value = event.target.value
                                        updateEditableSlots((previous) => ({
                                          ...previous,
                                          items: (previous.items || []).map((currentItem, itemIndex) => (
                                            itemIndex === index
                                              ? { ...currentItem, month: value }
                                              : currentItem
                                          )),
                                        }))
                                      }}
                                      disabled={assistantLoading || !isSupabaseConfigured}
                                    />
                                  ) : (
                                    <Input
                                      label="Data"
                                      type="date"
                                      value={item.date || editableSlots?.date || ''}
                                      onChange={(event) => {
                                        const value = event.target.value
                                        updateEditableSlots((previous) => ({
                                          ...previous,
                                          items: (previous.items || []).map((currentItem, itemIndex) => (
                                            itemIndex === index
                                              ? { ...currentItem, date: value }
                                              : currentItem
                                          )),
                                        }))
                                      }}
                                      disabled={assistantLoading || !isSupabaseConfigured}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <>
                            <Input
                              label="Descrição"
                              value={editableSlots?.description || ''}
                              onChange={(event) => updateEditableSlots((previous) => ({ ...previous, description: event.target.value }))}
                              disabled={assistantLoading || !isSupabaseConfigured}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                label="Valor"
                                type="text"
                                inputMode="decimal"
                                value={formatMoneyInput(Number(editableSlots?.amount || 0))}
                                onChange={(event) => {
                                  const parsed = parseMoneyInput(event.target.value)
                                  if (Number.isNaN(parsed)) return
                                  updateEditableSlots((previous) => ({ ...previous, amount: parsed }))
                                }}
                                disabled={assistantLoading || !isSupabaseConfigured}
                              />

                              {lastInterpretation.intent === 'add_investment' ? (
                                <Input
                                  label="Mês"
                                  type="month"
                                  value={editableSlots?.month || ''}
                                  onChange={(event) => updateEditableSlots((previous) => ({ ...previous, month: event.target.value }))}
                                  disabled={assistantLoading || !isSupabaseConfigured}
                                />
                              ) : (
                                <Input
                                  label="Data"
                                  type="date"
                                  value={editableSlots?.date || ''}
                                  onChange={(event) => updateEditableSlots((previous) => ({ ...previous, date: event.target.value }))}
                                  disabled={assistantLoading || !isSupabaseConfigured}
                                />
                              )}
                            </div>

                            {lastInterpretation.intent === 'add_expense' && (
                              <Select
                                label="Categoria"
                                value={editableSlots?.category?.id || ''}
                                onChange={(event) => setSlotCategory(event.target.value, 'expense')}
                                options={[{ value: '', label: 'Selecionar categoria' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
                                disabled={assistantLoading || !isSupabaseConfigured}
                              />
                            )}

                            {lastInterpretation.intent === 'add_income' && (
                              <Select
                                label="Categoria de renda"
                                value={editableSlots?.category?.id || ''}
                                onChange={(event) => setSlotCategory(event.target.value, 'income')}
                                options={[{ value: '', label: 'Selecionar categoria' }, ...incomeCategories.map((category) => ({ value: category.id, label: category.name }))]}
                                disabled={assistantLoading || !isSupabaseConfigured}
                              />
                            )}
                          </>
                        )}
                      </div>

                      <div className={`grid grid-cols-1 gap-2 ${lastInterpretation.intent === 'add_expense' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
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

                        {lastInterpretation.intent !== 'add_expense' && (
                          <Button
                            onClick={handleVoiceConfirm}
                            disabled={
                              assistantLoading
                              || !isSupabaseConfigured
                              || !voiceSupport.recognition
                              || voiceListening
                              || !lastInterpretation?.command.id
                            }
                            variant="outline"
                            fullWidth
                          >
                            {voiceListening ? 'Ouvindo...' : 'Confirmar por Voz'}
                          </Button>
                        )}
                      </div>

                      {lastInterpretation.intent === 'add_expense' && (
                        <p className="text-xs text-secondary">Para despesas, a confirmação é manual pelos botões acima.</p>
                      )}
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

            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
