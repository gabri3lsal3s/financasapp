import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageHeader from './PageHeader'
import Card from './Card'
import Button from './Button'
import { CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react'

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
  details?: any
}

export default function SupabaseTest() {
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

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'testing':
        return <Loader className="animate-spin text-blue-600" size={20} />
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />
      case 'error':
        return <XCircle className="text-red-600" size={20} />
      default:
        return null
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'testing':
        return 'border-blue-200 bg-blue-50'
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-secondary bg-secondary'
    }
  }

  return (
    <div>
      <PageHeader title="Teste do Supabase" subtitle="Verifique a conexão e configuração" />
      <div className="p-4 space-y-4">
        <Card>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">
              Status da Configuração
            </h3>
            <div className="flex items-center gap-2 mb-4">
              {isSupabaseConfigured ? (
                <>
                  <CheckCircle className="text-green-600" size={20} />
                  <span className="text-sm text-primary">
                    Variáveis de ambiente configuradas
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="text-yellow-600" size={20} />
                  <span className="text-sm text-primary">
                    Variáveis de ambiente não configuradas
                  </span>
                </>
              )}
            </div>
            {isSupabaseConfigured && (
              <div className="text-xs text-secondary space-y-1">
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">
                  Teste de Conexão
                </span>
                {getStatusIcon(connectionTest.status)}
              </div>
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
                fullWidth
                className="mt-2"
              >
                Testar Conexão
              </Button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">
                  Verificar Tabelas
                </span>
                {getStatusIcon(tableTest.status)}
              </div>
              {tableTest.message && (
                <div
                  className={`p-3 rounded-lg border ${getStatusColor(
                    tableTest.status
                  )}`}
                >
                  <p className="text-sm font-medium mb-1">{tableTest.message}</p>
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
      </div>
    </div>
  )
}

