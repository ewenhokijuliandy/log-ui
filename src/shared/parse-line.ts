import { stripAnsi } from './ansi.ts'
import { extractJson, jsonLevelValue, jsonMessageValue } from './json-extract.ts'
import type { LogLevel, ParsedLine } from './types.ts'

const LINE_CAP = 100 * 1024
const ID_LIMIT = 8
const EPOCH_MIN = Date.UTC(2000, 0, 1)
const EPOCH_MAX = Date.UTC(2100, 0, 1)

const ISO_TIMESTAMP =
  /^\s*\[?(\d{4}-\d{2}-\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|z|[+-]\d{2}:?\d{2})?/
const EPOCH_TIMESTAMP = /^\[?(\d{10,13})(?:[.,](\d{1,6}))?(?=[\s,|]|$)/

const LEVEL_ALIASES: Record<string, LogLevel> = {
  FATAL: 'fatal',
  CRITICAL: 'fatal',
  CRIT: 'fatal',
  ERROR: 'error',
  ERR: 'error',
  WARN: 'warn',
  WARNING: 'warn',
  INFO: 'info',
  NOTICE: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
  VERBOSE: 'trace',
}

const BRACKET_LEVEL = /\[([A-Za-z]+)\]/g
const WORD_LEVEL =
  /\b(FATAL|CRITICAL|CRIT|ERROR|ERR|WARN|WARNING|INFO|NOTICE|DEBUG|TRACE|VERBOSE)\b/

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const HEX32_PATTERN = /\b[0-9a-f]{32}\b/gi
const KEYED_ID_PATTERN =
  /\b(?:trace|span|request|correlation|conversation|x-request)[-_]?(?:id)?\s*[=:]\s*["']?([0-9a-zA-Z][0-9a-zA-Z_:-]{7,63})["']?/gi

const JSON_ID_KEYS: readonly string[] = [
  'trace_id',
  'traceId',
  'trace',
  'span_id',
  'spanId',
  'span',
  'request_id',
  'requestId',
  'request',
  'req_id',
  'req',
  'correlation_id',
  'correlationId',
  'x_request_id',
  'x-request-id',
  'conversation_id',
]

type TimestampHit = {
  ts: number
  end: number
}

type LevelHit = {
  level: LogLevel
  consumed: number
}

function inPlausibleRange(ts: number): boolean {
  return ts >= EPOCH_MIN && ts <= EPOCH_MAX
}

function consumeSeparators(text: string, cursor: number): number {
  let end = cursor
  if (text[end] === ']') end += 1
  for (let index = end; index < text.length; index += 1) {
    const ch = text[index]
    if (ch !== ' ' && ch !== '\t') break
    end = index + 1
  }
  return end
}

function parseIsoTimestamp(text: string): TimestampHit | null {
  const match = ISO_TIMESTAMP.exec(text)
  if (match === null) return null

  const date = match[1] ?? ''
  const hour = match[2] ?? '0'
  const minute = match[3] ?? '0'
  const second = match[4] ?? '0'
  const fraction = match[5] ?? ''
  const zone = match[6]

  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const ms = fraction.padEnd(3, '0').slice(0, 3)

  let ts = Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second), Number(ms))

  if (zone === undefined) {
    ts += new Date(ts).getTimezoneOffset() * 60_000
  }

  if (zone !== undefined && (zone.startsWith('-') || zone.startsWith('+'))) {
    const normalize = zone.replace(':', '')
    const sign = normalize[0] === '-' ? -1 : 1
    const offsetHours = Number(normalize.slice(1, 3))
    const offsetMinutes = Number(normalize.slice(3, 5))
    ts -= sign * (offsetHours * 60 + offsetMinutes) * 60_000
  }

  if (!inPlausibleRange(ts)) return null

  return { ts, end: consumeSeparators(text, match[0].length) }
}

function parseEpochTimestamp(text: string): TimestampHit | null {
  const match = EPOCH_TIMESTAMP.exec(text)
  if (match === null) return null

  const digits = match[1] ?? ''
  const fraction = match[2] ?? ''
  const base = Number(digits)
  let ts = base

  if (digits.length === 10) {
    ts = base * 1000 + Number(fraction.padEnd(3, '0').slice(0, 3) || '0')
  }

  if (!inPlausibleRange(ts)) return null

  return { ts, end: consumeSeparators(text, match[0].length) }
}

function findTimestamp(text: string): TimestampHit | null {
  const iso = parseIsoTimestamp(text)
  if (iso !== null) return iso
  return parseEpochTimestamp(text)
}

function detectLevelInJson(json: unknown): LevelHit | null {
  const value = jsonLevelValue(json)
  if (value === null) return null
  const level = LEVEL_ALIASES[value]
  if (level === undefined) return null
  return { level, consumed: 0 }
}

function detectLevelInBrackets(text: string): LevelHit | null {
  for (const match of text.matchAll(BRACKET_LEVEL)) {
    const level = LEVEL_ALIASES[(match[1] ?? '').toUpperCase()]
    if (level === undefined) continue
    return { level, consumed: consumeSeparators(text, (match.index ?? 0) + match[0].length) }
  }
  return null
}

function detectLevelInWords(text: string): LevelHit | null {
  let consumedPrefix = 0
  let current = text

  for (let guard = 0; guard < 8; guard += 1) {
    const match = WORD_LEVEL.exec(current)
    if (match === null) return null
    if ((match.index ?? -1) === 0) {
      const level = LEVEL_ALIASES[match[1] ?? '']
      if (level === undefined) return null
      return { level, consumed: consumeSeparators(text, consumedPrefix + match[0].length) }
    }

    const bracketRun = /^\[[^\]]*\][ \t]*/y
    const run = bracketRun.exec(current)
    if (run === null) return null
    consumedPrefix += run[0].length
    current = current.slice(run[0].length)
  }

  return null
}

function detectLevel(json: unknown, text: string): LevelHit | null {
  const fromJson = detectLevelInJson(json)
  if (fromJson !== null) return fromJson
  const fromBrackets = detectLevelInBrackets(text)
  if (fromBrackets !== null) return fromBrackets
  return detectLevelInWords(text)
}

function collectIdsFromJson(json: unknown, into: Map<string, string>): void {
  if (typeof json !== 'object' || json === null) return
  const record = json as Record<string, unknown>
  for (const key of JSON_ID_KEYS) {
    if (into.size >= ID_LIMIT) return
    const raw = record[key]
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    const id = String(raw).trim()
    if (id.length < 8 || id.length > 64) continue
    into.set(id.toLowerCase(), id)
  }
}

function collectIdsFromText(text: string, into: Map<string, string>): void {
  for (const match of text.matchAll(KEYED_ID_PATTERN)) {
    if (into.size >= ID_LIMIT) return
    const id = match[1]
    if (id === undefined) continue
    into.set(id.toLowerCase(), id)
  }
  for (const match of text.matchAll(UUID_PATTERN)) {
    if (into.size >= ID_LIMIT) return
    const id = match[0]
    into.set(id.toLowerCase(), id)
  }
  for (const match of text.matchAll(HEX32_PATTERN)) {
    if (into.size >= ID_LIMIT) return
    const id = match[0]
    into.set(id.toLowerCase(), id)
  }
}

function limitIds(collected: Map<string, string>): string[] {
  const ids: string[] = []
  for (const id of collected.values()) {
    if (ids.length >= ID_LIMIT) break
    ids.push(id)
  }
  return ids
}

export function parseLine(line: string): ParsedLine {
  const truncated = line.length > LINE_CAP
  const capped = truncated ? line.slice(0, LINE_CAP) : line
  const stripped = stripAnsi(capped)

  let remainder = stripped
  const timestamp = findTimestamp(stripped)
  if (timestamp === null) {
    remainder = remainder.replace(/^[ \t]+/, '')
  } else {
    remainder = stripped.slice(timestamp.end)
  }

  let jsonHit = extractJson(remainder)
  let text = remainder

  const level = detectLevel(jsonHit === null ? null : jsonHit.value, remainder)
  const levelName: LogLevel = level?.level ?? 'unknown'

  if (level !== null && level.consumed > 0) {
    text = remainder.slice(level.consumed)
    jsonHit = extractJson(text)
  }

  let json: unknown | null = null
  let message: string

  if (jsonHit !== null) {
    json = jsonHit.value
    message = jsonMessageValue(json) ?? text.trim()
  } else {
    message = text.trim()
  }

  const ids: Map<string, string> = new Map()
  collectIdsFromJson(json, ids)
  collectIdsFromText(remainder, ids)

  return {
    raw: stripped,
    truncated,
    ts: timestamp?.ts ?? null,
    level: levelName,
    message,
    json,
    ids: limitIds(ids),
  }
}
