import Button from '@/components/Button'

export type MobileChartView = 'panorama' | 'flow'

interface MobileChartSwitcherProps {
  activeView: MobileChartView
  onChange: (view: MobileChartView) => void
}

export default function MobileChartSwitcher({ activeView, onChange }: MobileChartSwitcherProps) {
  return (
    <div className="flex xl:hidden justify-center bg-secondary border border-primary p-1 rounded-xl max-w-[260px] mx-auto mt-2">
      <Button
        type="button"
        variant={activeView === 'panorama' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onChange('panorama')}
        className="flex-1 !min-h-0 py-1.5 text-xs font-bold"
      >
        Panorama
      </Button>
      <Button
        type="button"
        variant={activeView === 'flow' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onChange('flow')}
        className="flex-1 !min-h-0 py-1.5 text-xs font-bold"
      >
        Fluxo Diário
      </Button>
    </div>
  )
}
