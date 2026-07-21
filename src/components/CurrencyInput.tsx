import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  /** Valor numérico real (ex: 1234.56 para R$ 1.234,56). Pode ser null se vazio */
  value?: number | null
  /**
   * Callback disparado a cada digitação.
   * @param e Evento original do input
   * @param numericValue Valor numérico limpo (float) ou null se o campo foi limpo
   */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>, numericValue: number | null) => void
  label?: string
  error?: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
  name?: string
}

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/**
 * Formata um valor numérico para exibição no padrão brasileiro com moeda.
 * Ex: 1234.56 → "R$ 1.234,56" | 0 → "R$ 0,00" | null → ""
 */
function formatCurrencyDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return BRL_FORMATTER.format(value)
}

/**
 * Converte uma string de entrada (com formatação) para valor numérico centesimal.
 * Remove tudo que não é dígito, converte para inteiro e divide por 100.
 * Retorna null se não houver dígitos (campo vazio).
 * Ex: "R$ 1.234,56" → 1234.56 | "0" → 0 | "" → null
 */
function parseRawToNumeric(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const cents = parseInt(digits, 10)
  if (Number.isNaN(cents)) return null
  return cents / 100
}

/**
 * CurrencyInput — Input monetário com máscara reversa (estilo Nubank).
 *
 * Características:
 * - type="text" + inputMode="numeric" (teclado numérico no iOS/Android)
 * - Formatação em tempo real: "123456" → "R$ 1.234,56"
 * - Valor exibido inclui o símbolo "R$" via Intl.NumberFormat (style: currency)
 * - Recebe value numérico ou null (number | null) e emite onChange com (event, numericValue | null)
 * - Exibe "R$ 0,00" quando o valor é explicitamente 0
 * - Exibe placeholder quando o valor é null/undefined
 */
export default function CurrencyInput({
  value,
  onChange,
  label,
  error,
  helperText,
  placeholder = '0,00',
  disabled,
  required,
  className = '',
  id,
  name,
}: CurrencyInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)
  const prevValueRef = useRef(value)

  // Estado interno de exibição: string formatada (ex: "R$ 1.234,56") ou vazia
  const [displayValue, setDisplayValue] = useState<string>('')

  // Sincroniza displayValue com a prop value apenas quando realmente mudou
  useEffect(() => {
    if (prevValueRef.current === value) return
    prevValueRef.current = value

    if (value !== null && value !== undefined) {
      setDisplayValue(formatCurrencyDisplay(value))
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value

      // Extrai dígitos e converte para valor centesimal (ou null se vazio)
      const numericValue = parseRawToNumeric(raw)
      const formatted = formatCurrencyDisplay(numericValue)

      // Atualiza display local e referência
      setDisplayValue(formatted)
      prevValueRef.current = numericValue

      // Dispara callback com valor numérico limpo ou null
      onChange?.(e, numericValue)

      // Move cursor para o fim (comportamento Nubank)
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const len = formatted.length
          inputRef.current.setSelectionRange(len, len)
        }
      })
    },
    [onChange]
  )

  return (
    <div className="modal-field w-full">
      {label && (
        <Label htmlFor={inputId} className="block">
          {label}
        </Label>
      )}
      <div className="relative">
        <ShadcnInput
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          name={name}
          className={cn(
            'font-mono font-bold tabular-nums',
            error ? 'border-destructive' : '',
            className
          )}
          autoComplete="off"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-secondary opacity-80 mt-1">{helperText}</p>
      ) : null}
    </div>
  )
}
