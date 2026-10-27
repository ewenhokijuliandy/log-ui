import { parseLine } from '../../shared/parse-line.ts'
import type { LogRecord } from '../../shared/types.ts'

export const MANUAL_FILE_LIMIT = 25 * 1024 * 1024

export type ManualParseResult = {
  records: LogRecord[]
  totalLines: number
}

export function parseManual(text: string, cap: number): ManualParseResult {
  const lines = text.split(/\r?\n/)
  let totalLines = 0
  for (const line of lines) {
    if (line.trim().length > 0) totalLines += 1
  }
  const skip = Math.max(0, totalLines - Math.max(1, cap))
  const records: LogRecord[] = []
  let seq = 0
  for (const line of lines) {
    if (line.trim().length === 0) continue
    seq += 1
    if (seq <= skip) continue
    const parsed = parseLine(line)
    records.push({ seq, ...parsed })
  }
  return { records, totalLines }
}
