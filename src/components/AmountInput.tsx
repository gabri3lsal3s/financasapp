import { useCallback } from 'react'
import Input from '@/components/Input'
import { formatMoneyInput, parseMoneyInput } from '@/utils/format'

interface AmountInputProps {
  label?: string
  value: string
  onChange: (nextValue: string) => void
  onBlur?: (formattedValue: string) => void
  placeholder?: string
  helperText?: string
  error?: string
  required?: boolean
  disabled?: boolean
  /** ID HTML do input, gerado automaticamente se não fornecido */
  id?: string
}

/**
 * Input monetário com formatação automática no blur.
 *
 * Diferente do Input genérico, recebe e emite `string` simples (não ChangeEvent),
 * o que simplifica o uso em formulários financeiros onde o valor é sempre monetário.
 *
 * Formatação:
 * - Aceita entrada no formato "1234,56" ou "1234.56"
 * - No blur, formata para o padrão brasileiro: "1.234,56"
 * - Placeholder padrão: "0,00"
 */
export default function AmountInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder = '0,00',
  helperText,
  error,
  required,
  disabled,
  id,
}: AmountInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const handleBlur = useCallback(() => {
    const parsed = parseMoneyInput(value)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const formatted = formatMoneyInput(parsed)
      onChange(formatted)
      onBlur?.(formatted)
    }
  }, [value, onChange, onBlur])

  return (
    <Input
      id={id}
      label={label}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      helperText={helperText}
      error={error}
      required={required}
      disabled={disabled}
    />
  )
}
