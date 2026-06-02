/** Junta classes CSS sem dependências extras (usado por PageHeader e ações). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
