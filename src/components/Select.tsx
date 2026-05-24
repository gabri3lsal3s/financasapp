import { useState, useRef, useEffect, forwardRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface SelectProps {
  label?: string
  error?: string
  value: string
  onChange: (e: { target: { value: string, name?: string } }) => void
  options: { value: string; label: string; sublabel?: string }[]
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
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (val: string) => {
      if (disabled) return
      onChange({ target: { value: val, name } })
      setIsOpen(false)
    }

    return (
      <div className={`w-full ${className}`} ref={containerRef}>
        {label && (
          <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-1.5 opacity-60 ml-1">
            {label} {required && <span className="text-danger">*</span>}
          </label>
        )}
        
        <div className={`relative ${isOpen ? 'z-30' : ''}`} ref={ref}>
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              onClick?.(e)
              if (!disabled) setIsOpen(!isOpen)
            }}
            className={`
              w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 text-sm font-medium
              ${isOpen 
                ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-lg shadow-primary/10' 
                : 'border-primary/20 bg-primary hover:bg-tertiary shadow-none'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
              ${error ? 'border-danger/50' : ''}
            `}
          >
            <span className={`min-w-0 flex-1 text-left ${!selectedOption ? 'text-secondary/40' : 'text-primary'}`}>
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
                placeholder
              )}
            </span>
            <ChevronDown 
              size={18} 
              className={`text-secondary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {isOpen && (
            <div className="absolute z-[1000] w-full mt-2 bg-primary border border-primary rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5">
                {options.length === 0 ? (
                  <div className="p-4 text-center text-xs text-secondary/40 italic">Nenhuma opção disponível</div>
                ) : (
                  options.map((option) => {
                    const isSelected = option.value === value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all mb-0.5 last:mb-0
                          ${isSelected 
                            ? 'bg-primary/10 text-primary font-bold' 
                            : 'text-secondary hover:bg-tertiary hover:text-primary'
                          }
                        `}
                      >
                        <span className="min-w-0 flex-1 text-left pr-4">
                          {option.sublabel ? (
                            <span className="flex flex-col min-w-0">
                              <span className="truncate font-medium leading-tight">{option.label}</span>
                              <span className="truncate text-[10px] font-normal text-secondary/70 font-mono leading-tight">
                                {option.sublabel}
                              </span>
                            </span>
                          ) : (
                            <span className="truncate block">{option.label}</span>
                          )}
                        </span>
                        {isSelected && <Check size={14} className="shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
        
        {error && <p className="mt-1.5 text-[10px] font-bold text-danger ml-1">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
