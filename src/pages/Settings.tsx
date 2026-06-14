import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import SectionHeader from '@/components/SectionHeader'
import Card from '@/components/Card'
import { PAGE_HEADERS } from '@/constants/pages'
import Button from '@/components/Button'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import { useAppSettings, type BiometricLockTimeout } from '@/hooks/useAppSettings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PROFILE_SELECT_COLUMNS } from '@/constants/profileSelect'
import { ADMIN_EMAIL, isPrimaryAdminEmail, isPrimaryAdminProfile } from '@/constants/adminProfile'
import { getErrorMessage } from '@/utils/errorMessage'
import type { Profile } from '@/types'
import {
  isBiometricAvailable,
  isBiometricRegistered,
  registerBiometric,
  removeBiometricCredential,
} from '@/utils/biometric'
import { ShieldCheck, Loader2, Users, RefreshCw, Fingerprint, Sparkles, AlertTriangle, Trash2, Crown } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ConfirmModal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Switch from '@/components/Switch'
import AccentToneSwitcher from '@/components/AccentToneSwitcher'


type SettingsView = 'appearance' | 'security' | 'admin'

const parseSettingsView = (value: string | null, isAdmin: boolean): SettingsView => {
  if (value === 'admin' && isAdmin) return 'admin'
  if (value === 'appearance' || value === 'security') {
    return value
  }
  return 'appearance'
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, isLoading } = useAuth()

  const isAdmin = profile ? isPrimaryAdminProfile(profile) : false
  const isCurrentSuperAdmin = profile ? isPrimaryAdminEmail(profile.email) : false
  const activeSettingsView = parseSettingsView(searchParams.get('view'), isAdmin)

  // Admin state
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [adminLoading, setAdminLoading] = useState(false)

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(false)
  const [biometricStatus, setBiometricStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [biometricLoading, setBiometricLoading] = useState(false)

  // Account deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Admin user deletion state
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null)
  const [deleteUserConfirmEmail, setDeleteUserConfirmEmail] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)

  const {
    floatingCalculatorEnabled,
    setFloatingCalculatorEnabled,
    biometricLockTimeout,
    setBiometricLockTimeout,
    remindersEnabled,
    setRemindersEnabled,
    remindersDaysBeforeDebts,
    setRemindersDaysBeforeDebts,
    remindersDaysBeforeCardBills,
    setRemindersDaysBeforeCardBills,
  } = useAppSettings()

  const fetchUsers = async () => {
    if (!isAdmin) return
    setAdminLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('is_admin', false)
        .neq('email', ADMIN_EMAIL)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAllUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setAdminLoading(false)
    }
  }

  useEffect(() => {
    if (activeSettingsView === 'admin') {
      fetchUsers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WHY: recarrega usuários só ao entrar na aba admin
  }, [activeSettingsView])

  useEffect(() => {
    setBiometricAvailable(isBiometricAvailable())
    setBiometricRegistered(isBiometricRegistered())
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  const handleUpdateUserStatus = async (userId: string, isApproved: boolean, isBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_approved: isApproved,
          is_blocked: isBlocked,
          is_rejected: false,
          rejection_count: 0 // Reseta o contador ao aprovar ou desbloquear manualmente
        })
        .eq('id', userId)

      if (error) throw error

      setAllUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, is_approved: isApproved, is_blocked: isBlocked, is_rejected: false, rejection_count: 0 } : u)
      )

    } catch (err) {
      console.error('Error updating user status:', err)
      alert('Erro ao atualizar status do usuário.')
    }
  }

  const handleRejectUser = async (userId: string, isAlreadyApproved: boolean, currentRejectionCount: number = 0) => {
    if (isAlreadyApproved) {
      alert('Usuários já aprovados não podem ser recusados, apenas bloqueados.');
      return;
    }

    if (!confirm('Deseja recusar esta solicitação? O usuário poderá tentar mais uma vez. Na segunda recusa, ele será bloqueado permanentemente.')) return

    try {
      const newCount = (currentRejectionCount || 0) + 1;
      const shouldBlock = newCount >= 2;

      const { error } = await supabase
        .from('profiles')
        .update({
          is_rejected: true,
          rejection_count: newCount,
          is_blocked: shouldBlock,
          is_approved: false
        })
        .eq('id', userId)

      if (error) throw error

      setAllUsers((prev) =>
        prev.map((u) => u.id === userId ? {
          ...u,
          is_rejected: true,
          rejection_count: newCount,
          is_blocked: shouldBlock,
          is_approved: false
        } : u)
      )
    } catch (err) {
      console.error('Error rejecting user:', err)
      alert('Erro ao recusar usuário.')
    }
  }

  const openDeleteUserModal = (targetUser: Profile) => {
    if (isPrimaryAdminEmail(targetUser.email)) {
      toast.error('Não é permitido excluir o super administrador.')
      return
    }
    if (targetUser.id === user?.id) {
      toast.error('Use a opção em Segurança para excluir sua própria conta.')
      return
    }
    setUserToDelete(targetUser)
    setDeleteUserConfirmEmail('')
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    if (deleteUserConfirmEmail.trim().toLowerCase() !== userToDelete.email.toLowerCase()) {
      toast.error('O e-mail digitado não corresponde ao usuário selecionado.')
      return
    }

    setDeletingUser(true)
    const deletedEmail = userToDelete.email
    try {
      const { error } = await supabase.rpc('delete_user_by_admin', {
        target_user_id: userToDelete.id,
      })

      if (error) throw error

      setUserToDelete(null)
      setDeleteUserConfirmEmail('')
      await fetchUsers()
      toast.success(`Usuário ${deletedEmail} excluído permanentemente.`)
    } catch (err) {
      console.error('Error deleting user:', err)
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Erro ao excluir usuário.'
      toast.error(message)
    } finally {
      setDeletingUser(false)
    }
  }

  const updateSettingsView = (view: SettingsView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams, { replace: true })
  }

  const handleRegisterBiometric = async () => {
    if (!user) return
    setBiometricLoading(true)
    setBiometricStatus(null)
    const result = await registerBiometric(user.id, user.email ?? '')
    setBiometricLoading(false)
    if (result.success) {
      setBiometricRegistered(true)
      setBiometricStatus({ type: 'success', message: 'Biometria registrada com sucesso! Você pode usar na próxima entrada.' })
    } else {
      if (result.error !== 'CANCELLED') {
        setBiometricStatus({ type: 'error', message: result.error ?? 'Falha no registro.' })
      }
    }
  }

  const handleRemoveBiometric = () => {
    removeBiometricCredential()
    setBiometricRegistered(false)
    setBiometricStatus({ type: 'success', message: 'Biometria removida deste dispositivo.' })
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmationText !== 'DELETAR') return

    setDeletingAccount(true)
    try {
      // 1. Chamar o RPC para excluir o usuário (deve ser configurado no Supabase pelo ADM primeiro)
      const { error } = await supabase.rpc('delete_own_account')

      if (error) throw error

      // 2. Se o RPC funcionou, limpar caches locais e sair
      localStorage.clear() // Limpa tudo inclusive queues e temas
      await supabase.auth.signOut()

      // 3. Redirecionar será automático pelo ProtectedRoute ao perder a sessão
      alert('Sua conta e todos os dados foram excluídos permanentemente.')
    } catch (err: unknown) {
      console.error('Error deleting account:', err)
      alert(`Erro ao excluir conta: ${getErrorMessage(err, 'Verifique se a função do banco de dados foi configurada.')}`)
    } finally {
      setDeletingAccount(false)
      setIsDeleteModalOpen(false)
      setDeleteConfirmationText('')
    }
  }

  const SettingRow = ({
    title,
    description,
    children,
  }: {
    title: string
    description?: string
    children: React.ReactNode
  }) => (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-medium text-primary">{title}</h3>
        {description && <p className="text-sm text-secondary mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.settings.title} subtitle={PAGE_HEADERS.settings.description} />
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-page-enter">

        {/* Navigation */}
        <Card className="animate-stagger-item delay-50">
          <div className={`grid ${isAdmin ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'} gap-2`}>
            <Button
              type="button"
              variant={activeSettingsView === 'appearance' ? 'primary' : 'outline'}
              onClick={() => updateSettingsView('appearance')}
              className="flex items-center justify-center gap-2 w-full truncate"
            >
              <Sparkles size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Aparência</span>
            </Button>
            <Button
              type="button"
              variant={activeSettingsView === 'security' ? 'primary' : 'outline'}
              onClick={() => updateSettingsView('security')}
              className="flex items-center justify-center gap-2 w-full truncate"
            >
              <ShieldCheck size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Segurança</span>
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant={activeSettingsView === 'admin' ? 'primary' : 'outline'}
                onClick={() => updateSettingsView('admin')}
                className="flex items-center justify-center gap-2 w-full truncate"
              >
                <Users size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Admin</span>
              </Button>
            )}
          </div>
        </Card>


        {/* Admin Panel */}
        {isAdmin && (
          <section className={activeSettingsView === 'admin' ? 'space-y-4' : 'hidden'}>
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
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-tertiary border border-primary">
                    <Crown size={20} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-primary">Super Administrador</h3>
                    <p className="text-sm text-secondary mt-0.5">
                      Conta principal com acesso total, aprovação de usuários e consultoria.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <p className="font-medium text-primary">{ADMIN_EMAIL}</p>
                      {isCurrentSuperAdmin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-success)]/10 text-[var(--color-success)]">
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
                  {allUsers.map((pUser) => (
                    <div key={pUser.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-primary">{pUser.email}</p>
                          {pUser.is_blocked || pUser.rejection_count >= 2 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
                              Bloqueado
                            </span>
                          ) : pUser.is_rejected ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
                              Recusado ({pUser.rejection_count})
                            </span>
                          ) : pUser.is_approved ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-success)]/10 text-[var(--color-success)]">
                              Ativo
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
                              Pendente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary mt-0.5">Entrou em: {new Date(pUser.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
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
        )}

        {/* Aparência */}
        <section className={activeSettingsView === 'appearance' ? 'space-y-4' : 'hidden'}>
          <SectionHeader
            title="Aparência"
            description="Tema e cor de destaque"
          />

          <ThemeSwitcher />

          <AccentToneSwitcher />

          <Card>
            <SettingRow
              title="Calculadora flutuante"
              description="Exibe uma calculadora flutuante acessível em qualquer página do app. Arraste o ícone para alternar entre o canto inferior e a lateral direita."
            >
              <Switch
                checked={floatingCalculatorEnabled}
                onChange={() => setFloatingCalculatorEnabled(!floatingCalculatorEnabled)}
                title={floatingCalculatorEnabled ? 'Desativar calculadora' : 'Ativar calculadora'}
              />
            </SettingRow>
          </Card>

          <Card>
            <div className="space-y-4">
              <SettingRow
                title="Lembretes de vencimento"
                description="Exibe alertas visuais no painel principal sobre faturas de cartão e contas a pagar/receber próximas do vencimento."
              >
                <Switch
                  checked={remindersEnabled}
                  onChange={() => setRemindersEnabled(!remindersEnabled)}
                  title={remindersEnabled ? 'Desativar lembretes' : 'Ativar lembretes'}
                />
              </SettingRow>

              {remindersEnabled && (
                <div className="mt-4 pt-4 border-t border-primary space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-primary">Antecedência para contas</h4>
                      <p className="text-xs text-secondary mt-0.5">Dias antes do vencimento para alertar contas a pagar/receber.</p>
                    </div>
                    <Select
                      value={String(remindersDaysBeforeDebts)}
                      onChange={(e) => setRemindersDaysBeforeDebts(Number(e.target.value))}
                      options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i === 0 ? 'dia' : 'dias'}` }))}
                      className="min-w-[150px] sm:w-[150px]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-primary">Antecedência para faturas</h4>
                      <p className="text-xs text-secondary mt-0.5">Dias antes do vencimento para alertar faturas de cartão de crédito.</p>
                    </div>
                    <Select
                      value={String(remindersDaysBeforeCardBills)}
                      onChange={(e) => setRemindersDaysBeforeCardBills(Number(e.target.value))}
                      options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i === 0 ? 'dia' : 'dias'}` }))}
                      className="min-w-[150px] sm:w-[150px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Segurança */}
        <section className={activeSettingsView === 'security' ? 'space-y-4' : 'hidden'}>
          <SectionHeader
            title="Segurança"
            description="Gerencie o acesso biométrico ao app neste dispositivo"
          />

          <Card className="animate-stagger-item delay-200">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-tertiary border border-primary">
                  <Fingerprint size={24} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">Login com biometria</h3>
                  <p className="text-sm text-secondary mt-0.5">
                    Use Face ID, Touch ID, Windows Hello ou PIN do dispositivo para entrar sem digitar email e senha em cada visita.
                  </p>
                </div>
              </div>

              {!biometricAvailable && (
                <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3">
                  <p className="text-sm text-primary">
                    ⚠️ Este navegador ou dispositivo não suporta autenticação biométrica (WebAuthn).
                    Use Chrome, Safari ou Edge em um dispositivo com biometria ou Windows Hello.
                  </p>
                </div>
              )}

              {biometricStatus && (
                <div className={`rounded - lg border p - 3 ${biometricStatus.type === 'success'
                  ? 'border-[var(--color-success)] bg-[var(--color-success)]/10'
                  : 'border-[var(--color-danger)] bg-[var(--color-danger)]/10'
                  } `}>
                  <p className="text-sm text-primary">{biometricStatus.message}</p>
                </div>
              )}

              {biometricAvailable && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`h - 2 w - 2 rounded - full ${biometricRegistered ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]'} `} />
                    <p className="text-sm text-secondary">
                      {biometricRegistered
                        ? 'Biometria registrada neste dispositivo'
                        : 'Nenhuma biometria registrada neste dispositivo'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!biometricRegistered ? (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleRegisterBiometric}
                        disabled={biometricLoading || !user}
                        className="flex items-center gap-2 min-w-[180px] justify-center"
                      >
                        {biometricLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Registrando...</span>
                          </div>
                        ) : (
                          <>
                            <Fingerprint size={16} />
                            <span>Registrar biometria</span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRegisterBiometric}
                          disabled={biometricLoading || !user}
                          className="flex items-center gap-2 min-w-[180px] justify-center"
                        >
                          {biometricLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 size={16} className="animate-spin" />
                              <span>Atualizando...</span>
                            </div>
                          ) : (
                            <>
                              <Fingerprint size={16} />
                              <span>Atualizar biometria</span>
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRemoveBiometric}
                          className="flex items-center gap-2 text-[var(--color-danger)] border-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                        >
                          Remover biometria
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {biometricRegistered && (
                <>
                  <div className="border-t border-primary" />
                  <SettingRow
                    title="Bloqueio automático"
                    description="Exige biometria após tempo de inatividade ou ao sair do app/desligar a tela."
                  >
                  <Select
                    value={String(biometricLockTimeout)}
                    onChange={(e) => setBiometricLockTimeout(Number(e.target.value) as BiometricLockTimeout)}
                    options={[
                      { value: '0', label: 'Imediatamente / Desligar Tela' },
                      { value: '1', label: 'Após 1 minuto' },
                      { value: '5', label: 'Após 5 minutos' },
                      { value: '15', label: 'Após 15 minutos' }
                    ]}
                    className="min-w-[200px]"
                  />
                  </SettingRow>
                </>
              )}
            </div>
          </Card>
          {!isAdmin && (
            <div className="animate-stagger-item delay-200 mt-6">
              <div className="flex items-center gap-2 mb-3 text-[var(--color-danger)]">
                <AlertTriangle size={18} />
                <h3 className="text-base font-bold uppercase tracking-wider">Zona de Perigo</h3>
              </div>

              <Card className="border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-primary">Excluir minha conta</h4>
                      <p className="text-sm text-secondary mt-1">
                        Esta ação apagará <strong>todos</strong> os seus dados (lançamentos, cartões, categorias e conta) permanentemente. Não há como desfazer.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="text-[var(--color-danger)] border-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 flex items-center gap-2 justify-center"
                    >
                      <Trash2 size={16} />
                      Excluir Conta
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </section>

      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => !deletingAccount && setIsDeleteModalOpen(false)}
        title="Confirmar exclusão de conta"
        layout="stacked"
        confirmLabel={deletingAccount ? 'Excluindo...' : 'Sim, excluir minha conta permanentemente'}
        confirmVariant="danger"
        confirmDisabled={deleteConfirmationText !== 'DELETAR'}
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
        cancelLabel="Cancelar e voltar"
      >
        <div className="modal-alert modal-alert--danger">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <div className="text-sm text-primary">
            <p className="font-bold">Atenção!</p>
            <p className="mt-1">
              Você está prestes a excluir permanentemente sua conta e todos os dados associados a ela.
              Esta ação é irreversível.
            </p>
          </div>
        </div>

        <div className="modal-field-group">
          <p className="text-sm leading-relaxed text-primary">
            Para confirmar que deseja prosseguir com a exclusão total dos seus dados, digite{' '}
            <strong className="text-[var(--color-danger)]">DELETAR</strong> no campo abaixo:
          </p>
          <Input
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value.toUpperCase())}
            placeholder="Digite DELETAR aqui"
            autoFocus
            disabled={deletingAccount}
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={userToDelete !== null}
        onClose={() => !deletingUser && setUserToDelete(null)}
        title="Excluir usuário do sistema"
        layout="stacked"
        confirmLabel={deletingUser ? 'Excluindo usuário...' : 'Excluir usuário permanentemente'}
        confirmVariant="danger"
        confirmDisabled={
          userToDelete
            ? deleteUserConfirmEmail.trim().toLowerCase() !== userToDelete.email.toLowerCase()
            : true
        }
        loading={deletingUser}
        onConfirm={handleDeleteUser}
      >
        {userToDelete ? (
          <>
            <div className="modal-alert modal-alert--danger">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <div className="text-sm text-primary">
                <p className="font-bold">Ação irreversível</p>
                <p className="mt-1">
                  A conta <strong>{userToDelete.email}</strong> será removida permanentemente,
                  incluindo lançamentos, categorias, cartões e carteira de investimentos vinculada.
                </p>
              </div>
            </div>

            <div className="modal-field-group">
              <p className="text-sm leading-relaxed text-primary">Digite o e-mail do usuário para confirmar:</p>
              <Input
                value={deleteUserConfirmEmail}
                onChange={(e) => setDeleteUserConfirmEmail(e.target.value)}
                placeholder={userToDelete.email}
                autoFocus
                disabled={deletingUser}
              />
            </div>
          </>
        ) : null}
      </ConfirmModal>
    </div>
  )
}
