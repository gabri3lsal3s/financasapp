import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePageActions } from '@/hooks/usePageActions'
import PageHeader from '@/components/PageHeader'
import SettingsTabs, { type SettingsView } from '@/components/settings/SettingsTabs'
import AdminPanel from '@/components/settings/AdminPanel'
import AppearancePanel from '@/components/settings/AppearancePanel'
import SecurityPanel from '@/components/settings/SecurityPanel'
import SettingsModals from '@/components/settings/SettingsModals'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useAuth } from '@/contexts/AuthContext'
import { isPrimaryAdminEmail, isPrimaryAdminProfile } from '@/constants/adminProfile'
import { useSettingsAdmin } from '@/hooks/useSettingsAdmin'
import { useSettingsSecurity } from '@/hooks/useSettingsSecurity'
import { isBiometricAvailable, isBiometricRegistered } from '@/utils/biometric'
import { Loader2 } from 'lucide-react'

const parseSettingsView = (value: string | null, isAdmin: boolean): SettingsView => {
  if (value === 'admin' && isAdmin) return 'admin'
  if (value === 'appearance' || value === 'security') {
    return value
  }
  return 'appearance'
}

export default function Settings() {
  usePageActions([])
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, isLoading } = useAuth()

  const isAdmin = profile ? isPrimaryAdminProfile(profile) : false
  const isCurrentSuperAdmin = profile ? isPrimaryAdminEmail(profile.email) : false
  const activeSettingsView = parseSettingsView(searchParams.get('view'), isAdmin)

  const admin = useSettingsAdmin(isAdmin, user?.id)
  const security = useSettingsSecurity(user)

  const { settings: {
    floatingCalculatorEnabled,
    floatingCalculatorAbsorbed,
    biometricLockTimeout,
    remindersEnabled,
    remindersDaysBeforeDebts,
    remindersDaysBeforeCardBills,
  }, updateSetting } = useAppSettings()

  useEffect(() => {
    if (activeSettingsView === 'admin') {
      admin.fetchUsers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WHY: recarrega usuários só ao entrar na aba admin
  }, [activeSettingsView])

  useEffect(() => {
    security.setBiometricAvailable(isBiometricAvailable())
    security.setBiometricRegistered(isBiometricRegistered())
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WHY: verificação única no mount
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  const updateSettingsView = (view: SettingsView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div>
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-page-enter">

        {/* Cabeçalho de conteúdo da página */}
        <PageHeader
          title="Configurações"
          subtitle="Ajuste o tema, a segurança e as preferências do app"
          truncateSubtitleOnMobile
        />

        {/* Navigation */}
        <SettingsTabs
          activeView={activeSettingsView}
          isAdmin={isAdmin}
          onViewChange={updateSettingsView}
        />

        {/* Admin Panel */}
        {isAdmin && activeSettingsView === 'admin' && (
          <AdminPanel admin={admin} isCurrentSuperAdmin={isCurrentSuperAdmin} />
        )}

        {/* Aparência */}
        {activeSettingsView === 'appearance' && (
          <AppearancePanel
            floatingCalculatorEnabled={floatingCalculatorEnabled}
            floatingCalculatorAbsorbed={floatingCalculatorAbsorbed}
            remindersEnabled={remindersEnabled}
            remindersDaysBeforeDebts={remindersDaysBeforeDebts}
            remindersDaysBeforeCardBills={remindersDaysBeforeCardBills}
            onUpdateSetting={updateSetting}
          />
        )}

        {/* Segurança */}
        {activeSettingsView === 'security' && (
          <SecurityPanel
            security={security}
            biometricLockTimeout={biometricLockTimeout}
            onUpdateSetting={updateSetting}
            isAdmin={isAdmin}
          />
        )}

      </div>

      <SettingsModals security={security} admin={admin} />
    </div>
  )
}
