import { AUTO_LEVEL_BANDS, PINO_LEVEL_BANDS, SYSLOG_LEVEL_BANDS } from './levels.ts'
import type { LogLevel } from './types.ts'

export const DEFAULT_LEVEL_KEYS: readonly string[] = [
  'level',
  'severity',
  'lvl',
  'loglevel',
  'levelname',
]

export const DEFAULT_TIME_KEYS: readonly string[] = [
  'time',
  'timestamp',
  'ts',
  '@timestamp',
  'datetime',
  'date',
  'event_time',
  'eventTime',
]

export const DEFAULT_MESSAGE_KEYS: readonly string[] = ['msg', 'message']

export type NumericLevelPreset = 'auto' | 'pino' | 'syslog' | 'custom'
export type NumericUnit = 'auto' | 's' | 'ms' | 'us' | 'ns'

export type ParseRules = {
  version: 1
  json: {
    levelKeys: string[]
    timeKeys: string[]
    messageKeys: string[]
  }
  numeric: {
    preset: NumericLevelPreset
    map: Record<string, LogLevel>
  }
  time: {
    numericUnit: NumericUnit
  }
}

const LEVEL_NAMES: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'unknown',
]
const MAX_KEYS = 12
const MAX_KEY_LENGTH = 40
const MAX_CUSTOM_LEVELS = 32

export function defaultParseRules(): ParseRules {
  return {
    version: 1,
    json: {
      levelKeys: [...DEFAULT_LEVEL_KEYS],
      timeKeys: [...DEFAULT_TIME_KEYS],
      messageKeys: [...DEFAULT_MESSAGE_KEYS],
    },
    numeric: { preset: 'auto', map: {} },
    time: { numericUnit: 'auto' },
  }
}

export const DEFAULT_PARSE_RULES: ParseRules = defaultParseRules()

function normalizeKeys(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  const keys: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const key = entry.trim()
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) continue
    if (keys.includes(key)) continue
    keys.push(key)
    if (keys.length >= MAX_KEYS) break
  }
  return keys.length > 0 ? keys : [...fallback]
}

function normalizePreset(value: unknown): NumericLevelPreset {
  if (value === 'pino' || value === 'syslog' || value === 'custom') return value
  return 'auto'
}

function normalizeUnit(value: unknown): NumericUnit {
  if (value === 's' || value === 'ms' || value === 'us' || value === 'ns') return value
  return 'auto'
}

function normalizeMap(value: unknown): Record<string, LogLevel> {
  const map: Record<string, LogLevel> = {}
  if (value === null || typeof value !== 'object') return map
  let count = 0
  for (const [key, level] of Object.entries(value as Record<string, unknown>)) {
    if (count >= MAX_CUSTOM_LEVELS) break
    if (!/^\d+$/.test(key)) continue
    if (!LEVEL_NAMES.includes(level as LogLevel)) continue
    map[key] = level as LogLevel
    count += 1
  }
  return map
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

export function normalizeParseRules(value: unknown): ParseRules {
  const raw = objectValue(value)
  const json = objectValue(raw.json)
  const numeric = objectValue(raw.numeric)
  const time = objectValue(raw.time)
  return {
    version: 1,
    json: {
      levelKeys: normalizeKeys(json.levelKeys, DEFAULT_LEVEL_KEYS),
      timeKeys: normalizeKeys(json.timeKeys, DEFAULT_TIME_KEYS),
      messageKeys: normalizeKeys(json.messageKeys, DEFAULT_MESSAGE_KEYS),
    },
    numeric: {
      preset: normalizePreset(numeric.preset),
      map: normalizeMap(numeric.map),
    },
    time: {
      numericUnit: normalizeUnit(time.numericUnit),
    },
  }
}

export function numericLevelMap(rules: ParseRules): Readonly<Record<string, LogLevel | undefined>> {
  if (rules.numeric.preset === 'pino') return PINO_LEVEL_BANDS
  if (rules.numeric.preset === 'syslog') return SYSLOG_LEVEL_BANDS
  if (rules.numeric.preset === 'custom') return rules.numeric.map
  return AUTO_LEVEL_BANDS
}

export function parseRulesSignature(rules: ParseRules): string {
  return JSON.stringify(normalizeParseRules(rules))
}

const DEFAULT_SIGNATURE = parseRulesSignature(DEFAULT_PARSE_RULES)

export function isDefaultParseRules(rules: ParseRules): boolean {
  return parseRulesSignature(rules) === DEFAULT_SIGNATURE
}
