/**
 * useClientManagement
 * WHY: Centraliza o CRUD de clientes (carregar lista, criar, excluir, vincular)
 *      que antes vivia inline no ConsultantDashboard com ~200 linhas.
 *      Ao isolar aqui, o dashboard se torna agnóstico em relação à gestão de perfis.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PROFILE_SELECT_COLUMNS } from '@/constants/profileSelect'
import type { Profile, Portfolio } from '@/types'
import { isPrimaryAdminProfile } from '@/constants/adminProfile'
import {
  buildProvisionalClientEmail,
  isProvisionalClientEmail,
} from '@/constants/provisionalClient'
import toast from 'react-hot-toast'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PortfolioTransactionInsert = {
  id: string
  portfolio_id: string
  ticker: string
  operation_type: 'buy'
  quantity: number
  price: number
  date: string
}

function parseJoinedProfile(raw: unknown): Profile | null {
  if (!raw) return null
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object' || !('id' in obj)) return null
  return obj as Profile
}

async function ensurePersonalPortfolio(userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('portfolios')
    .select('id')
    .eq('client_id', userId)
    .maybeSingle()
  if (existing) return
  const { error } = await supabase
    .from('portfolios')
    .insert({ client_id: userId, cash_balance: 0.0 })
  if (error && error.code !== '23505') throw error
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseClientManagementReturn {
  clients: Profile[]
  loadingClients: boolean
  creatingClient: boolean
  deletingClient: boolean
  eligibleClients: Profile[]
  loadingEligible: boolean
  linking: boolean
  loadClients: () => Promise<void>
  handleCreateClient: (
    name: string,
    email: string,
    onSuccess: (clientId: string) => void,
  ) => Promise<void>
  handleDeleteClient: (
    clientToDelete: Profile,
    confirmEmail: string,
    onSuccess: (deletedId: string) => void,
  ) => Promise<void>
  handleLinkClient: (
    portfolio: Portfolio,
    provisionalClientId: string,
    realClientId: string,
    onSuccess: (newClientId: string) => void,
  ) => Promise<void>
  loadEligibleClients: () => Promise<Profile[]>
}

export function useClientManagement(): UseClientManagementReturn {
  const { user } = useAuth()

  const [clients, setClients] = useState<Profile[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [creatingClient, setCreatingClient] = useState(false)
  const [deletingClient, setDeletingClient] = useState(false)
  const [eligibleClients, setEligibleClients] = useState<Profile[]>([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [linking, setLinking] = useState(false)

  // ── Carregar lista de clientes ────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoadingClients(true)

      const [{ data: managedPorts, error: managedErr }, { data: selfProfile, error: selfErr }] =
        await Promise.all([
          supabase
            .from('portfolios')
            .select('client:profiles!client_id(*)')
            .eq('consultant_id', user.id),
          supabase
            .from('profiles')
            .select(PROFILE_SELECT_COLUMNS)
            .eq('id', user.id)
            .maybeSingle(),
        ])

      if (managedErr) throw managedErr
      if (selfErr) throw selfErr

      await ensurePersonalPortfolio(user.id)

      const clientList: Profile[] = []
      const seenIds = new Set<string>()

      if (selfProfile && !seenIds.has(selfProfile.id)) {
        clientList.push(selfProfile)
        seenIds.add(selfProfile.id)
      }

      for (const port of managedPorts || []) {
        const clientObj = parseJoinedProfile(port.client)
        if (clientObj && clientObj.role === 'client' && !seenIds.has(clientObj.id)) {
          clientList.push(clientObj)
          seenIds.add(clientObj.id)
        }
      }

      clientList.sort((a, b) => {
        if (a.id === user.id) return -1
        if (b.id === user.id) return 1
        return (a.email || '').localeCompare(b.email || '')
      })

      setClients(clientList)
    } catch (err) {
      console.error('[useClientManagement] loadClients:', err)
      toast.error('Erro ao buscar lista de clientes')
    } finally {
      setLoadingClients(false)
    }
  }, [user?.id])

  // ── Clientes reais elegíveis para vinculação ──────────────────────────────
  const loadEligibleClients = useCallback(async (): Promise<Profile[]> => {
    try {
      setLoadingEligible(true)

      const [{ data: profilesData, error: profilesErr }, { data: portfoliosData, error: portsErr }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select(PROFILE_SELECT_COLUMNS)
            .eq('role', 'client')
            .not('email', 'like', 'temp_%')
            .order('email'),
          supabase.from('portfolios').select('client_id'),
        ])

      if (profilesErr) throw profilesErr
      if (portsErr) throw portsErr

      const takenIds = new Set((portfoliosData || []).map((p) => p.client_id))
      const eligible = (profilesData || []).filter((p) => !takenIds.has(p.id))
      setEligibleClients(eligible)
      return eligible
    } catch (err) {
      console.error('[useClientManagement] loadEligibleClients:', err)
      toast.error('Erro ao carregar contas de clientes reais')
      return []
    } finally {
      setLoadingEligible(false)
    }
  }, [])

  // ── Criar novo cliente ────────────────────────────────────────────────────
  const handleCreateClient = useCallback(
    async (
      name: string,
      email: string,
      onSuccess: (clientId: string) => void,
    ) => {
      setCreatingClient(true)
      try {
        const tempId = crypto.randomUUID()
        let clientEmail = email.trim()

        if (!clientEmail) {
          const cleanName = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
          const randId = Math.random().toString(36).substring(2, 8)
          clientEmail = buildProvisionalClientEmail(cleanName, randId)
        }

        let targetClientId = tempId

        const { data: existing } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT_COLUMNS)
          .eq('email', clientEmail)
          .maybeSingle()

        if (existing) {
          targetClientId = existing.id

          if (
            existing.role !== 'client' &&
            existing.id !== user?.id &&
            !isPrimaryAdminProfile(existing)
          ) {
            const { error: roleErr } = await supabase
              .from('profiles')
              .update({ role: 'client' })
              .eq('id', existing.id)
            if (roleErr) throw roleErr
          }

          let { data: portData } = await supabase
            .from('portfolios')
            .select('*')
            .eq('client_id', existing.id)
            .maybeSingle()

          if (!portData) {
            const { data: newPort, error: createErr } = await supabase
              .from('portfolios')
              .insert({ client_id: existing.id, consultant_id: user?.id, cash_balance: 0.0 })
              .select()
              .single()
            if (createErr) throw createErr
            portData = newPort
          } else {
            const { data: updatedPort, error: updateErr } = await supabase
              .from('portfolios')
              .update({ consultant_id: user?.id })
              .eq('id', portData.id)
              .select()
              .single()
            if (updateErr) throw updateErr
            portData = updatedPort
          }

          await migrateOldInvestments(existing.id, portData as Portfolio)
          toast.success('E-mail cadastrado encontrado! Ativos importados e conta vinculada.')
        } else {
          const trimmedName = name.trim()
          const { error: profileErr } = await supabase
            .from('profiles')
            .insert({
              id: tempId,
              email: clientEmail,
              full_name: trimmedName || null,
              role: 'client',
              is_approved: true,
            })

          if (profileErr) throw profileErr

          await supabase
            .from('portfolios')
            .update({ consultant_id: user?.id })
            .eq('client_id', tempId)

          toast.success('Cliente cadastrado com sucesso!')
        }

        await loadClients()
        onSuccess(targetClientId)
      } catch (err) {
        console.error('[useClientManagement] handleCreateClient:', err)
        toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar cliente')
      } finally {
        setCreatingClient(false)
      }
    },
    [user?.id, loadClients],
  )

  // ── Excluir / desvincular cliente ─────────────────────────────────────────
  const handleDeleteClient = useCallback(
    async (
      clientToDelete: Profile,
      confirmEmail: string,
      onSuccess: (deletedId: string) => void,
    ) => {
      if (confirmEmail.trim() !== clientToDelete.email) {
        toast.error('O e-mail digitado não corresponde ao e-mail do cliente.')
        return
      }

      setDeletingClient(true)
      try {
        const isProvisional = isProvisionalClientEmail(clientToDelete.email)

        if (isProvisional) {
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', clientToDelete.id)
          if (error) throw error
          toast.success('Cliente provisório e sua respectiva carteira excluídos com sucesso!')
        } else {
          const { error } = await supabase
            .from('portfolios')
            .update({ consultant_id: null })
            .eq('client_id', clientToDelete.id)
          if (error) throw error
          toast.success('Cliente real desvinculado com sucesso! Os investimentos continuam intactos.')
        }

        await loadClients()
        onSuccess(clientToDelete.id)
      } catch (err) {
        console.error('[useClientManagement] handleDeleteClient:', err)
        toast.error(err instanceof Error ? err.message : 'Falha ao processar exclusão')
      } finally {
        setDeletingClient(false)
      }
    },
    [loadClients],
  )

  // ── Vincular carteira provisória a usuário real ───────────────────────────
  const handleLinkClient = useCallback(
    async (
      portfolio: Portfolio,
      provisionalClientId: string,
      realClientId: string,
      onSuccess: (newClientId: string) => void,
    ) => {
      setLinking(true)
      try {
        const { error: updateErr } = await supabase
          .from('portfolios')
          .update({ client_id: realClientId })
          .eq('id', portfolio.id)
        if (updateErr) throw updateErr

        const { error: deleteErr } = await supabase
          .from('profiles')
          .delete()
          .eq('id', provisionalClientId)
        if (deleteErr) {
          console.error('[useClientManagement] Erro ao deletar perfil temporário:', deleteErr)
        }

        toast.success('Carteira vinculada com sucesso!')
        await loadClients()
        onSuccess(realClientId)
      } catch (err) {
        console.error('[useClientManagement] handleLinkClient:', err)
        toast.error('Erro ao vincular a carteira patrimonial')
      } finally {
        setLinking(false)
      }
    },
    [loadClients],
  )

  return {
    clients,
    loadingClients,
    creatingClient,
    deletingClient,
    eligibleClients,
    loadingEligible,
    linking,
    loadClients,
    handleCreateClient,
    handleDeleteClient,
    handleLinkClient,
    loadEligibleClients,
  }
}

// ─── Utilitário interno: migrar investimentos legados ────────────────────────

async function migrateOldInvestments(userId: string, portData: Portfolio): Promise<void> {
  const { data: userInvestments } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)

  if (!userInvestments || userInvestments.length === 0) return

  let extraCash = 0
  const txsToInsert: PortfolioTransactionInsert[] = []
  const investmentsToUpdate: { id: string; transaction_id: string }[] = []

  for (const inv of userInvestments) {
    if (inv.ticker && inv.quantity && inv.price && !inv.transaction_id) {
      const dateStr = inv.month
        ? `${inv.month}-01`
        : new Date(inv.created_at).toISOString().split('T')[0]
      const txId = crypto.randomUUID()
      txsToInsert.push({
        id: txId,
        portfolio_id: portData.id,
        ticker: inv.ticker.toUpperCase().trim(),
        operation_type: 'buy',
        quantity: Number(inv.quantity),
        price: Number(inv.price),
        date: dateStr,
      })
      investmentsToUpdate.push({ id: inv.id, transaction_id: txId })
    } else if (!inv.ticker && !inv.transaction_id) {
      extraCash += Number(inv.amount)
    }
  }

  if (txsToInsert.length > 0) {
    const { error: txsErr } = await supabase
      .from('portfolio_transactions')
      .insert(txsToInsert)
    if (txsErr) throw txsErr
    for (const item of investmentsToUpdate) {
      await supabase
        .from('investments')
        .update({ transaction_id: item.transaction_id })
        .eq('id', item.id)
    }
  }

  if (extraCash > 0) {
    const newCash = Number(portData.cash_balance) + extraCash
    const { error: cashErr } = await supabase
      .from('portfolios')
      .update({ cash_balance: newCash })
      .eq('id', portData.id)
    if (cashErr) throw cashErr
  }
}
