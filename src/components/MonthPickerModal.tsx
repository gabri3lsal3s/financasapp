import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '@/components/Button'
import Modal from './Modal'
import ModalFooter from './ModalFooter'

interface MonthPickerModalProps {
  isOpen: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  title?: string
  showLiveOption?: boolean
}

export default function MonthPickerModal({
  isOpen,
  onClose,
  value,
  onChange,
  title = 'Selecionar Mês',
  showLiveOption = false,
}: MonthPickerModalProps) {
  const [year, month] = value ? value.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
  const [viewYear, setViewYear] = useState(year)

  const months = [
    { name: 'Jan', value: 1 }, { name: 'Fev', value: 2 }, { name: 'Mar', value: 3 },
    { name: 'Abr', value: 4 }, { name: 'Mai', value: 5 }, { name: 'Jun', value: 6 },
    { name: 'Jul', value: 7 }, { name: 'Ago', value: 8 }, { name: 'Set', value: 9 },
    { name: 'Out', value: 10 }, { name: 'Nov', value: 11 }, { name: 'Dez', value: 12 },
  ]

  const handleSelect = (m: number) => {
    const formattedMonth = String(m).padStart(2, '0')
    onChange(`${viewYear}-${formattedMonth}`)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={<ModalFooter onCancel={onClose} cancelLabel="Cancelar" />}
    >
      <div className="modal-body-stack">
        <div className="modal-panel-glass flex items-center justify-between p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewYear(viewYear - 1)}
            className="h-9 w-9 min-h-9 p-0"
            aria-label="Ano anterior"
          >
            <ChevronLeft size={20} aria-hidden />
          </Button>
          <span className="text-xl font-black text-primary tracking-tighter">{viewYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewYear(viewYear + 1)}
            className="h-9 w-9 min-h-9 p-0"
            aria-label="Próximo ano"
          >
            <ChevronRight size={20} aria-hidden />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {months.map((m) => {
            const isSelected = year === viewYear && month === m.value
            return (
              <Button
                key={m.value}
                type="button"
                variant={isSelected ? 'secondary' : 'outline'}
                onClick={() => handleSelect(m.value)}
                className={`h-auto w-full py-4 text-sm font-bold ${isSelected ? 'scale-[1.02]' : ''}`}
              >
                {m.name}
              </Button>
            )
          })}
        </div>

        {showLiveOption ? (
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={() => {
              onChange('live')
              onClose()
            }}
            className="py-3 text-[10px] font-black uppercase tracking-widest"
          >
            Copiar para Posição Atual (Live)
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
