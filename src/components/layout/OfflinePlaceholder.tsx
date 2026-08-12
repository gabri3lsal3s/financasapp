import { useNavigate } from 'react-router-dom'
import { ArrowLeft, WifiOff } from 'lucide-react'

export default function OfflinePlaceholder() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in zoom-in duration-300">
      <div className="bg-tertiary p-6 rounded-full mb-6">
        <WifiOff size={48} className="text-secondary" />
      </div>
      <h2 className="text-2xl font-bold text-primary mb-3">Página Indisponível Offline</h2>
      <p className="text-secondary max-w-md mb-8">
        Esta funcionalidade requer uma conexão com a internet para carregar os dados mais recentes.
        Por favor, conecte-se para acessar esta página.
      </p>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium motion-standard hover-lift-subtle press-subtle bg-primary text-primary-foreground"
      >
        <ArrowLeft size={20} />
        Voltar para o Início
      </button>
    </div>
  )
}
