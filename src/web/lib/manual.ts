import { parseLine } from '../../shared/parse-line.ts'
import type { LogRecord } from '../../shared/types.ts'

export const MANUAL_FILE_LIMIT = 25 * 1024 * 1024

export type ManualFile = {
  name: string
  size: number
  type: string
}

export function manualFileProblem(file: ManualFile, limit = MANUAL_FILE_LIMIT): string | null {
  const lower = file.name.toLowerCase()
  const supported = lower.endsWith('.txt') || lower.endsWith('.log') || file.type === 'text/plain'
  if (!supported) return 'Manual mode accepts .txt and .log files.'
  if (file.size <= limit) return null
  return `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Manual mode accepts up to 25 MB.`
}

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
