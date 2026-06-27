import Input from '@/components/Input'

interface TransactionDescriptionFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  label?: string
}

/**
 * Campo de descrição padronizado para formulários de transação.
 */
export default function TransactionDescriptionField({
  value,
  onChange,
  placeholder,
  required = false,
  label = 'Descrição (opcional)',
}: TransactionDescriptionFieldProps) {
  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  )
}
