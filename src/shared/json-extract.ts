import { DEFAULT_LEVEL_KEYS, DEFAULT_MESSAGE_KEYS, DEFAULT_TIME_KEYS } from './parse-rules.ts'

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

function scalarField(
  json: unknown,
  keys: readonly string[],
  fallback: readonly string[],
): string | number | null {
  if (typeof json !== 'object' || json === null) return null
  const record = json as Record<string, unknown>
  const candidates = keys.length > 0 ? keys : fallback
  for (const key of candidates) {
    const raw = record[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw !== 'string') continue
    const text = raw.trim()
    if (text.length > 0) return text
  }
  return null
}

export function jsonLevelValue(
  json: unknown,
  keys: readonly string[] = DEFAULT_LEVEL_KEYS,
): string | number | null {
  return scalarField(json, keys, DEFAULT_LEVEL_KEYS)
}

export function jsonTimeValue(
  json: unknown,
  keys: readonly string[] = DEFAULT_TIME_KEYS,
): string | number | null {
  return scalarField(json, keys, DEFAULT_TIME_KEYS)
}

export function jsonMessageValue(
  json: unknown,
  keys: readonly string[] = DEFAULT_MESSAGE_KEYS,
): string | null {
  if (typeof json !== 'object' || json === null) return null
  const record = json as Record<string, unknown>
  const candidates = keys.length > 0 ? keys : DEFAULT_MESSAGE_KEYS
  for (const key of candidates) {
    const raw = record[key]
    if (typeof raw === 'string' && raw.length > 0) return raw
  }
  return null
}
