import Card from '@/components/Card'
import Button from '@/components/Button'
import { Sparkles, ShieldCheck, Users } from 'lucide-react'

export type SettingsView = 'appearance' | 'security' | 'admin'

interface SettingsTabsProps {
  activeView: SettingsView
  isAdmin: boolean
  onViewChange: (view: SettingsView) => void
}

/**
 * SettingsTabs — navegação por abas da página Configurações (Aparência,
 * Segurança e Admin), extraída de Settings.tsx.
 */
export default function SettingsTabs({ activeView, isAdmin, onViewChange }: SettingsTabsProps) {
  return (
    <Card className="animate-stagger-item delay-50">
      <div className={`grid ${isAdmin ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'} gap-2`}>
        <Button
          type="button"
          variant={activeView === 'appearance' ? 'primary' : 'outline'}
          onClick={() => onViewChange('appearance')}
          className="flex items-center justify-center gap-2 w-full truncate"
        >
          <Sparkles size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Aparência</span>
        </Button>
        <Button
          type="button"
          variant={activeView === 'security' ? 'primary' : 'outline'}
          onClick={() => onViewChange('security')}
          className="flex items-center justify-center gap-2 w-full truncate"
        >
          <ShieldCheck size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Segurança</span>
        </Button>
        {isAdmin && (
          <Button
            type="button"
            variant={activeView === 'admin' ? 'primary' : 'outline'}
            onClick={() => onViewChange('admin')}
            className="flex items-center justify-center gap-2 w-full truncate"
          >
            <Users size={16} className="min-w-[16px]" /> <span className="hidden xs:inline sm:inline">Admin</span>
          </Button>
        )}
      </div>
    </Card>
  )
}
