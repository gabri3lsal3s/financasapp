import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingDown, TrendingUp } from 'lucide-react'

interface CategoriesTabsProps {
  activeTab: 'expenses' | 'incomes'
  onTabChange: (tab: 'expenses' | 'incomes') => void
}

/**
 * CategoriesTabs — seletor de aba (Orçamentos/Metas) exibido no mobile,
 * extraído da página Categorias.
 */
export default function CategoriesTabs({ activeTab, onTabChange }: CategoriesTabsProps) {
  return (
    <div className="lg:hidden w-full">
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'expenses' | 'incomes')} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
          <TabsTrigger value="expenses" className="text-xs font-bold gap-1.5">
            <TrendingDown size={14} className={activeTab === 'expenses' ? 'text-expense' : 'text-secondary'} />
            <span>Orçamentos</span>
          </TabsTrigger>
          <TabsTrigger value="incomes" className="text-xs font-bold gap-1.5">
            <TrendingUp size={14} className={activeTab === 'incomes' ? 'text-income' : 'text-secondary'} />
            <span>Metas</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
