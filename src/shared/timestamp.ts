import { jsonTimeValue } from './json-extract.ts'
import type { NumericUnit, ParseRules } from './parse-rules.ts'

const EPOCH_MIN = Date.UTC(2000, 0, 1)
const EPOCH_MAX = Date.UTC(2100, 0, 1)

const ISO_TIMESTAMP =
  /^\s*\[?(\d{4}-\d{2}-\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|z|[+-]\d{2}:?\d{2})?/
const EPOCH_TIMESTAMP = /^\[?(\d{10,13})(?:[.,](\d{1,6}))?(?=[\s,|]|$)/

type TimestampHit = {
  ts: number
  end: number
}

export function consumeSeparators(text: string, cursor: number): number {
  let end = cursor
  if (text[end] === ']') end += 1
  for (let index = end; index < text.length; index += 1) {
    const ch = text[index]
    if (ch !== ' ' && ch !== '\t') break
    end = index + 1
  }
  return end
}

function inPlausibleRange(epochMs: number): boolean {
  return epochMs >= EPOCH_MIN && epochMs <= EPOCH_MAX
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

  let epochMs = Date.UTC(
    year,
    month - 1,
    day,
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms),
  )

  if (zone === undefined) {
    epochMs += new Date(epochMs).getTimezoneOffset() * 60_000
  }

  if (zone !== undefined && (zone.startsWith('-') || zone.startsWith('+'))) {
    const normalize = zone.replace(':', '')
    const sign = normalize[0] === '-' ? -1 : 1
    const offsetHours = Number(normalize.slice(1, 3))
    const offsetMinutes = Number(normalize.slice(3, 5))
    epochMs -= sign * (offsetHours * 60 + offsetMinutes) * 60_000
  }

  if (!inPlausibleRange(epochMs)) return null

  return { ts: epochMs, end: consumeSeparators(text, match[0].length) }
}

function parseEpochTimestamp(text: string): TimestampHit | null {
  const match = EPOCH_TIMESTAMP.exec(text)
  if (match === null) return null

  const digits = match[1] ?? ''
  const fraction = match[2] ?? ''
  const epochValue = Number(digits)
  let epochMs = epochValue

  if (digits.length === 10) {
    epochMs = epochValue * 1000 + Number(fraction.padEnd(3, '0').slice(0, 3) || '0')
  }

  if (!inPlausibleRange(epochMs)) return null

  return { ts: epochMs, end: consumeSeparators(text, match[0].length) }
}

export function findTimestamp(text: string): TimestampHit | null {
  const iso = parseIsoTimestamp(text)
  if (iso !== null) return iso
  return parseEpochTimestamp(text)
}

function numericEpochToMillis(value: number, unit: NumericUnit): number {
  if (unit === 's') return Math.round(value * 1000)
  if (unit === 'ms') return Math.round(value)
  if (unit === 'us') return Math.round(value / 1e3)
  if (unit === 'ns') return Math.round(value / 1e6)
  const magnitude = Math.abs(value)
  if (magnitude >= 1e17) return Math.round(value / 1e6)
  if (magnitude >= 1e14) return Math.round(value / 1e3)
  if (magnitude >= 1e11) return Math.round(value)
  if (magnitude >= 1e8) return Math.round(value * 1000)
  return Number.NaN
}

function parseJsonTimestampValue(value: string | number, unit: NumericUnit): number | null {
  if (typeof value === 'number') {
    const epochMs = numericEpochToMillis(value, unit)
    return inPlausibleRange(epochMs) ? epochMs : null
  }
  const text = value.trim()
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const epochMs = numericEpochToMillis(Number(text), unit)
    return inPlausibleRange(epochMs) ? epochMs : null
  }
  const iso = parseIsoTimestamp(text)
  if (iso !== null) return iso.ts
  const parsed = Date.parse(text)
  return inPlausibleRange(parsed) ? parsed : null
}

export function parseJsonTimestamp(json: unknown, rules: ParseRules): number | null {
  if (json === null) return null
  const value = jsonTimeValue(json, rules.json.timeKeys)
  if (value === null) return null
  return parseJsonTimestampValue(value, rules.time.numericUnit)
}
