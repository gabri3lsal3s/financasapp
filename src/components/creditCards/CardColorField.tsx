import { ensureHexColor } from '@/utils/colorValue'

interface CardColorFieldProps {
  value: string
  onChange: (hexColor: string) => void
  label?: string
}

/** WHY: input type="color" exige valor HEX; isolado fora de pages para guardrail de controles nativos. */
export default function CardColorField({ value, onChange, label = 'Cor' }: CardColorFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-primary">{label}</label>
      <input
        type="color"
        value={ensureHexColor(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full cursor-pointer rounded-lg border border-primary bg-primary"
      />
    </div>
  )
}
