import { parseLine } from '../../shared/parse-line.ts'
import { isDefaultParseRules, type ParseRules } from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'

type CacheEntry = {
  rules: ParseRules
  output: LogRecord
}

const cache = new WeakMap<LogRecord, CacheEntry>()

export function reparseRecord(record: LogRecord, rules: ParseRules): LogRecord {
  const cached = cache.get(record)
  if (cached !== undefined && cached.rules === rules) return cached.output
  const parsed = parseLine(record.raw, rules)
  const output: LogRecord = {
    ...parsed,
    seq: record.seq,
    truncated: record.truncated || parsed.truncated,
  }
  cache.set(record, { rules, output })
  return output
}

export function reparseRecords(records: readonly LogRecord[], rules: ParseRules): LogRecord[] {
  if (isDefaultParseRules(rules)) return [...records]
  return records.map((record) => reparseRecord(record, rules))
}
