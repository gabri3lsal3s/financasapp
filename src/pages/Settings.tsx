import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { PAGE_HEADERS } from '@/constants/pages'
import Button from '@/components/Button'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ColorPaletteSwitcher from '@/components/ColorPaletteSwitcher'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  isBiometricAvailable,
  isBiometricRegistered,
  registerBiometric,
  removeBiometricCredential,
} from '@/utils/biometric'
import { ShieldCheck, Loader2, Users, RefreshCw, Fingerprint, SlidersHorizontal, Sparkles } from 'lucide-react'




type SettingsView = 'appearance' | 'personalization' | 'security' | 'admin'

const parseSettingsView = (value: string | null, isAdmin: boolean): SettingsView => {
  if (value === 'admin' && isAdmin) return 'admin'
  if (value === 'appearance' || value === 'personalization' || value === 'security') {
    return value
  }
  return 'appearance'
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  const isAdmin = profile?.is_admin ?? false

  const activeSettingsView = parseSettingsView(searchParams.get('view'), isAdmin)

  // Admin state
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [adminLoading, setAdminLoading] = useState(false)

  const fetchUsers = async () => {
    if (!isAdmin) return
    setAdminLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', false) // Não listar outros admins para segurança
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
  }, [activeSettingsView])


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




  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(false)
  const [biometricStatus, setBiometricStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [biometricLoading, setBiometricLoading] = useState(false)

  useEffect(() => {
    setBiometricAvailable(isBiometricAvailable())
    setBiometricRegistered(isBiometricRegistered())
  }, [])

  const {
    monthlyInsightsEnabled,
    setMonthlyInsightsEnabled,
    floatingCalculatorEnabled,
    setFloatingCalculatorEnabled,
    biometricLockTimeout,
    setBiometricLockTimeout,
    assistantDoubleConfirmationEnabled,
    setAssistantDoubleConfirmationEnabled,
  } = useAppSettings()

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

  const ToggleSwitch = ({
    checked,
    onChange,
    title,
  }: {
    checked: boolean
    onChange: () => void
    title?: string
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      title={title}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${checked ? 'bg-tertiary border-[var(--color-primary)]' : 'bg-secondary border-primary'
        }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  )

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
          <div className={`grid ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2`}>
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
              variant={activeSettingsView === 'personalization' ? 'primary' : 'outline'}
              onClick={() => updateSettingsView('personalization')}
              className="flex items-center justify-center gap-2 w-full truncate"
            >
              <SlidersHorizontal size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Personalização</span>
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
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-xl font-semibold text-primary">Painel Administrativo</h2>
                <p className="text-secondary text-sm">Gerencie solicitações de acesso ao sistema</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={adminLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw size={14} className={adminLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>


            <Card className="animate-stagger-item delay-100">
              {adminLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : allUsers.length === 0 ? (
                <div className="text-center py-8 text-secondary">
                  Nenhum usuário cadastrado além de você.
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
                      <div className="flex gap-2 mt-2 sm:mt-0">
                        {pUser.is_approved ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`flex-1 sm:flex-none ${pUser.is_blocked || pUser.rejection_count >= 2 ? 'text-[var(--color-success)] border-[var(--color-success)]' : 'text-[var(--color-warning)] border-[var(--color-warning)]'}`}
                            onClick={() => handleUpdateUserStatus(pUser.id, true, !(pUser.is_blocked || pUser.rejection_count >= 2))}
                          >
                            {pUser.is_blocked || pUser.rejection_count >= 2 ? 'Desbloquear' : 'Bloquear'}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="flex-1 sm:flex-none"
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
                            className="flex-1 sm:flex-none text-[var(--color-danger)] border-[var(--color-danger)]"
                            onClick={() => handleRejectUser(pUser.id, false, pUser.rejection_count)}
                          >
                            Recusar
                          </Button>
                        )}
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
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Aparência</h2>
            <p className="text-secondary text-sm">Personalize tema e paleta de cores da interface</p>
          </div>
          <ThemeSwitcher />
          <ColorPaletteSwitcher />
        </section>

        {/* Personalização */}
        <section className={activeSettingsView === 'personalization' ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Personalização</h2>
            <p className="text-secondary text-sm">Ajuste preferências de experiência e recursos visuais</p>
          </div>

          <Card className="animate-stagger-item delay-100">
            <div className="space-y-5">
              <SettingRow
                title="Insights personalizados do mês"
                description="O assistente analisa seu comportamento financeiro mensal e gera interpretações no Dashboard."
              >
                <ToggleSwitch
                  checked={monthlyInsightsEnabled}
                  onChange={() => setMonthlyInsightsEnabled(!monthlyInsightsEnabled)}
                  title={monthlyInsightsEnabled ? 'Desativar insights' : 'Ativar insights'}
                />
              </SettingRow>

              <SettingRow
                title="Calculadora flutuante"
                description="Exibe uma calculadora flutuante acessível em qualquer página do app."
              >
                <ToggleSwitch
                  checked={floatingCalculatorEnabled}
                  onChange={() => setFloatingCalculatorEnabled(!floatingCalculatorEnabled)}
                  title={floatingCalculatorEnabled ? 'Desativar calculadora' : 'Ativar calculadora'}
                />
              </SettingRow>
              <SettingRow
                title="Revisão dupla com IA"
                description="Exibe um painel de confirmação dos dados extraídos pela IA antes de salvar."
              >
                <ToggleSwitch
                  checked={assistantDoubleConfirmationEnabled}
                  onChange={() => setAssistantDoubleConfirmationEnabled(!assistantDoubleConfirmationEnabled)}
                  title={assistantDoubleConfirmationEnabled ? 'Desativar revisão dupla' : 'Ativar revisão dupla'}
                />
              </SettingRow>
            </div>
          </Card>
        </section>

        {/* Segurança */}
        <section className={activeSettingsView === 'security' ? 'space-y-4' : 'hidden'}>
          <div className="animate-stagger-item delay-150">
            <h2 className="text-xl font-semibold text-primary mb-1">Segurança</h2>
            <p className="text-secondary text-sm">Gerencie o acesso biométrico ao app neste dispositivo</p>
          </div>

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
                    <select
                      value={String(biometricLockTimeout)}
                      onChange={(e) => setBiometricLockTimeout(Number(e.target.value) as any)}
                      className="block w-full min-w-[200px] rounded-lg border border-primary bg-secondary p-2.5 text-sm text-primary shadow-sm focus:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                    >
                      <option value="0">Imediatamente / Desligar Tela</option>
                      <option value="1">Após 1 minuto</option>
                      <option value="5">Após 5 minutos</option>
                      <option value="15">Após 15 minutos</option>
                    </select>
                  </SettingRow>
                </>
              )}
            </div>
          </Card>
        </section>


      </div>
    </div>
  )
}
