import { Component, ReactNode } from 'react'

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
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary flex items-center justify-center p-4">
          <div className="bg-secondary rounded-lg shadow-lg p-6 max-w-md w-full border border-secondary">
            <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-expense)' }}>
              Erro ao carregar aplicativo
            </h1>
            <p className="text-primary mb-4">
              Ocorreu um erro inesperado. Por favor, verifique o console do navegador para mais detalhes.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-secondary mb-2">
                  Detalhes do erro
                </summary>
                <pre className="text-xs bg-secondary p-3 rounded overflow-auto border border-secondary text-primary">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-accent-primary text-primary py-2 px-4 rounded-lg motion-standard hover-lift-subtle press-subtle hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}





