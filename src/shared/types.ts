export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown'

export type ParsedLine = {
  raw: string
  truncated: boolean
  ts: number | null
  level: LogLevel
  message: string
  json: unknown | null
  ids: string[]
}

export type LogRecord = ParsedLine & {
  seq: number
}

export type StreamStatus = 'active' | 'stopped'

export type StreamMeta = {
  id: string
  name: string
  status: StreamStatus
  createdAt: number
}

export type StreamStats = {
  lineCount: number
  dropped: number
  levelCounts: Record<LogLevel, number>
}

export type StreamSnapshot = {
  records: LogRecord[]
  dropped: number
  firstSeq: number | null
  lastSeq: number | null
  gap: boolean
  status: StreamStatus
}
