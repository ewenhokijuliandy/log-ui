type Sequenced = { seq: number }

function firstIndexAfter(records: readonly Sequenced[], boundary: number): number {
  let low = 0
  let high = records.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if ((records[mid]?.seq ?? 0) <= boundary) low = mid + 1
    else high = mid
  }
  return low
}

export function frozenRecords<T extends Sequenced>(
  records: readonly T[],
  pausedAt: number | null,
): readonly T[] {
  if (pausedAt === null) return records
  return records.slice(0, firstIndexAfter(records, pausedAt))
}

export function pendingCount(records: readonly Sequenced[], pausedAt: number | null): number {
  if (pausedAt === null) return 0
  return records.length - firstIndexAfter(records, pausedAt)
}
