import Input from '@/components/Input'
import { APP_START_DATE } from '@/utils/format'

interface TransactionDateFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

/**
 * Campo de data padronizado para formulários de transação.
 * Usa APP_START_DATE como data mínima e padrão.
 */
export default function TransactionDateField({
  value,
  onChange,
  required = true,
}: TransactionDateFieldProps) {
  return (
    <Input
      label="Data"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={APP_START_DATE}
      required={required}
    />
  )
}
