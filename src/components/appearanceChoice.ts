import { cn } from '@/lib/utils'

/** Classes compartilhadas pelos cards de seleção em Configurações → Aparência */
export function appearanceChoiceClass(selected: boolean) {
  return cn(
    'appearance-choice h-auto w-full min-w-0 max-w-full flex-col items-stretch justify-start !whitespace-normal p-3 text-left',
    selected ? 'nav-item-active appearance-choice--selected' : 'border-glass text-secondary hover:text-primary',
  )
}
