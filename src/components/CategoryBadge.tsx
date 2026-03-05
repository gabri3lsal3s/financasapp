type CategoryBadgeProps = {
  label: string
  color?: string
}

export default function CategoryBadge({ label, color }: CategoryBadgeProps) {
  const normalizedColor = color || 'var(--color-text-secondary)'

  const style = {
    backgroundColor: `color-mix(in srgb, ${normalizedColor} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${normalizedColor} 28%, transparent)`,
    color: `color-mix(in srgb, ${normalizedColor} 92%, var(--color-text-primary) 8%)`,
  }

  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 sm:text-xs font-medium"
      title={label}
      style={style}
    >
      <span
        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: normalizedColor }}
      />
      <span className="truncate">{label}</span>
    </span>
  )
}
