import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { PAGE_HEADERS } from '@/constants/pages'
import Button from '@/components/Button'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ColorPaletteSwitcher from '@/components/ColorPaletteSwitcher'
import { AlertCircle, Check } from 'lucide-react'

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
  details?: any
}

export default function Settings() {
  const [connectionTest, setConnectionTest] = useState<TestResult>({
    status: 'idle',
    message: '',
  })
  const [tableTest, setTableTest] = useState<TestResult>({
    status: 'idle',
    message: '',
  })

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

    const tables = ['categories', 'expenses', 'incomes', 'investments']
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
        return 'border-[var(--color-focus)] bg-[var(--color-hover)]'
      case 'success':
        return 'border-green-600 bg-[var(--color-hover)]'
      case 'error':
        return 'border-red-600 bg-[var(--color-hover)]'
      default:
        return 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
    }
  }

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.settings.title} subtitle={PAGE_HEADERS.settings.description} />
      <div className="p-4 lg:p-6 space-y-8">
        {/* Theme Switcher */}
        <section>
          <ThemeSwitcher />
        </section>

        {/* Color Palette Switcher */}
        <section>
          <ColorPaletteSwitcher />
        </section>

        {/* Supabase Configuration */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Banco de Dados</h2>
            <p className="text-[var(--color-text-secondary)] text-sm">Verifique a conexão com o Supabase</p>
          </div>

          <Card>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                  Status da Configuração
                </h3>
                <div className="flex items-center gap-2 mb-4">
                  {isSupabaseConfigured ? (
                    <>
                      <Check className="text-green-600" size={20} />
                      <span className="text-sm text-[var(--color-text-primary)]">
                        Variáveis de ambiente configuradas
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-yellow-600" size={20} />
                      <span className="text-sm text-[var(--color-text-primary)]">
                        Variáveis de ambiente não configuradas
                      </span>
                    </>
                  )}
                </div>
                {isSupabaseConfigured && (
                  <div className="text-xs text-[var(--color-text-secondary)] space-y-1 bg-[var(--color-hover)] p-3 rounded-lg">
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
                      <p className="text-sm font-medium mb-1">
                        {connectionTest.message}
                      </p>
                      {connectionTest.details && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
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
                      <p className="text-sm font-medium mb-1">{tableTest.message}</p>
                      {tableTest.details && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
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
