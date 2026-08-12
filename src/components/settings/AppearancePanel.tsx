import SectionHeader from '@/components/SectionHeader'
import Card from '@/components/Card'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import AccentToneSwitcher from '@/components/AccentToneSwitcher'
import Switch from '@/components/Switch'
import Select from '@/components/Select'
import SettingRow from '@/components/settings/SettingRow'
import type { AppSettingsState } from '@/hooks/useAppSettings'

interface AppearancePanelProps {
  floatingCalculatorEnabled: boolean
  floatingCalculatorAbsorbed: boolean
  remindersEnabled: boolean
  remindersDaysBeforeDebts: number
  remindersDaysBeforeCardBills: number
  onUpdateSetting: <K extends keyof AppSettingsState>(key: K, value: AppSettingsState[K]) => void
}

/**
 * AppearancePanel — aba Aparência da página Configurações (extraída de
 * Settings.tsx). Tema, acento, calculadora flutuante e lembretes.
 */
export default function AppearancePanel({
  floatingCalculatorEnabled,
  floatingCalculatorAbsorbed,
  remindersEnabled,
  remindersDaysBeforeDebts,
  remindersDaysBeforeCardBills,
  onUpdateSetting,
}: AppearancePanelProps) {
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Aparência"
        description="Tema e cor de destaque"
      />

      <ThemeSwitcher />

      <AccentToneSwitcher />

      <Card>
        <div className="space-y-4">
          <SettingRow
            title="Calculadora flutuante"
            description="Exibe uma calculadora flutuante acessível em qualquer página do app. Arraste o ícone para alternar entre o canto inferior e a lateral direita."
          >
            <Switch
              checked={floatingCalculatorEnabled}
              onChange={() => onUpdateSetting('floatingCalculatorEnabled', !floatingCalculatorEnabled)}
              title={floatingCalculatorEnabled ? 'Desativar calculadora' : 'Ativar calculadora'}
            />
          </SettingRow>

          {floatingCalculatorEnabled && (
            <div className="mt-4 pt-4 border-t border-primary animate-in fade-in slide-in-from-top-2 duration-300">
              <SettingRow
                title="Integrar ao botão de ações"
                description="Posiciona a calculadora dentro do botão de ações unificado no canto inferior direito."
              >
                <Switch
                  checked={floatingCalculatorAbsorbed}
                  onChange={() => onUpdateSetting('floatingCalculatorAbsorbed', !floatingCalculatorAbsorbed)}
                  title={floatingCalculatorAbsorbed ? 'Desativar integração' : 'Ativar integração'}
                />
              </SettingRow>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <SettingRow
            title="Lembretes de vencimento"
            description="Exibe alertas visuais no painel principal sobre faturas de cartão e contas a pagar/receber próximas do vencimento."
          >
            <Switch
              checked={remindersEnabled}
              onChange={() => onUpdateSetting('remindersEnabled', !remindersEnabled)}
              title={remindersEnabled ? 'Desativar lembretes' : 'Ativar lembretes'}
            />
          </SettingRow>

          {remindersEnabled && (
            <div className="mt-4 pt-4 border-t border-primary space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* WHY: layout em coluna em mobile para o dropdown ter espaço de abertura sem overlay */}
              <div className="flex flex-col gap-2">
                <div>
                  <h4 className="text-sm font-medium text-primary">Antecedência para contas</h4>
                  <p className="text-xs text-secondary mt-0.5">Dias antes do vencimento para alertar contas a pagar/receber.</p>
                </div>
                <Select
                  value={String(remindersDaysBeforeDebts)}
                  onChange={(e) => onUpdateSetting('remindersDaysBeforeDebts', Number(e.target.value))}
                  options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i === 0 ? 'dia' : 'dias'}` }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <h4 className="text-sm font-medium text-primary">Antecedência para faturas</h4>
                  <p className="text-xs text-secondary mt-0.5">Dias antes do vencimento para alertar faturas de cartão de crédito.</p>
                </div>
                <Select
                  value={String(remindersDaysBeforeCardBills)}
                  onChange={(e) => onUpdateSetting('remindersDaysBeforeCardBills', Number(e.target.value))}
                  options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i === 0 ? 'dia' : 'dias'}` }))}
                />
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}
