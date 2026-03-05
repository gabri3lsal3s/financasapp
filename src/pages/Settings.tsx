import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { PAGE_HEADERS } from '@/constants/pages'
import Button from '@/components/Button'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ColorPaletteSwitcher from '@/components/ColorPaletteSwitcher'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useAssistantTelemetry } from '@/hooks/useAssistantTelemetry'
import { useAssistantMemory } from '@/hooks/useAssistantMemory'
import { useAssistantContextDecisionLogs } from '@/hooks/useAssistantContextDecisionLogs'
import { getAssistantPrivacyCleanupLastRun, runAssistantPrivacyCleanup } from '@/utils/assistantPrivacy'
import { AlertCircle, Bot, Check, ChevronDown, SlidersHorizontal, Sparkles, Wrench } from 'lucide-react'

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
  details?: any
}

type SettingsView = 'appearance' | 'assistant' | 'personalization' | 'diagnostics'

const parseSettingsView = (value: string | null): SettingsView => {
  if (value === 'appearance' || value === 'assistant' || value === 'personalization' || value === 'diagnostics') {
    return value
  }
  return 'appearance'
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSettingsView = parseSettingsView(searchParams.get('view'))
  const [connectionTest, setConnectionTest] = useState<TestResult>({
    status: 'idle',
    message: '',
  })
  const [tableTest, setTableTest] = useState<TestResult>({
    status: 'idle',
    message: '',
  })
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const {
    monthlyInsightsEnabled,
    setMonthlyInsightsEnabled,
    assistantConfirmationMode,
    setAssistantConfirmationMode,
    assistantConfirmationPolicyMode,
    setAssistantConfirmationPolicyMode,
    assistantDataRetentionDays,
    setAssistantDataRetentionDays,
    assistantLocale,
    setAssistantLocale,
    assistantOfflineBehavior,
    setAssistantOfflineBehavior,
    assistantResponseDepth,
    setAssistantResponseDepth,
    assistantAutoSpeak,
    setAssistantAutoSpeak,
    assistantSpeechRate,
    setAssistantSpeechRate,
    assistantSpeechPitch,
    setAssistantSpeechPitch,
    floatingCalculatorEnabled,
    setFloatingCalculatorEnabled,
  } = useAppSettings()
  const {
    summary: telemetrySummary,
    weeklySummary: telemetryWeeklySummary,
    trend: telemetryTrend,
    events: telemetryEvents,
    sourceFilter: telemetrySourceFilter,
    setSourceFilter: setTelemetrySourceFilter,
    clearTelemetry,
  } = useAssistantTelemetry()
  const {
    entries: assistantMemoryEntries,
    createEntry: createAssistantMemoryEntry,
    updateEntry: updateAssistantMemoryEntry,
    deleteEntry: deleteAssistantMemoryEntry,
    clearEntries: clearAssistantMemoryEntries,
  } = useAssistantMemory()
  const { logs: assistantContextDecisionLogs, clearLogs: clearAssistantContextDecisionLogs } = useAssistantContextDecisionLogs()
  const [newMemoryKeyword, setNewMemoryKeyword] = useState('')
  const [newMemoryType, setNewMemoryType] = useState<'expense' | 'income'>('expense')
  const [newMemoryCategoryId, setNewMemoryCategoryId] = useState('')
  const [privacyCleanupSummary, setPrivacyCleanupSummary] = useState(() => getAssistantPrivacyCleanupLastRun())
  const [isAssistantMemoryExpanded, setIsAssistantMemoryExpanded] = useState(false)
  const [isAssistantLogsExpanded, setIsAssistantLogsExpanded] = useState(false)

  const formatTrend = (value: number, suffix: string) => {
    const signal = value > 0 ? '+' : ''
    return `${signal}${value}${suffix}`
  }
  const updateSettingsView = (view: SettingsView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams, { replace: true })
  }

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

  const availableMemoryCategories = newMemoryType === 'expense'
    ? categories.map((category) => ({ id: category.id, name: category.name }))
    : incomeCategories.map((category) => ({ id: category.id, name: category.name }))

  const handleAddMemoryEntry = () => {
    const selected = availableMemoryCategories.find((item) => item.id === newMemoryCategoryId)
    if (!selected || !newMemoryKeyword.trim()) return

    createAssistantMemoryEntry({
      keyword: newMemoryKeyword.trim(),
      transactionType: newMemoryType,
      categoryId: selected.id,
      categoryName: selected.name,
    })

    setNewMemoryKeyword('')
    setNewMemoryCategoryId('')
  }

  const handleRunPrivacyCleanup = () => {
    const summary = runAssistantPrivacyCleanup(assistantDataRetentionDays)
    if (!summary) return
    setPrivacyCleanupSummary(getAssistantPrivacyCleanupLastRun())
  }

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.settings.title} subtitle={PAGE_HEADERS.settings.description} />
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <Card>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-secondary">Navegação de configurações</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={activeSettingsView === 'appearance' ? 'primary' : 'outline'}
                onClick={() => updateSettingsView('appearance')}
                className="w-full justify-start"
              >
                <Sparkles size={16} className="mr-2" /> Aparência
              </Button>
              <Button
                type="button"
                variant={activeSettingsView === 'assistant' ? 'primary' : 'outline'}
                onClick={() => updateSettingsView('assistant')}
                className="w-full justify-start"
              >
                <Bot size={16} className="mr-2" /> Assistente
              </Button>
              <Button
                type="button"
                variant={activeSettingsView === 'personalization' ? 'primary' : 'outline'}
                onClick={() => updateSettingsView('personalization')}
                className="w-full justify-start"
              >
                <SlidersHorizontal size={16} className="mr-2" /> Personalização
              </Button>
              <Button
                type="button"
                variant={activeSettingsView === 'diagnostics' ? 'primary' : 'outline'}
                onClick={() => updateSettingsView('diagnostics')}
                className="w-full justify-start"
              >
                <Wrench size={16} className="mr-2" /> Diagnóstico
              </Button>
            </div>
          </div>
        </Card>

        <section className={activeSettingsView === 'appearance' ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Aparência</h2>
            <p className="text-secondary text-sm">Personalize tema e paleta de cores da interface</p>
          </div>
          <ThemeSwitcher />
          <ColorPaletteSwitcher />
        </section>

        <section className={activeSettingsView === 'personalization' ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Personalização</h2>
            <p className="text-secondary text-sm">Ajuste preferências de experiência, voz e recursos visuais rápidos</p>
          </div>

          <Card>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
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
                  className={`relative inline-flex h-7 w-12 items-center rounded-full border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
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

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-base font-semibold text-primary">Calculadora flutuante</h3>
                  <p className="text-sm text-secondary mt-1">
                    Exibe o botão/calculadora flutuante nas páginas para cálculos rápidos.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={floatingCalculatorEnabled}
                  onClick={() => setFloatingCalculatorEnabled(!floatingCalculatorEnabled)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                    floatingCalculatorEnabled ? 'bg-tertiary border-[var(--color-primary)]' : 'bg-secondary border-primary'
                  }`}
                  title={floatingCalculatorEnabled ? 'Desativar calculadora flutuante' : 'Ativar calculadora flutuante'}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full motion-standard ${
                      floatingCalculatorEnabled ? 'translate-x-6 bg-[var(--color-primary)]' : 'translate-x-1 bg-[var(--color-text-secondary)]'
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-lg border border-primary bg-secondary p-3 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Voz do assistente</h3>
                  <p className="text-xs text-secondary mt-1">Personalize como o assistente fala nas respostas.</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm text-primary">Resposta por voz automática</p>
                    <p className="text-xs text-secondary mt-1">Desative para manter o assistente apenas em texto.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={assistantAutoSpeak}
                    onClick={() => setAssistantAutoSpeak(!assistantAutoSpeak)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                      assistantAutoSpeak ? 'bg-tertiary border-[var(--color-primary)]' : 'bg-secondary border-primary'
                    }`}
                    title={assistantAutoSpeak ? 'Desativar resposta por voz' : 'Ativar resposta por voz'}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full motion-standard ${
                        assistantAutoSpeak ? 'translate-x-6 bg-[var(--color-primary)]' : 'translate-x-1 bg-[var(--color-text-secondary)]'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    label="Velocidade da voz"
                    value={assistantSpeechRate}
                    onChange={(event) => setAssistantSpeechRate(event.target.value as 'slow' | 'normal' | 'fast')}
                    options={[
                      { value: 'slow', label: 'Lenta' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'fast', label: 'Rápida' },
                    ]}
                  />

                  <Select
                    label="Tom da voz"
                    value={assistantSpeechPitch}
                    onChange={(event) => setAssistantSpeechPitch(event.target.value as 'low' | 'normal' | 'high')}
                    options={[
                      { value: 'low', label: 'Grave' },
                      { value: 'normal', label: 'Neutro' },
                      { value: 'high', label: 'Agudo' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className={activeSettingsView === 'assistant' ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Assistente</h2>
            <p className="text-secondary text-sm">Ajuste confirmação, comportamento, retenção e contexto inteligente</p>
          </div>

          <Card>
            <div className="space-y-4">
              <div className="rounded-lg border border-primary bg-secondary p-3 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Comportamento e confirmação</h3>
                  <p className="text-xs text-secondary mt-1">Defina como o assistente confirma ações e responde no fluxo principal.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    label="Método de confirmação do assistente"
                    value={assistantConfirmationMode}
                    onChange={(event) => setAssistantConfirmationMode(event.target.value as 'both' | 'touch' | 'voice')}
                    options={[
                      { value: 'both', label: 'Voz + Botões' },
                      { value: 'touch', label: 'Somente botões' },
                      { value: 'voice', label: 'Somente voz (exceto despesas)' },
                    ]}
                  />

                  <Select
                    label="Política de confirmação"
                    value={assistantConfirmationPolicyMode}
                    onChange={(event) => setAssistantConfirmationPolicyMode(event.target.value as 'write_only' | 'always' | 'never')}
                    options={[
                      { value: 'write_only', label: 'Somente escritas (padrão)' },
                      { value: 'always', label: 'Sempre confirmar' },
                      { value: 'never', label: 'Mínima (sensíveis sempre confirmam)' },
                    ]}
                  />

                  <Select
                    label="Comportamento offline do assistente"
                    value={assistantOfflineBehavior}
                    onChange={(event) => setAssistantOfflineBehavior(event.target.value as 'write_fallback' | 'strict_online')}
                    options={[
                      { value: 'write_fallback', label: 'Priorizar cadastro offline (fila)' },
                      { value: 'strict_online', label: 'Modo online estrito' },
                    ]}
                  />

                  <Select
                    label="Profundidade de resposta"
                    value={assistantResponseDepth}
                    onChange={(event) => setAssistantResponseDepth(event.target.value as 'concise' | 'consultive')}
                    options={[
                      { value: 'concise', label: 'Concisa' },
                      { value: 'consultive', label: 'Consultiva' },
                    ]}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-primary bg-secondary p-3 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Idioma e retenção</h3>
                  <p className="text-xs text-secondary mt-1">Controle idioma e janela de retenção local dos dados do assistente.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    label="Idioma do assistente"
                    value={assistantLocale}
                    onChange={(event) => setAssistantLocale(event.target.value as 'pt-BR')}
                    options={[
                      { value: 'pt-BR', label: 'Português (Brasil)' },
                    ]}
                  />

                  <Select
                    label="Retenção local de dados do assistente"
                    value={String(assistantDataRetentionDays)}
                    onChange={(event) => setAssistantDataRetentionDays(Number(event.target.value) as 7 | 30 | 90 | 180 | 365)}
                    options={[
                      { value: '7', label: '7 dias' },
                      { value: '30', label: '30 dias' },
                      { value: '90', label: '90 dias (padrão)' },
                      { value: '180', label: '180 dias' },
                      { value: '365', label: '365 dias' },
                    ]}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-primary bg-secondary p-3 space-y-2">
                <p className="text-xs text-secondary">
                  Limpeza automática aplicada na inicialização do app e ao alterar a retenção. Metadados de voz pendentes são anonimizados localmente.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs text-secondary">
                    Última limpeza: {privacyCleanupSummary?.timestamp
                      ? new Date(privacyCleanupSummary.timestamp).toLocaleString('pt-BR')
                      : 'nenhuma execução ainda'}
                  </p>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRunPrivacyCleanup}
                  >
                    Executar limpeza agora
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-primary">Memória longa do assistente</h3>
                  <p className="text-xs text-secondary mt-1">Edite preferências aprendidas para melhorar a desambiguação futura.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAssistantMemoryExpanded(!isAssistantMemoryExpanded)}
                    aria-expanded={isAssistantMemoryExpanded}
                  >
                    {isAssistantMemoryExpanded ? 'Recolher' : 'Expandir'}
                    <ChevronDown
                      size={16}
                      className={`ml-1 motion-standard ${isAssistantMemoryExpanded ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={clearAssistantMemoryEntries}
                    disabled={assistantMemoryEntries.length === 0}
                  >
                    Limpar memória
                  </Button>
                </div>
              </div>

              {isAssistantMemoryExpanded && (
                <>
                  <div className="rounded-lg border border-primary bg-secondary p-3 space-y-3">
                    <Input
                      label="Palavra-chave / descrição"
                      value={newMemoryKeyword}
                      onChange={(event) => setNewMemoryKeyword(event.target.value)}
                      placeholder="Ex.: mercado"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        label="Tipo"
                        value={newMemoryType}
                        onChange={(event) => {
                          setNewMemoryType(event.target.value as 'expense' | 'income')
                          setNewMemoryCategoryId('')
                        }}
                        options={[
                          { value: 'expense', label: 'Despesa' },
                          { value: 'income', label: 'Renda' },
                        ]}
                      />

                      <Select
                        label="Categoria"
                        value={newMemoryCategoryId}
                        onChange={(event) => setNewMemoryCategoryId(event.target.value)}
                        options={[
                          { value: '', label: 'Selecione' },
                          ...availableMemoryCategories.map((item) => ({ value: item.id, label: item.name })),
                        ]}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddMemoryEntry}
                      disabled={!newMemoryKeyword.trim() || !newMemoryCategoryId}
                    >
                      Adicionar memória
                    </Button>
                  </div>

                  {assistantMemoryEntries.length === 0 ? (
                    <p className="text-xs text-secondary">Nenhuma memória registrada ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {assistantMemoryEntries.map((entry) => {
                        const typeOptions = entry.transactionType === 'expense'
                          ? categories.map((category) => ({ id: category.id, name: category.name }))
                          : incomeCategories.map((category) => ({ id: category.id, name: category.name }))

                        return (
                          <div key={entry.id} className="rounded-lg border border-primary bg-secondary p-3 space-y-2">
                            <Input
                              label="Palavra-chave"
                              value={entry.keyword}
                              onChange={(event) => {
                                updateAssistantMemoryEntry(entry.id, { keyword: event.target.value })
                              }}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Select
                                label="Tipo"
                                value={entry.transactionType}
                                onChange={(event) => {
                                  const nextType = event.target.value as 'expense' | 'income'
                                  const nextTypeOptions = nextType === 'expense'
                                    ? categories.map((category) => ({ id: category.id, name: category.name }))
                                    : incomeCategories.map((category) => ({ id: category.id, name: category.name }))
                                  const fallbackCategory = nextTypeOptions[0]
                                  if (!fallbackCategory) return

                                  updateAssistantMemoryEntry(entry.id, {
                                    transactionType: nextType,
                                    categoryId: fallbackCategory.id,
                                    categoryName: fallbackCategory.name,
                                  })
                                }}
                                options={[
                                  { value: 'expense', label: 'Despesa' },
                                  { value: 'income', label: 'Renda' },
                                ]}
                              />

                              <Select
                                label="Categoria"
                                value={entry.categoryId}
                                onChange={(event) => {
                                  const selected = typeOptions.find((item) => item.id === event.target.value)
                                  if (!selected) return
                                  updateAssistantMemoryEntry(entry.id, {
                                    categoryId: selected.id,
                                    categoryName: selected.name,
                                  })
                                }}
                                options={[
                                  { value: '', label: 'Selecione' },
                                  ...typeOptions.map((item) => ({ value: item.id, label: item.name })),
                                ]}
                              />
                            </div>

                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => deleteAssistantMemoryEntry(entry.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-primary">Logs técnicos de contexto</h3>
                  <p className="text-xs text-secondary mt-1">Auditoria da decisão de categoria com prioridade comando &gt; sessão &gt; memória.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAssistantLogsExpanded(!isAssistantLogsExpanded)}
                    aria-expanded={isAssistantLogsExpanded}
                  >
                    {isAssistantLogsExpanded ? 'Recolher' : 'Expandir'}
                    <ChevronDown
                      size={16}
                      className={`ml-1 motion-standard ${isAssistantLogsExpanded ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={clearAssistantContextDecisionLogs}
                    disabled={assistantContextDecisionLogs.length === 0}
                  >
                    Limpar logs
                  </Button>
                </div>
              </div>

              {isAssistantLogsExpanded && (
                <>
                  {assistantContextDecisionLogs.length === 0 ? (
                    <p className="text-xs text-secondary">Nenhum log de decisão registrado ainda.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {assistantContextDecisionLogs.slice(0, 20).map((log) => (
                        <div key={log.id} className="rounded-lg border border-primary bg-secondary p-3">
                          <p className="text-sm text-primary">
                            <strong>Fonte:</strong> {log.source} · <strong>Intenção:</strong> {log.intent}
                          </p>
                          <p className="text-xs text-secondary mt-1">{log.reason}</p>
                          <p className="text-xs text-secondary mt-1">
                            {new Date(log.createdAt).toLocaleString('pt-BR')} · comando: {String(log.hadCommandCategory)} · sessão: {String(log.hadSessionPreference)} · memória: {String(log.hadMemoryMatch)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </section>

        <section className={activeSettingsView === 'diagnostics' ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Métricas do Assistente</h2>
            <p className="text-secondary text-sm">Acompanhe desempenho recente de interpretação e confirmação</p>
          </div>

          <Card>
            <div className="space-y-4">
              <Select
                label="Origem das métricas"
                value={telemetrySourceFilter}
                onChange={(event) => setTelemetrySourceFilter(event.target.value as 'all' | 'dashboard' | 'settings')}
                options={[
                  { value: 'all', label: 'Geral (todas as origens)' },
                  { value: 'dashboard', label: 'Somente Dashboard' },
                  { value: 'settings', label: 'Somente Configurações' },
                ]}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-primary bg-secondary p-3">
                  <p className="text-xs uppercase tracking-wide text-secondary">Acurácia interpretação</p>
                  <p className="text-lg font-semibold text-primary mt-1">{telemetrySummary.interpretAccuracy}%</p>
                </div>

                <div className="rounded-lg border border-primary bg-secondary p-3">
                  <p className="text-xs uppercase tracking-wide text-secondary">Taxa de execução</p>
                  <p className="text-lg font-semibold text-primary mt-1">{telemetrySummary.executionRate}%</p>
                </div>

                <div className="rounded-lg border border-primary bg-secondary p-3">
                  <p className="text-xs uppercase tracking-wide text-secondary">Latência média</p>
                  <p className="text-lg font-semibold text-primary mt-1">{telemetrySummary.averageDurationMs} ms</p>
                </div>

                <div className="rounded-lg border border-primary bg-secondary p-3">
                  <p className="text-xs uppercase tracking-wide text-secondary">Eventos registrados</p>
                  <p className="text-lg font-semibold text-primary mt-1">{telemetrySummary.totalEvents}</p>
                </div>
              </div>

              <div className="rounded-lg border border-primary bg-secondary p-3">
                <p className="text-xs uppercase tracking-wide text-secondary">Últimos 7 dias</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <p className="text-sm text-primary">
                    <strong>Acurácia:</strong> {telemetryWeeklySummary.interpretAccuracy}%
                  </p>
                  <p className="text-sm text-primary">
                    <strong>Execução:</strong> {telemetryWeeklySummary.executionRate}%
                  </p>
                  <p className="text-sm text-primary">
                    <strong>Latência:</strong> {telemetryWeeklySummary.averageDurationMs} ms
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-primary">
                  <p className="text-sm text-primary">
                    <strong>Tendência acurácia:</strong>{' '}
                    <span className={telemetryTrend.interpretAccuracyDelta >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                      {formatTrend(telemetryTrend.interpretAccuracyDelta, '%')}
                    </span>
                  </p>
                  <p className="text-sm text-primary">
                    <strong>Tendência execução:</strong>{' '}
                    <span className={telemetryTrend.executionRateDelta >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                      {formatTrend(telemetryTrend.executionRateDelta, '%')}
                    </span>
                  </p>
                  <p className="text-sm text-primary">
                    <strong>Tendência latência:</strong>{' '}
                    <span className={telemetryTrend.averageDurationDeltaMs <= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                      {formatTrend(telemetryTrend.averageDurationDeltaMs, ' ms')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs text-secondary">
                  Último evento: {telemetryEvents.length > 0
                    ? new Date(telemetryEvents[telemetryEvents.length - 1].timestamp).toLocaleString('pt-BR')
                    : 'nenhum registro ainda'}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearTelemetry}
                  disabled={telemetrySummary.totalEvents === 0}
                >
                  Limpar métricas locais
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className={activeSettingsView === 'diagnostics' ? 'space-y-4' : 'hidden'}>
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

      </div>
    </div>
  )
}
