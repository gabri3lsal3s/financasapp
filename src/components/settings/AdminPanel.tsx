import SectionHeader from '@/components/SectionHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { ADMIN_EMAIL } from '@/constants/adminProfile'
import { RefreshCw, Loader2, Crown, Trash2 } from 'lucide-react'
import type { Profile } from '@/types'
import type { UseSettingsAdminReturn } from '@/hooks/useSettingsAdmin'

interface AdminPanelProps {
  admin: UseSettingsAdminReturn
  isCurrentSuperAdmin: boolean
}

/**
 * AdminPanel — painel administrativo da página Configurações (extraído de
 * Settings.tsx). Lista usuários com ações de aprovação, bloqueio, recusa e
 * exclusão.
 */
export default function AdminPanel({ admin, isCurrentSuperAdmin }: AdminPanelProps) {
  const {
    allUsers,
    adminLoading,
    fetchUsers,
    handleUpdateUserStatus,
    handleRejectUser,
    openDeleteUserModal,
  } = admin

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Painel administrativo"
        description="Gerencie solicitações de acesso ao sistema"
        className="mb-1"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={adminLoading}
            className="gap-2"
          >
            <RefreshCw size={14} className={adminLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <Card className="animate-stagger-item delay-75 border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-tertiary border border-primary">
              <Crown size={20} className="text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-primary">Super Administrador</h3>
              <p className="text-sm text-secondary mt-0.5">
                Conta principal com acesso total e aprovação de usuários.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <p className="font-medium text-primary break-all">{ADMIN_EMAIL}</p>
                {isCurrentSuperAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-success)]/10 text-[var(--color-success)] flex-shrink-0">
                    Sessão atual
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div>
        <h3 className="text-base font-semibold text-primary mb-1">Usuários do sistema</h3>
        <p className="text-secondary text-sm mb-3">
          Solicitações de acesso e contas cadastradas (exceto o super administrador).
        </p>
      </div>

      <Card className="animate-stagger-item delay-100">
        {adminLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : allUsers.length === 0 ? (
          <div className="text-center py-8 text-secondary">
            Nenhum outro usuário cadastrado. O super administrador é {ADMIN_EMAIL}.
          </div>
        ) : (
          <div className="divide-y divide-primary">
            {allUsers.map((pUser: Profile) => (
              <div key={pUser.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="font-medium text-primary break-all">{pUser.email}</p>
                    <div className="flex-shrink-0">
                      {pUser.is_blocked || pUser.rejection_count >= 2 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-danger)]/10 text-[var(--color-danger)] whitespace-nowrap">
                          Bloqueado
                        </span>
                      ) : pUser.is_rejected ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-warning)]/10 text-[var(--color-warning)] whitespace-nowrap">
                          Recusado ({pUser.rejection_count})
                        </span>
                      ) : pUser.is_approved ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-success)]/10 text-[var(--color-success)] whitespace-nowrap">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-warning)]/10 text-[var(--color-warning)] whitespace-nowrap">
                          Pendente
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-secondary mt-0.5">Entrou em: {new Date(pUser.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-3 sm:mt-0 w-full sm:w-auto flex-shrink-0">
                  {pUser.is_approved ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`flex-1 sm:flex-none justify-center ${pUser.is_blocked || pUser.rejection_count >= 2 ? 'text-[var(--color-success)] border-[var(--color-success)] hover:bg-[var(--color-success)]/10' : 'text-[var(--color-warning)] border-[var(--color-warning)] hover:bg-[var(--color-warning)]/10'}`}
                      onClick={() => handleUpdateUserStatus(pUser.id, true, !(pUser.is_blocked || pUser.rejection_count >= 2))}
                    >
                      {pUser.is_blocked || pUser.rejection_count >= 2 ? 'Desbloquear' : 'Bloquear'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="flex-1 sm:flex-none justify-center"
                      onClick={() => handleUpdateUserStatus(pUser.id, true, false)}
                    >
                      Aprovar
                    </Button>
                  )}
                  {!pUser.is_approved && !pUser.is_blocked && pUser.rejection_count < 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none justify-center text-[var(--color-danger)] border-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                      onClick={() => handleRejectUser(pUser.id, false, pUser.rejection_count)}
                    >
                      Recusar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none justify-center text-expense border-expense/30 hover:bg-expense/10 hover:text-expense hover:border-expense/50 font-bold"
                    onClick={() => openDeleteUserModal(pUser)}
                  >
                    <Trash2 size={14} className="mr-1 shrink-0" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}
