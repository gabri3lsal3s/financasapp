import ConfirmModal from '@/components/ConfirmModal'
import Input from '@/components/Input'
import { AlertTriangle } from 'lucide-react'
import type { UseSettingsSecurityReturn } from '@/hooks/useSettingsSecurity'
import type { UseSettingsAdminReturn } from '@/hooks/useSettingsAdmin'

interface SettingsModalsProps {
  security: UseSettingsSecurityReturn
  admin: UseSettingsAdminReturn
}

/**
 * SettingsModals — modais de confirmação da página Configurações (extraídos
 * de Settings.tsx): exclusão da própria conta e exclusão de usuário (admin).
 */
export default function SettingsModals({ security, admin }: SettingsModalsProps) {
  const {
    isDeleteModalOpen,
    deletingAccount,
    deleteConfirmationText,
    handleDeleteAccount,
    setDeleteConfirmationText,
    setIsDeleteModalOpen,
  } = security

  const {
    userToDelete,
    deletingUser,
    deleteUserConfirmEmail,
    handleDeleteUser,
    setDeleteUserConfirmEmail,
    closeDeleteUserModal,
  } = admin

  return (
    <>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => !deletingAccount && setIsDeleteModalOpen(false)}
        title="Confirmar exclusão de conta"
        layout="stacked"
        confirmLabel={deletingAccount ? 'Excluindo...' : 'Sim, excluir minha conta permanentemente'}
        confirmVariant="danger"
        confirmDisabled={deleteConfirmationText !== 'DELETAR'}
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
        cancelLabel="Cancelar e voltar"
      >
        <div className="modal-alert modal-alert--danger">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <div className="text-sm text-primary">
            <p className="font-bold">Atenção!</p>
            <p className="mt-1">
              Você está prestes a excluir permanentemente sua conta e todos os dados associados a ela.
              Esta ação é irreversível.
            </p>
          </div>
        </div>

        <div className="modal-field-group">
          <p className="text-sm leading-relaxed text-primary">
            Para confirmar que deseja prosseguir com a exclusão total dos seus dados, digite{' '}
            <strong className="text-[var(--color-danger)]">DELETAR</strong> no campo abaixo:
          </p>
          <Input
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value.toUpperCase())}
            placeholder="Digite DELETAR aqui"
            autoFocus
            disabled={deletingAccount}
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={userToDelete !== null}
        onClose={() => !deletingUser && closeDeleteUserModal()}
        title="Excluir usuário do sistema"
        layout="stacked"
        confirmLabel={deletingUser ? 'Excluindo usuário...' : 'Excluir usuário permanentemente'}
        confirmVariant="danger"
        confirmDisabled={
          userToDelete
            ? deleteUserConfirmEmail.trim().toLowerCase() !== userToDelete.email.toLowerCase()
            : true
        }
        loading={deletingUser}
        onConfirm={handleDeleteUser}
      >
        {userToDelete ? (
          <>
            <div className="modal-alert modal-alert--danger">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <div className="text-sm text-primary">
                <p className="font-bold">Ação irreversível</p>
                <p className="mt-1">
                  A conta <strong>{userToDelete.email}</strong> será removida permanentemente,
                  incluindo lançamentos, categorias, cartões e carteira de investimentos vinculada.
                </p>
              </div>
            </div>

            <div className="modal-field-group">
              <p className="text-sm leading-relaxed text-primary">Digite o e-mail do usuário para confirmar:</p>
              <Input
                value={deleteUserConfirmEmail}
                onChange={(e) => setDeleteUserConfirmEmail(e.target.value)}
                placeholder={userToDelete.email}
                autoFocus
                disabled={deletingUser}
              />
            </div>
          </>
        ) : null}
      </ConfirmModal>
    </>
  )
}
