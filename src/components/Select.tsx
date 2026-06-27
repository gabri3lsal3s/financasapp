import { forwardRef, useState, useCallback, useRef } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z_INDEX } from '@/constants/zIndex'

interface SelectProps {
  label?: string
  error?: string
  value: string
  onChange: (e: { target: { value: string; name?: string } }) => void
  options: { value: string; label: React.ReactNode; sublabel?: string }[]
  placeholder?: string
  name?: string
  className?: string
  disabled?: boolean
  required?: boolean
  onClick?: (e: React.MouseEvent) => void
}

const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ label, error, options, value, onChange, placeholder = 'Selecione...', name, className = '', disabled, required, onClick }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [openUpward, setOpenUpward] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    const selectedOption = options.find((opt) => opt.value === value)

    // WHY: calcula se há espaço abaixo do botão antes de abrir para decidir a direção
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (open && triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect()
          const spaceBelow = window.innerHeight - rect.bottom
          const spaceAbove = rect.top
          const dropdownHeight = Math.min(options.length * 44 + 12, 200)
          setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow)
        }
        setIsOpen(open)
      },
      [options.length],
    )

    // WHY: compatibilidade com onClick prop do Select legado
    const handleTriggerClick = (e: React.MouseEvent) => {
      onClick?.(e)
    }

    return (
      <div className={`modal-field w-full ${className}`} ref={containerRef}>
        {label && (
          <label className="block text-[10px] font-black text-secondary uppercase tracking-widest opacity-60 ml-1">
            {label} {required && <span className="text-danger">*</span>}
          </label>
        )}

        <SelectPrimitive.Root
          value={value}
          onValueChange={(val) => onChange({ target: { value: val, name } })}
          open={isOpen}
          onOpenChange={handleOpenChange}
          disabled={disabled}
        >
          <div className={`relative ${isOpen ? Z_INDEX.STICKY : ''}`} ref={ref}>
            <SelectPrimitive.Trigger
              ref={triggerRef}
              onClick={handleTriggerClick}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 text-sm font-medium surface-glass',
                isOpen
                  ? 'border-primary/30 ring-2 ring-primary/20 shadow-lg'
                  : 'border-glass hover:bg-tertiary/50 shadow-none',
                disabled && 'opacity-50 cursor-not-allowed grayscale',
                error && 'border-danger/50',
              )}
              aria-label={label || placeholder}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 text-left',
                  !selectedOption ? 'text-secondary/40' : 'text-primary',
                )}
              >
                {selectedOption ? (
                  selectedOption.sublabel ? (
                    <span className="flex flex-col min-w-0">
                      <span className="truncate font-medium leading-tight">{selectedOption.label}</span>
                      <span className="truncate text-[10px] font-normal text-secondary/80 font-mono leading-tight">
                        {selectedOption.sublabel}
                      </span>
                    </span>
                  ) : (
                    <span className="truncate block">{selectedOption.label}</span>
                  )
                ) : (
                  <SelectPrimitive.Value placeholder={placeholder} />
                )}
              </span>
              <SelectPrimitive.Icon asChild>
                <ChevronDown
                  size={18}
                  className={cn(
                    'text-secondary transition-transform duration-300',
                    isOpen && 'rotate-180',
                  )}
                />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>

            <SelectPrimitive.Portal>
              <SelectPrimitive.Content
                className={cn(
                  `relative ${Z_INDEX.MODAL} min-w-[var(--radix-select-trigger-width)] select-dropdown-solid rounded-2xl overflow-hidden`,
                  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                  openUpward ? 'bottom-full mb-2' : 'top-full mt-2',
                )}
                position="popper"
                side={openUpward ? 'top' : 'bottom'}
                align="start"
                sideOffset={4}
              >
                <div className="max-h-[min(15rem,45vh)] overflow-y-auto custom-scrollbar p-1.5">
                  {options.length === 0 ? (
                    <div className="p-4 text-center text-xs text-secondary/40 italic">
                      Nenhuma opção disponível
                    </div>
                  ) : (
                    options.map((option) => {
                      const isSelected = option.value === value
                      return (
                        <SelectPrimitive.Item
                          key={option.value}
                          value={option.value}
                          disabled={disabled}
                          className={cn(
                            'relative flex w-full cursor-default select-none items-center rounded-xl px-3 py-3 text-sm transition-all mb-0.5 last:mb-0 outline-none',
                            isSelected
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-secondary hover:bg-tertiary hover:text-primary',
                          )}
                        >
                          <span className="min-w-0 flex-1 text-left pr-4">
                            {option.sublabel ? (
                              <span className="flex flex-col min-w-0">
                                <SelectPrimitive.ItemText>
                                  <span className="truncate font-medium leading-tight">{option.label}</span>
                                </SelectPrimitive.ItemText>
                                <span className="truncate text-[10px] font-normal text-secondary/70 font-mono leading-tight">
                                  {option.sublabel}
                                </span>
                              </span>
                            ) : (
                              <SelectPrimitive.ItemText>
                                <span className="truncate block">{option.label}</span>
                              </SelectPrimitive.ItemText>
                            )}
                          </span>
                          {isSelected && (
                            <SelectPrimitive.ItemIndicator>
                              <Check size={14} className="shrink-0" />
                            </SelectPrimitive.ItemIndicator>
                          )}
                        </SelectPrimitive.Item>
                      )
                    })
                  )}
                </div>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </div>
        </SelectPrimitive.Root>

        {error && (
          <p className="mt-1.5 text-[10px] font-bold text-danger ml-1">{error}</p>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'

export default Select
