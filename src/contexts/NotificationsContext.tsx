/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useDebts } from '@/hooks/useDebts'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { resolveBillCompetence } from '@/utils/creditCardBilling'
import { addMonths, getCurrentMonthString } from '@/utils/format'
import { logger } from '@/utils/logger'

export interface AlertItem {
  id: string
  title: string
  dueDate: string
  amount: number
  isOverdue: boolean
  isCard: boolean
  debtType?: 'payable' | 'receivable'
}

interface NotificationsContextType {
  combinedAlerts: AlertItem[]
  remindersEnabled: boolean
  isMobileAlertsOpen: boolean
  setIsMobileAlertsOpen: (open: boolean) => void
  isDesktopAlertsOpen: boolean
  setIsDesktopAlertsOpen: (open: boolean) => void
  snoozeAlert: (alertId: string) => void
  markAsRead: (alertId: string) => void
  todayStr: string
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { settings: { remindersEnabled, remindersDaysBeforeDebts, remindersDaysBeforeCardBills } } = useAppSettings()
  
  const { debts } = useDebts()
  const { creditCards } = useCreditCards()
  const { isOnline } = useNetworkStatus()

  const [isDesktopAlertsOpen, setIsDesktopAlertsOpen] = useState(false)
  const [isMobileAlertsOpen, setIsMobileAlertsOpen] = useState(false)
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const [snoozedAlerts, setSnoozedAlerts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('app.reminders.snoozedAlerts')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const snoozeAlert = (alertId: string) => {
    setSnoozedAlerts((prev) => {
      const next = [...prev, alertId]
      localStorage.setItem('app.reminders.snoozedAlerts', JSON.stringify(next))
      return next
    })
  }

  const [readAlerts, setReadAlerts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('app.reminders.readAlerts')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const markAsRead = (alertId: string) => {
    setReadAlerts((prev) => {
      const next = [...prev, alertId]
      localStorage.setItem('app.reminders.readAlerts', JSON.stringify(next))
      return next
    })
  }

  const [cardBillAlerts, setCardBillAlerts] = useState<Array<{
    cardName: string
    type: 'overdue' | 'near_due'
    dueDate: string
    amount: number
    cardId: string
  }>>([])

  const loadCardBillAlerts = useCallback(async () => {
    try {
      if (!isOnline) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTime = today.getTime()

      const realCurrentMonth = getCurrentMonthString()
      const prevMonthStr = addMonths(realCurrentMonth, -1)
      const competences = [prevMonthStr, realCurrentMonth]

      const { data: cyclesData } = await supabase
        .from('credit_card_monthly_cycles')
        .select('*')
        .in('competence', competences)

      const cycleMap = (cyclesData || []).reduce<Record<string, { closing_day: number; due_day: number }>>((acc, row) => {
        acc[`${row.credit_card_id}:${row.competence}`] = {
          closing_day: Number(row.closing_day),
          due_day: Number(row.due_day),
        }
        return acc
      }, {})

      const { data: cardExpenses } = await supabase
        .from('expenses')
        .select('amount, report_weight, credit_card_id, date, bill_competence')
        .not('credit_card_id', 'is', null)

      const { data: cardPayments } = await supabase
        .from('credit_card_bill_payments')
        .select('amount, credit_card_id, payment_date, bill_competence')
        .not('credit_card_id', 'is', null)

      const newAlerts: typeof cardBillAlerts = []

      for (const card of creditCards) {
        if (card.is_active === false) continue

        for (const comp of competences) {
          const cycle = cycleMap[`${card.id}:${comp}`]
          const closingDay = cycle?.closing_day ?? card.closing_day
          const dueDay = cycle?.due_day ?? card.due_day

          const [y, m] = comp.split('-').map(Number)
          const compMonthIndex = m - 1
          
          const getSafeDateLocal = (year: number, month: number, day: number) => {
            const lastDay = new Date(year, month + 1, 0).getDate()
            const clamped = Math.min(day, lastDay)
            return new Date(year, month, clamped)
          }

          const dueDate = getSafeDateLocal(y, compMonthIndex, dueDay)
          dueDate.setHours(0, 0, 0, 0)

          let closingDate = getSafeDateLocal(y, compMonthIndex, closingDay)
          if (closingDay >= dueDay) {
            closingDate = getSafeDateLocal(y, compMonthIndex - 1, closingDay)
          }
          closingDate.setHours(0, 0, 0, 0)

          const resolveClosingDayLocal = (cid: string, c: string) => {
            const rowCycle = cycleMap[`${cid}:${c}`]
            return rowCycle?.closing_day ?? card.closing_day
          }

          const cardExpensesFiltered = (cardExpenses || []).filter((exp) => {
            if (exp.credit_card_id !== card.id) return false
            if (exp.bill_competence) return exp.bill_competence === comp
            
            const expComp = resolveBillCompetence(exp.date, (c) => resolveClosingDayLocal(card.id, c))
            return expComp === comp
          })

          const totalPrevisto = cardExpensesFiltered.reduce((sum, exp) => {
            return sum + (exp.amount * (exp.report_weight ?? 1))
          }, 0)

          if (totalPrevisto <= 0.009) continue

          const cardPaymentsFiltered = (cardPayments || []).filter((pay) => {
            if (pay.credit_card_id !== card.id) return false
            if (pay.bill_competence) return pay.bill_competence === comp

            const payComp = resolveBillCompetence(pay.payment_date, (c) => resolveClosingDayLocal(card.id, c))
            return payComp === comp
          })

          const totalPago = cardPaymentsFiltered.reduce((sum, pay) => sum + pay.amount, 0)
          const saldoAberto = totalPrevisto - totalPago

          if (saldoAberto <= 0.009) continue

          if (todayTime > dueDate.getTime()) {
            newAlerts.push({
              cardName: card.name,
              type: 'overdue',
              dueDate: format(dueDate, 'yyyy-MM-dd'),
              amount: saldoAberto,
              cardId: card.id,
            })
          } else {
            const diffTime = dueDate.getTime() - todayTime
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            if (diffDays >= 0 && diffDays <= remindersDaysBeforeCardBills) {
              newAlerts.push({
                cardName: card.name,
                type: 'near_due',
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                amount: saldoAberto,
                cardId: card.id,
              })
            }
          }
        }
      }

      setCardBillAlerts(newAlerts)
    } catch (err) {
      logger.error('Error calculating card bill alerts:', err)
    }
  }, [isOnline, creditCards, remindersDaysBeforeCardBills])

  useEffect(() => {
    const onDataChanged = () => {
      if (isOnline) {
        void loadCardBillAlerts()
      }
    }

    if (isOnline) {
      void loadCardBillAlerts()
    } else {
      setCardBillAlerts([])
    }

    window.addEventListener('local-data-changed', onDataChanged)
    return () => window.removeEventListener('local-data-changed', onDataChanged)
  }, [isOnline, loadCardBillAlerts])

  const debtAlerts = useMemo(() => {
    if (!remindersEnabled) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const daysFromNow = new Date()
    daysFromNow.setDate(today.getDate() + remindersDaysBeforeDebts)
    daysFromNow.setHours(0, 0, 0, 0)
    const daysFromNowStr = format(daysFromNow, 'yyyy-MM-dd')

    return debts
      .filter((d) => d.status === 'pending')
      .map((d) => {
        let type: 'overdue' | 'near_due' = 'near_due'
        if (d.due_date < todayStr) {
          type = 'overdue'
        } else if (d.due_date >= todayStr && d.due_date <= daysFromNowStr) {
          type = 'near_due'
        } else {
          return null
        }
        return {
          id: d.id,
          name: d.name,
          type,
          dueDate: d.due_date,
          amount: d.amount,
          debtType: d.type,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [debts, remindersEnabled, remindersDaysBeforeDebts, todayStr])

  const activeCardBillAlerts = useMemo(() => {
    return remindersEnabled ? cardBillAlerts : []
  }, [cardBillAlerts, remindersEnabled])

  const combinedAlerts = useMemo(() => {
    const alertsList: AlertItem[] = []

    activeCardBillAlerts.forEach((alert) => {
      alertsList.push({
        id: `card-${alert.cardId}-${alert.dueDate}`,
        title: `Fatura do Cartão ${alert.cardName}`,
        dueDate: alert.dueDate,
        amount: alert.amount,
        isOverdue: alert.type === 'overdue',
        isCard: true,
      })
    })

    debtAlerts.forEach((alert) => {
      const prefix = alert.debtType === 'payable' ? 'Conta a pagar' : 'Cobrança a receber'
      alertsList.push({
        id: `debt-${alert.id}`,
        title: `${prefix}: ${alert.name}`,
        dueDate: alert.dueDate,
        amount: alert.amount,
        isOverdue: alert.type === 'overdue',
        isCard: false,
        debtType: alert.debtType,
      })
    })

    // Filter out read alerts or snoozed alerts
    const filteredList = alertsList.filter((alert) => {
      if (readAlerts.includes(alert.id)) {
        return false
      }

      const isSnoozed = snoozedAlerts.includes(alert.id)
      const isDueOrOverdue = alert.isOverdue || alert.dueDate <= todayStr

      if (isSnoozed && !isDueOrOverdue) {
        return false
      }
      return true
    })

    return filteredList.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [activeCardBillAlerts, debtAlerts, snoozedAlerts, readAlerts, todayStr])

  return (
    <NotificationsContext.Provider
      value={{
        combinedAlerts,
        remindersEnabled: remindersEnabled || false,
        isMobileAlertsOpen,
        setIsMobileAlertsOpen,
        isDesktopAlertsOpen,
        setIsDesktopAlertsOpen,
        snoozeAlert,
        markAsRead,
        todayStr,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
