import { useMemo, useState } from 'react'
import { Check, LayoutDashboard, Search, UserRound } from 'lucide-react'
import Modal from '@/components/Modal'
import ModalFooter from '@/components/ModalFooter'
import Input from '@/components/Input'
import type { Profile } from '@/types'
import { cn } from '@/lib/utils'
import { profileSelectSublabel, resolveProfileDisplayName } from '@/utils/profileDisplayName'
import { isProvisionalClientEmail } from '@/constants/provisionalClient'

interface ClientPickerModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Profile[]
  value: string
  onChange: (clientId: string) => void
  selfUserId?: string
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

export default function ClientPickerModal({
  isOpen,
  onClose,
  clients,
  value,
  onChange,
  selfUserId,
}: ClientPickerModalProps) {
  const [query, setQuery] = useState('')

  const filteredClients = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    if (!normalizedQuery) return clients

    return clients.filter((client) => {
      const name = resolveProfileDisplayName(client).toLowerCase()
      const email = (client.email ?? '').toLowerCase()
      return name.includes(normalizedQuery) || email.includes(normalizedQuery)
    })
  }, [clients, query])

  const handleSelect = (clientId: string) => {
    onChange(clientId)
    setQuery('')
    onClose()
  }

  const handleClose = () => {
    setQuery('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Selecionar Cliente"
      size="md"
      footer={<ModalFooter onCancel={handleClose} cancelLabel="Fechar" />}
    >
      <div className="modal-body-stack">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar cliente"
            className="pl-9"
          />
        </div>

        <div className="modal-panel-glass max-h-[min(52vh,24rem)] overflow-y-auto overscroll-contain p-2 space-y-1.5">
          <button
            type="button"
            onClick={() => handleSelect('')}
            className={cn(
              'modal-picker-row',
              value === '' ? 'modal-picker-row--balance-selected' : undefined
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-balance/10 text-balance">
              <LayoutDashboard size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary">Visão Geral</p>
              <p className="text-[11px] text-secondary">Consolidação de toda a consultoria</p>
            </div>
            {value === '' ? <Check size={18} className="shrink-0 text-balance" aria-hidden /> : null}
          </button>

          {filteredClients.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-secondary italic">
              Nenhum cliente encontrado para &quot;{query.trim()}&quot;.
            </p>
          ) : (
            filteredClients.map((client) => {
              const isSelected = client.id === value
              const isSelf = client.id === selfUserId
              const isProvisional = client.email ? isProvisionalClientEmail(client.email) : false

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client.id)}
                  className={cn('modal-picker-row', isSelected && 'modal-picker-row--selected')}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-secondary">
                    <UserRound size={18} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primary">
                      {resolveProfileDisplayName(client)}
                      {isSelf ? ' (Você)' : ''}
                    </p>
                    <p className="truncate text-[11px] font-mono text-secondary">
                      {profileSelectSublabel(client, { selfUserId })}
                    </p>
                    {isProvisional ? (
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Conta provisória
                      </p>
                    ) : null}
                  </div>
                  {isSelected ? <Check size={18} className="shrink-0 text-primary" aria-hidden /> : null}
                </button>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
