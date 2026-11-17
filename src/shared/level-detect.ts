import { jsonLevelValue } from './json-extract.ts'
import { levelFromNumeric } from './levels.ts'
import { numericLevelMap, type ParseRules } from './parse-rules.ts'
import { consumeSeparators } from './timestamp.ts'
import type { LogLevel } from './types.ts'

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

type LevelHit = {
  level: LogLevel
  consumed: number
}

function detectLevelInJson(json: unknown, rules: ParseRules): LevelHit | null {
  const token = jsonLevelValue(json, rules.json.levelKeys)
  if (token === null) return null
  if (typeof token === 'number') {
    const level = levelFromNumeric(token, numericLevelMap(rules))
    if (level === null) return null
    return { level, consumed: 0 }
  }
  const named = LEVEL_ALIASES[token.toUpperCase()]
  if (named !== undefined) return { level: named, consumed: 0 }
  const level = levelFromNumeric(token, numericLevelMap(rules))
  if (level === null) return null
  return { level, consumed: 0 }
}

function detectLevelInBrackets(text: string): LevelHit | null {
  if (!text.includes(']')) return null
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

export function detectLevel(json: unknown, text: string, rules: ParseRules): LevelHit | null {
  const fromJson = detectLevelInJson(json, rules)
  if (fromJson !== null) return fromJson
  const fromBrackets = detectLevelInBrackets(text)
  if (fromBrackets !== null) return fromBrackets
  return detectLevelInWords(text)
}
