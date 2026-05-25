import { Profile } from '@/types'
import { isPrimaryAdminProfile } from '@/constants/adminProfile'
import { resolveProfileDisplayName } from '@/utils/profileDisplayName'
import Button from '@/components/Button'
import { ShieldCheck, Trash2 } from 'lucide-react'

interface ClientOverviewHeaderProps {
  selectedClient: Profile
  isTempClient: boolean
  isSelfPortfolio?: boolean
  onDeleteClick: () => void
  onLinkClick: () => void
}

export default function ClientOverviewHeader({
  selectedClient,
  isTempClient,
  isSelfPortfolio = false,
  onDeleteClick,
  onLinkClick,
}: ClientOverviewHeaderProps) {
  const displayName = resolveProfileDisplayName(selectedClient)
  const isClientAdmin = isPrimaryAdminProfile(selectedClient)

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/40 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-sm min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-sm text-primary flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-500 animate-pulse shrink-0" />
            <span className="truncate">{isSelfPortfolio ? 'Minha carteira pessoal' : 'Cliente selecionado'}</span>
          </h3>
          <p className="text-sm font-bold text-primary mt-1 truncate" title={displayName}>{displayName}</p>
          <p className="text-xs text-secondary mt-0.5 font-mono truncate" title={selectedClient.email}>{selectedClient.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {!isClientAdmin && !isSelfPortfolio && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDeleteClick}
              className="text-xs border-red-500/20 text-red-600 hover:bg-red-500/10 dark:hover:text-red-300 font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Trash2 size={13} />
              Excluir Cliente
            </Button>
          )}
        </div>
      </div>

      {isTempClient && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-left animate-page-enter">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Este é um cliente provisório sem e-mail real cadastrado. Você pode vincular esta carteira patrimonial a um e-mail de acesso cadastrado a qualquer momento.</span>
          </div>
          <Button
            size="sm"
            onClick={onLinkClick}
            variant="outline"
            className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 font-bold text-xs self-start sm:self-center py-1.5 px-3.5 shrink-0 transition-all"
          >
            Vincular Conta Real
          </Button>
        </div>
      )}
    </div>
  )
}
