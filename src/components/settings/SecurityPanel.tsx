import SectionHeader from '@/components/SectionHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Select from '@/components/Select'
import SettingRow from '@/components/settings/SettingRow'
import { Fingerprint, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import type { AppSettingsState, BiometricLockTimeout } from '@/hooks/useAppSettings'
import type { UseSettingsSecurityReturn } from '@/hooks/useSettingsSecurity'

interface SecurityPanelProps {
  security: UseSettingsSecurityReturn
  biometricLockTimeout: number
  onUpdateSetting: <K extends keyof AppSettingsState>(key: K, value: AppSettingsState[K]) => void
  isAdmin: boolean
}

/**
 * SecurityPanel — aba Segurança da página Configurações (extraída de
 * Settings.tsx). Login biométrico (WebAuthn), bloqueio automático e zona de
 * perigo (exclusão da conta).
 */
export default function SecurityPanel({
  security,
  biometricLockTimeout,
  onUpdateSetting,
  isAdmin,
}: SecurityPanelProps) {
  const {
    biometricAvailable,
    biometricRegistered,
    biometricStatus,
    biometricLoading,
    handleRegisterBiometric,
    handleRemoveBiometric,
    setIsDeleteModalOpen,
  } = security

  return (
    <section className="space-y-4">
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
                <AlertTriangle size={16} className="text-warning shrink-0 mr-1 inline-block align-middle" /> Este navegador ou dispositivo não suporta autenticação biométrica (WebAuthn).
                Use Chrome, Safari ou Edge em um dispositivo com biometria ou Windows Hello.
              </p>
            </div>
          )}

          {biometricStatus && (
            <div className={`rounded-lg border p-3 ${biometricStatus.type === 'success'
              ? 'border-[var(--color-success)] bg-[var(--color-success)]/10'
              : 'border-[var(--color-danger)] bg-[var(--color-danger)]/10'
              } `}>
              <p className="text-sm text-primary">{biometricStatus.message}</p>
            </div>
          )}

          {biometricAvailable && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${biometricRegistered ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]'} `} />
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
                    disabled={biometricLoading}
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
                      disabled={biometricLoading}
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
                  onChange={(e) => onUpdateSetting('biometricLockTimeout', Number(e.target.value) as BiometricLockTimeout)}
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
  )
}
