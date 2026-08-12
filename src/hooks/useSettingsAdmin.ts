import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PROFILE_SELECT_COLUMNS } from '@/constants/profileSelect'
import { ADMIN_EMAIL, isPrimaryAdminEmail } from '@/constants/adminProfile'
import { logger } from '@/utils/logger'
import type { Profile } from '@/types'
import toast from 'react-hot-toast'

/**
 * useSettingsAdmin — lógica do painel administrativo da página Configurações
 * (extraída de Settings.tsx). Lista usuários, aprova/bloqueia/recusa/exclui
 * contas e gerencia o modal de exclusão de usuário.
 */
export function useSettingsAdmin(isAdmin: boolean, currentUserId: string | undefined) {
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [adminLoading, setAdminLoading] = useState(false)

  // Admin user deletion state
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null)
  const [deleteUserConfirmEmail, setDeleteUserConfirmEmail] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)

  const fetchUsers = async () => {
    if (!isAdmin) return
    setAdminLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('is_admin', false)
        .neq('email', ADMIN_EMAIL)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAllUsers(data || [])
    } catch (err) {
      logger.error('Error fetching users:', err)
    } finally {
      setAdminLoading(false)
    }
  }

  const handleUpdateUserStatus = async (userId: string, isApproved: boolean, isBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_approved: isApproved,
          is_blocked: isBlocked,
          is_rejected: false,
          rejection_count: 0 // Reseta o contador ao aprovar ou desbloquear manualmente
        })
        .eq('id', userId)

      if (error) throw error

      setAllUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, is_approved: isApproved, is_blocked: isBlocked, is_rejected: false, rejection_count: 0 } : u)
      )

    } catch (err) {
      logger.error('Error updating user status:', err)
      alert('Erro ao atualizar status do usuário.')
    }
  }

  const handleRejectUser = async (userId: string, isAlreadyApproved: boolean, currentRejectionCount: number = 0) => {
    if (isAlreadyApproved) {
      alert('Usuários já aprovados não podem ser recusados, apenas bloqueados.')
      return
    }

    if (!confirm('Deseja recusar esta solicitação? O usuário poderá tentar mais uma vez. Na segunda recusa, ele será bloqueado permanentemente.')) return

    try {
      const newCount = (currentRejectionCount || 0) + 1
      const shouldBlock = newCount >= 2

      const { error } = await supabase
        .from('profiles')
        .update({
          is_rejected: true,
          rejection_count: newCount,
          is_blocked: shouldBlock,
          is_approved: false
        })
        .eq('id', userId)

      if (error) throw error

      setAllUsers((prev) =>
        prev.map((u) => u.id === userId ? {
          ...u,
          is_rejected: true,
          rejection_count: newCount,
          is_blocked: shouldBlock,
          is_approved: false
        } : u)
      )
    } catch (err) {
      logger.error('Error rejecting user:', err)
      alert('Erro ao recusar usuário.')
    }
  }

  const openDeleteUserModal = (targetUser: Profile) => {
    if (isPrimaryAdminEmail(targetUser.email)) {
      toast.error('Não é permitido excluir o super administrador.')
      return
    }
    if (targetUser.id === currentUserId) {
      toast.error('Use a opção em Segurança para excluir sua própria conta.')
      return
    }
    setUserToDelete(targetUser)
    setDeleteUserConfirmEmail('')
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    if (deleteUserConfirmEmail.trim().toLowerCase() !== userToDelete.email.toLowerCase()) {
      toast.error('O e-mail digitado não corresponde ao usuário selecionado.')
      return
    }

    setDeletingUser(true)
    const deletedEmail = userToDelete.email
    try {
      const { error } = await supabase.rpc('delete_user_by_admin', {
        target_user_id: userToDelete.id,
      })

      if (error) throw error

      setUserToDelete(null)
      setDeleteUserConfirmEmail('')
      await fetchUsers()
      toast.success(`Usuário ${deletedEmail} excluído permanentemente.`)
    } catch (err) {
      logger.error('Error deleting user:', err)
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Erro ao excluir usuário.'
      toast.error(message)
    } finally {
      setDeletingUser(false)
    }
  }

  return {
    allUsers,
    adminLoading,
    userToDelete,
    deleteUserConfirmEmail,
    deletingUser,
    setDeleteUserConfirmEmail,
    fetchUsers,
    handleUpdateUserStatus,
    handleRejectUser,
    openDeleteUserModal,
    handleDeleteUser,
    closeDeleteUserModal: () => setUserToDelete(null),
  }
}

export type UseSettingsAdminReturn = ReturnType<typeof useSettingsAdmin>

