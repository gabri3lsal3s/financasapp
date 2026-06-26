/**
 * Logger condicional — exibe mensagens apenas em ambiente de desenvolvimento.
 *
 * Em produção (NODE_ENV === 'production'):
 *   - `debug` e `info` são no-op (sem saída no console)
 *   - `warn` e `error` continuam funcionando (falhas reais devem ser visíveis)
 *
 * Uso:
 *   import { logger } from '@/utils/logger'
 *   logger.debug('[MyHook]', 'carregando dados...')
 *   logger.error('[MyHook] Falha crítica:', err)
 */

const isDev = import.meta.env.DEV

export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: isDev ? (...args: any[]) => console.log(...args) : () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: isDev ? (...args: any[]) => console.info(...args) : () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error(...args),
} as const
