import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Junta classes CSS com resolução de conflitos Tailwind (usado por PageHeader e ações). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
