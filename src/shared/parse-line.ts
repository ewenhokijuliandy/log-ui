import { stripAnsi } from './ansi.ts'
import { collectIdsFromJson, collectIdsFromText, limitIds } from './id-collect.ts'
import { extractJson, jsonMessageValue } from './json-extract.ts'
import { detectLevel } from './level-detect.ts'
import { DEFAULT_PARSE_RULES, type ParseRules } from './parse-rules.ts'
import { findTimestamp, parseJsonTimestamp } from './timestamp.ts'
import type { LogLevel, ParsedLine } from './types.ts'

const LINE_CAP = 100 * 1024

export function parseLine(line: string, rules: ParseRules = DEFAULT_PARSE_RULES): ParsedLine {
  const truncated = line.length > LINE_CAP
  const capped = truncated ? line.slice(0, LINE_CAP) : line
  const stripped = stripAnsi(capped)

  const timestamp = findTimestamp(stripped)
  const remainder =
    timestamp === null ? stripped.replace(/^[ \t]+/, '') : stripped.slice(timestamp.end)

  let jsonHit = extractJson(remainder)
  let text = remainder

  const level = detectLevel(jsonHit === null ? null : jsonHit.value, remainder, rules)
  const levelName: LogLevel = level?.level ?? 'unknown'

  if (level !== null && level.consumed > 0) {
    text = remainder.slice(level.consumed)
    jsonHit = extractJson(text)
  }

  let json: unknown | null = null
  let message = text.trim()
  if (jsonHit !== null) {
    json = jsonHit.value
    message = jsonMessageValue(json, rules.json.messageKeys) ?? text.trim()
  }

  const ids: Map<string, string> = new Map()
  collectIdsFromJson(json, ids)
  collectIdsFromText(remainder, ids)

  return {
    raw: stripped,
    truncated,
    ts: timestamp?.ts ?? parseJsonTimestamp(json, rules),
    level: levelName,
    message,
    json,
    ids: limitIds(ids),
  }
}
