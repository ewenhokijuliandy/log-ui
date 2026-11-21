import type { LogRecord } from '../../shared/types.ts'

export function hasGap(existing: readonly LogRecord[], incoming: readonly LogRecord[]): boolean {
  if (existing.length === 0 || incoming.length === 0) return false
  const lastExisting = existing[existing.length - 1]?.seq ?? null
  const firstIncoming = incoming[0]?.seq ?? null
  if (lastExisting === null || firstIncoming === null) return false
  return firstIncoming > lastExisting + 1
}

export function mergeRecords(
  existing: readonly LogRecord[],
  incoming: readonly LogRecord[],
  cap: number,
): LogRecord[] {
  if (incoming.length === 0) return [...existing]
  const firstIncoming = incoming[0]?.seq ?? 0
  const deduped = existing.filter((record) => record.seq < firstIncoming)
  const merged = [...deduped, ...incoming]
  if (merged.length > cap) merged.splice(0, merged.length - cap)
  return merged
}
