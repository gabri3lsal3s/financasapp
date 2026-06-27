import Select from '@/components/Select'

interface CategoryOption {
  value: string
  label: string
}

interface TransactionCategorySelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: CategoryOption[]
  required?: boolean
}

/**
 * Select de categoria padronizado para formulários de transação.
 */
export default function TransactionCategorySelect({
  label = 'Categoria',
  value,
  onChange,
  options,
  required = true,
}: TransactionCategorySelectProps) {
  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      required={required}
    />
  )
}
