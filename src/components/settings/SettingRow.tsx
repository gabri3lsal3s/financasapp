interface SettingRowProps {
  title: string
  description?: string
  children: React.ReactNode
}

/**
 * SettingRow — linha de configuração (título + descrição + controle),
 * extraída da página Configurações.
 */
export default function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-medium text-primary">{title}</h3>
        {description && <p className="text-sm text-secondary mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}
