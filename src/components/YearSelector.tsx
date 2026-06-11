import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import IconButton from '@/components/IconButton'
import Button from '@/components/Button'
import Modal from './Modal'
import ModalFooter from './ModalFooter'
import { cn } from '@/lib/utils'

interface YearSelectorProps {
  value: number
  onChange: (year: number) => void
  availableYears: number[]
  className?: string
}

export default function YearSelector({
  value,
  onChange,
  availableYears,
  className = '',
}: YearSelectorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // Ordena os anos em ordem decrescente para exibição, mas crescente para limites
  const yearsSortedDesc = [...availableYears].sort((a, b) => b - a)
  const minYear = availableYears.length > 0 ? Math.min(...availableYears) : value
  const maxYear = availableYears.length > 0 ? Math.max(...availableYears) : value

  const canNavigatePrev = value > minYear
  const canNavigateNext = value < maxYear

  const handlePrevYear = () => {
    if (canNavigatePrev) {
      onChange(value - 1)
    }
  }

  const handleNextYear = () => {
    if (canNavigateNext) {
      onChange(value + 1)
    }
  }

  const handleSelectYear = (year: number) => {
    onChange(year)
    setIsPickerOpen(false)
  }

  return (
    <>
      <div className={cn('flex items-center justify-between', className)}>
        <div className="flex h-10 w-10 items-center justify-center">
          {canNavigatePrev ? (
            <IconButton
              size="sm"
              icon={<ChevronLeft size={18} className="text-primary" />}
              label="Ano anterior"
              onClick={handlePrevYear}
            />
          ) : null}
        </div>

        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="group rounded-lg px-3 py-1 transition-colors hover:bg-accent flex items-center gap-1.5"
            aria-label="Abrir seletor de ano"
          >
            <span className="text-base font-semibold text-primary sm:text-lg">
              {value}
            </span>
          </button>
          <div className="flex h-4 items-center justify-center">
            <span className="text-[10px] text-secondary font-medium select-none uppercase tracking-wider opacity-60">
              Visualização Anual
            </span>
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center">
          {canNavigateNext ? (
            <IconButton
              size="sm"
              icon={<ChevronRight size={18} className="text-primary" />}
              label="Próximo ano"
              onClick={handleNextYear}
            />
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="Selecionar Ano"
        size="sm"
        footer={<ModalFooter onCancel={() => setIsPickerOpen(false)} cancelLabel="Cancelar" />}
      >
        <div className="modal-body-stack">
          {yearsSortedDesc.length === 0 ? (
            <div className="p-4 text-center text-xs text-secondary/40 italic">
              Nenhum ano disponível
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {yearsSortedDesc.map((year) => {
                const isSelected = year === value
                return (
                  <Button
                    key={year}
                    type="button"
                    variant={isSelected ? 'secondary' : 'outline'}
                    onClick={() => handleSelectYear(year)}
                    className={`h-auto w-full py-4 text-sm font-bold ${
                      isSelected ? 'scale-[1.02]' : ''
                    }`}
                  >
                    {year}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
