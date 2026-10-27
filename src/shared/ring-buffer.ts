import { emptyLevelCounts, type LevelCounts } from './levels.ts'
import type { LogRecord, ParsedLine, StreamStats } from './types.ts'

export type SliceResult = {
  records: LogRecord[]
  gap: boolean
}

const DEFAULT_CAPACITY = 10_000

export class LogRing {
  readonly capacity: number
  private slots: Array<LogRecord | undefined>
  private head = 0
  private count = 0
  private dropped = 0
  private tailSeq = 0

  private counts: LevelCounts = emptyLevelCounts()

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = Math.max(1, capacity)
    this.slots = new Array(this.capacity)
  }

  get lineCount(): number {
    return this.count
  }

  get stats(): StreamStats {
    return {
      lineCount: this.count,
      dropped: this.dropped,
      levelCounts: { ...this.counts },
    }
  }

  get firstSeq(): number | null {
    if (this.count === 0) return null
    const record = this.slots[this.head]
    return record?.seq ?? null
  }

  get lastSeq(): number | null {
    if (this.count === 0) return null
    return this.tailSeq
  }

  push(line: ParsedLine): LogRecord {
    this.tailSeq += 1
    const record: LogRecord = { ...line, seq: this.tailSeq }

    if (this.count === this.capacity) {
      const evicted = this.slots[this.head]
      this.slots[this.head] = undefined
      this.head += 1
      if (this.head === this.capacity) this.head = 0
      this.count -= 1
      this.dropped += 1
      if (evicted !== undefined) this.counts[evicted.level] -= 1
    }

    let slot = this.head + this.count
    if (slot >= this.capacity) slot -= this.capacity
    this.slots[slot] = record
    this.count += 1
    this.counts[record.level] += 1

    return record
  }

  clear(): void {
    this.slots.fill(undefined)
    this.head = 0
    this.count = 0
    this.dropped = 0
    this.counts = emptyLevelCounts()
  }

  all(): LogRecord[] {
    const records: LogRecord[] = []
    for (let offset = 0; offset < this.count; offset += 1) {
      let slot = this.head + offset
      if (slot >= this.capacity) slot -= this.capacity
      const record = this.slots[slot]
      if (record !== undefined) records.push(record)
    }
    return records
  }

  sliceSince(sinceSeq: number | null): SliceResult {
    if (this.count === 0) return { records: [], gap: false }
    if (sinceSeq === null) return { records: this.all(), gap: false }

    const first = this.firstSeq
    const last = this.lastSeq
    if (first === null || last === null) return { records: [], gap: false }

    if (sinceSeq < first) return { records: this.all(), gap: true }
    if (sinceSeq >= last) return { records: [], gap: false }

    const offset = sinceSeq - first + 1
    const records = this.all().slice(offset)
    return { records, gap: false }
  }
}
