import Card from './Card'
import { AlertCircle } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function SupabaseWarning() {
  if (isSupabaseConfigured) return null

  return (
    <div className="max-w-md mx-auto p-4">
      <Card className="bg-secondary border-primary">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="font-semibold text-primary mb-1">
              Configuração do Supabase necessária
            </h3>
            <p className="text-sm text-secondary mb-2">
              Para usar o aplicativo, configure as variáveis de ambiente do Supabase no arquivo <code className="bg-tertiary text-primary px-1 rounded">.env</code>
            </p>
            <div className="text-xs text-secondary space-y-1">
              <p><strong>VITE_SUPABASE_URL</strong>=https://seu-projeto.supabase.co</p>
              <p><strong>VITE_SUPABASE_ANON_KEY</strong>=sua-chave-anon</p>
            </div>
            <p className="text-xs text-secondary mt-2">
              Execute o script <code className="bg-tertiary text-primary px-1 rounded">database.sql</code> no Supabase SQL Editor.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

