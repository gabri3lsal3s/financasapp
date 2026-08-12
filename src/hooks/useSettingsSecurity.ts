import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/utils/errorMessage'
import {
  registerBiometric,
  removeBiometricCredential,
} from '@/utils/biometric'
import { logger } from '@/utils/logger'
import type { User } from '@supabase/supabase-js'

export interface BiometricStatus {
  type: 'success' | 'error'
  message: string
}

/**
 * useSettingsSecurity — lógica da aba Segurança da página Configurações
 * (extraída de Settings.tsx). Registro/remoção de biometria (WebAuthn) e
 * exclusão da própria conta via RPC.
 */
export function useSettingsSecurity(user: User | null | undefined) {
  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricRegistered, setBiometricRegistered] = useState(false)
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null)
  const [biometricLoading, setBiometricLoading] = useState(false)

  // Account deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const handleRegisterBiometric = async () => {
    if (!user) return
    setBiometricLoading(true)
    setBiometricStatus(null)
    const result = await registerBiometric(user.id, user.email ?? '')
    setBiometricLoading(false)
    if (result.success) {
      setBiometricRegistered(true)
      setBiometricStatus({ type: 'success', message: 'Biometria registrada com sucesso! Você pode usar na próxima entrada.' })
    } else {
      if (result.error !== 'CANCELLED') {
        setBiometricStatus({ type: 'error', message: result.error ?? 'Falha no registro.' })
      }
    }
  }

  const handleRemoveBiometric = () => {
    removeBiometricCredential()
    setBiometricRegistered(false)
    setBiometricStatus({ type: 'success', message: 'Biometria removida deste dispositivo.' })
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmationText !== 'DELETAR') return

    setDeletingAccount(true)
    try {
      // 1. Chamar o RPC para excluir o usuário (deve ser configurado no Supabase pelo ADM primeiro)
      const { error } = await supabase.rpc('delete_own_account')

      if (error) throw error

      // 2. Se o RPC funcionou, limpar caches locais e sair
      localStorage.clear() // Limpa tudo inclusive queues e temas
      await supabase.auth.signOut()

      // 3. Redirecionar será automático pelo ProtectedRoute ao perder a sessão
      alert('Sua conta e todos os dados foram excluídos permanentemente.')
    } catch (err: unknown) {
      logger.error('Error deleting account:', err)
      alert(`Erro ao excluir conta: ${getErrorMessage(err, 'Verifique se a função do banco de dados foi configurada.')}`)
    } finally {
      setDeletingAccount(false)
      setIsDeleteModalOpen(false)
      setDeleteConfirmationText('')
    }
  }

  return {
    biometricAvailable,
    biometricRegistered,
    biometricStatus,
    biometricLoading,
    isDeleteModalOpen,
    deleteConfirmationText,
    deletingAccount,
    setIsDeleteModalOpen,
    setDeleteConfirmationText,
    setBiometricAvailable,
    setBiometricRegistered,
    handleRegisterBiometric,
    handleRemoveBiometric,
    handleDeleteAccount,
  }
}

export type UseSettingsSecurityReturn = ReturnType<typeof useSettingsSecurity>

