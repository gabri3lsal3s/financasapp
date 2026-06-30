import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '@/utils/logger'
import Button from '@/components/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary flex items-center justify-center p-4">
          <div className="bg-secondary rounded-xl shadow-lg p-8 max-w-md w-full border border-glass surface-glass flex flex-col items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-expense/10 flex items-center justify-center">
              <AlertTriangle size={28} className="text-expense" />
            </div>
            
            <div className="text-center space-y-2">
              <h1 className="text-lg font-bold text-primary">
                Algo deu errado
              </h1>
              <p className="text-sm text-secondary leading-relaxed">
                Ocorreu um erro inesperado. Tente recarregar a página ou verifique o console do navegador para mais detalhes.
              </p>
            </div>

            {this.state.error && (
              <details className="w-full">
                <summary className="cursor-pointer text-xs font-bold text-secondary hover:text-primary transition-colors text-center uppercase tracking-wider">
                  Detalhes do erro
                </summary>
                <pre className="text-[10px] bg-tertiary p-3 rounded-xl overflow-auto border border-glass text-primary mt-2 max-h-40">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="font-bold flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Recarregar página
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
