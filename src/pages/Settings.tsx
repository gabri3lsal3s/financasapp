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
import {
  isBiometricAvailable,
  isBiometricRegistered,
  registerBiometric,
  removeBiometricCredential,
} from '@/utils/biometric'
import { Fingerprint, SlidersHorizontal, Sparkles, ShieldCheck } from 'lucide-react'
import { applyOrientationSettings } from '@/utils/orientation'

type SettingsView = 'appearance' | 'personalization' | 'security'

const parseSettingsView = (value: string | null): SettingsView => {
  if (value === 'appearance' || value === 'personalization' || value === 'security') {
    return value
  }
  return 'appearance'
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSettingsView = parseSettingsView(searchParams.get('view'))
  const { user } = useAuth()

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
    screenRotationAllowed,
    setScreenRotationAllowed,
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
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
        checked ? 'bg-tertiary border-[var(--color-primary)]' : 'bg-secondary border-primary'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full motion-standard ${
          checked ? 'translate-x-6 bg-[var(--color-primary)]' : 'translate-x-1 bg-[var(--color-text-secondary)]'
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
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">

        {/* Navigation */}
        <Card>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={activeSettingsView === 'appearance' ? 'primary' : 'outline'}
              onClick={() => updateSettingsView('appearance')}
              className="flex items-center justify-center gap-2 w-full"
            >
              <Sparkles size={16} /> <span className="hidden sm:inline">Aparência</span>
            </Button>
            <Button
              type="button"
              variant={activeSettingsView === 'personalization' ? 'primary' : 'outline'}
              onClick={() => updateSettingsView('personalization')}
              className="flex items-center justify-center gap-2 w-full"
            >
              <SlidersHorizontal size={16} /> <span className="hidden sm:inline">Personalização</span>
            </Button>
            <Button
              type="button"
              variant={activeSettingsView === 'security' ? 'primary' : 'outline'}
              onClick={() => updateSettingsView('security')}
              className="flex items-center justify-center gap-2 w-full"
            >
              <ShieldCheck size={16} /> <span className="hidden sm:inline">Segurança</span>
            </Button>
          </div>
        </Card>

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

          <Card>
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

              <SettingRow
                title="Permitir rotação de tela"
                description="Habilita o modo paisagem em tablets e celulares (o padrão é fixo em retrato)."
              >
                <ToggleSwitch
                  checked={screenRotationAllowed}
                  onChange={() => {
                    const newValue = !screenRotationAllowed
                    setScreenRotationAllowed(newValue)
                    // Chamada direta para satisfazer requisito de "user gesture"
                    applyOrientationSettings(newValue)
                  }}
                  title={screenRotationAllowed ? 'Desativar rotação' : 'Permitir rotação'}
                />
              </SettingRow>
            </div>
          </Card>
        </section>

        {/* Segurança */}
        <section className={activeSettingsView === 'security' ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="text-xl font-semibold text-primary mb-1">Segurança</h2>
            <p className="text-secondary text-sm">Gerencie o acesso biométrico ao app neste dispositivo</p>
          </div>

          <Card>
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
                <div className={`rounded-lg border p-3 ${
                  biometricStatus.type === 'success'
                    ? 'border-[var(--color-success)] bg-[var(--color-success)]/10'
                    : 'border-[var(--color-danger)] bg-[var(--color-danger)]/10'
                }`}>
                  <p className="text-sm text-primary">{biometricStatus.message}</p>
                </div>
              )}

              {biometricAvailable && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${biometricRegistered ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]'}`} />
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
                        className="flex items-center gap-2"
                      >
                        <Fingerprint size={16} />
                        {biometricLoading ? 'Registrando...' : 'Registrar biometria'}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRegisterBiometric}
                          disabled={biometricLoading || !user}
                          className="flex items-center gap-2"
                        >
                          <Fingerprint size={16} />
                          {biometricLoading ? 'Atualizando...' : 'Atualizar biometria'}
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
