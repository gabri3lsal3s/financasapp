import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type MobileChartView = 'panorama' | 'flow'

interface MobileChartSwitcherProps {
  activeView: MobileChartView
  onChange: (view: MobileChartView) => void
}

export default function MobileChartSwitcher({ activeView, onChange }: MobileChartSwitcherProps) {
  return (
    <Tabs
      value={activeView}
      onValueChange={(value) => onChange(value as MobileChartView)}
      className="mx-auto mt-2 flex w-full max-w-md justify-center xl:hidden"
    >
      <TabsList className="w-full">
        <TabsTrigger value="panorama" className="flex-1 text-xs font-bold">
          Panorama
        </TabsTrigger>
        <TabsTrigger value="flow" className="flex-1 text-xs font-bold">
          Fluxo Diário
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
