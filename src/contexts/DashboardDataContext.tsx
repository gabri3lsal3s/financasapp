/**
 * Provider do contexto de dados do Dashboard. Os hooks focados vivem em
 * dashboardDataContext.ts (módulo sem JSX) — este arquivo exporta apenas o
 * componente Provider, mantendo o fast-refresh limpo (react-refresh).
 */
import type { ReactNode } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { DashboardDataContext } from '@/contexts/dashboardDataContext'

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const data = useDashboardData()

  return (
    <DashboardDataContext.Provider value={data}>
      {children}
    </DashboardDataContext.Provider>
  )
}
