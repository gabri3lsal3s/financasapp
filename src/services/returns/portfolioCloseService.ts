import {
  persistDailyClose,
  runDailyClose,
  type DailyCloseInput,
  type DailyCloseResult,
} from '@/services/returns/closePipeline'

export type { DailyCloseInput, DailyCloseResult }
export { runDailyClose, persistDailyClose }

export async function executeAndPersistDailyClose(
  input: DailyCloseInput
): Promise<DailyCloseResult> {
  const result = await runDailyClose(input)
  await persistDailyClose(result)
  return result
}
