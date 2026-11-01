const JSON_SKIP_LIMIT = 256 * 1024
const MAX_SCAN_CHARS = 2 * 1024 * 1024
const OPENS = new Set(['{', '['])
const CLOSERS: Record<string, string> = { '{': '}', '[': ']' }

export type JsonSpan = {
  value: unknown
  start: number
  end: number
}

export function extractJson(text: string): JsonSpan | null {
  if (text.length > JSON_SKIP_LIMIT) return null
  if (!text.includes('{') && !text.includes('[')) return null

  let budget = MAX_SCAN_CHARS

  for (let index = 0; index < text.length; index += 1) {
    if (budget <= 0) return null
    const opener = text[index]
    if (!OPENS.has(opener)) continue

    const closer = CLOSERS[opener]
    const stack: string[] = []
    let inString = false
    let escaped = false
    let end = -1

    let cursor = index
    for (; cursor < text.length; cursor += 1) {
      if (budget <= 0) return null
      budget -= 1
      const ch = text[cursor]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') {
        stack.push('}')
        continue
      }
      if (ch === '[') {
        stack.push(']')
        continue
      }
      if (ch !== '}' && ch !== ']') continue
      if (stack.pop() !== ch) break
      if (ch === closer && stack.length === 0) {
        end = cursor
        break
      }
    }

    if (end === -1) continue

    const segment = text.slice(index, end + 1)
    let value: unknown = null
    try {
      value = JSON.parse(segment)
    } catch {
      continue
    }
    if (typeof value === 'object' && value !== null) return { value, start: index, end: end + 1 }
  }

  return null
}

const LEVEL_KEYS: readonly string[] = ['level', 'severity', 'lvl', 'loglevel', 'levelname']
const TIME_KEYS: readonly string[] = [
  'time',
  'timestamp',
  'ts',
  '@timestamp',
  'datetime',
  'date',
  'event_time',
  'eventTime',
]

function scalarField(json: unknown, keys: readonly string[]): string | number | null {
  if (typeof json !== 'object' || json === null) return null
  const record = json as Record<string, unknown>
  for (const key of keys) {
    const raw = record[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw !== 'string') continue
    const text = raw.trim()
    if (text.length > 0) return text
  }
  return null
}

export function jsonLevelValue(json: unknown): string | number | null {
  return scalarField(json, LEVEL_KEYS)
}

export function jsonTimeValue(json: unknown): string | number | null {
  return scalarField(json, TIME_KEYS)
}

export function jsonMessageValue(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const record = json as Record<string, unknown>
  for (const key of ['msg', 'message']) {
    const raw = record[key]
    if (typeof raw === 'string' && raw.length > 0) return raw
  }
  return null
}
