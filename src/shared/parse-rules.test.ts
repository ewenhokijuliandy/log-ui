import { describe, expect, test } from 'vitest'
import {
  DEFAULT_PARSE_RULES,
  defaultParseRules,
  isDefaultParseRules,
  normalizeParseRules,
  numericLevelMap,
  parseRulesSignature,
} from './parse-rules.ts'

describe('parse rule defaults', () => {
  test('defaults preserve the built-in behavior', () => {
    expect(DEFAULT_PARSE_RULES.version).toBe(1)
    expect(DEFAULT_PARSE_RULES.numeric.preset).toBe('auto')
    expect(DEFAULT_PARSE_RULES.time.numericUnit).toBe('auto')
    expect(isDefaultParseRules(DEFAULT_PARSE_RULES)).toBe(true)
    expect(isDefaultParseRules(defaultParseRules())).toBe(true)
    const changed = normalizeParseRules({
      ...DEFAULT_PARSE_RULES,
      json: { ...DEFAULT_PARSE_RULES.json, levelKeys: ['sev'] },
    })
    expect(isDefaultParseRules(changed)).toBe(false)
    expect(parseRulesSignature(changed)).not.toBe(parseRulesSignature(DEFAULT_PARSE_RULES))
  })

  test('default factories are independent', () => {
    const first = defaultParseRules()
    first.json.levelKeys.push('extra')
    expect(defaultParseRules().json.levelKeys).not.toContain('extra')
  })
})

describe('normalization', () => {
  test('invalid input falls back to defaults', () => {
    expect(normalizeParseRules(null)).toEqual(DEFAULT_PARSE_RULES)
    expect(normalizeParseRules('nope')).toEqual(DEFAULT_PARSE_RULES)
    const invalid = normalizeParseRules({
      numeric: { preset: 'bogus' },
      time: { numericUnit: 'minutes' },
    })
    expect(invalid.numeric.preset).toBe('auto')
    expect(invalid.time.numericUnit).toBe('auto')
  })

  test('keys are trimmed, deduped, capped and empty lists fall back', () => {
    const rules = normalizeParseRules({
      json: {
        levelKeys: [
          ' sev ',
          'sev',
          '',
          'x'.repeat(41),
          ...Array.from({ length: 20 }, (_, index) => `k${String(index)}`),
        ],
        timeKeys: [],
        messageKeys: 'nope',
      },
    })
    expect(rules.json.levelKeys[0]).toBe('sev')
    expect(rules.json.levelKeys).toHaveLength(12)
    expect(rules.json.timeKeys).toEqual(DEFAULT_PARSE_RULES.json.timeKeys)
    expect(rules.json.messageKeys).toEqual(DEFAULT_PARSE_RULES.json.messageKeys)
  })

  test('custom maps drop invalid entries and cap at 32', () => {
    const map: Record<string, string> = {
      '10': 'trace',
      '20': 'bogus',
      abc: 'info',
      '30': 'INFO',
    }
    for (let index = 0; index < 40; index += 1) map[String(100 + index)] = 'info'
    const rules = normalizeParseRules({ numeric: { preset: 'custom', map } })
    expect(rules.numeric.preset).toBe('custom')
    expect(rules.numeric.map['10']).toBe('trace')
    expect(rules.numeric.map['20']).toBeUndefined()
    expect(rules.numeric.map.abc).toBeUndefined()
    expect(rules.numeric.map['30']).toBeUndefined()
    expect(Object.keys(rules.numeric.map)).toHaveLength(32)
  })
})

describe('numeric presets', () => {
  test('auto supports pino and syslog', () => {
    const auto = numericLevelMap(DEFAULT_PARSE_RULES)
    expect(auto['30']).toBe('info')
    expect(auto['3']).toBe('error')
  })

  test('pino and syslog are exclusive', () => {
    const pino = numericLevelMap(normalizeParseRules({ numeric: { preset: 'pino' } }))
    const syslog = numericLevelMap(normalizeParseRules({ numeric: { preset: 'syslog' } }))
    expect(pino['30']).toBe('info')
    expect(pino['3']).toBeUndefined()
    expect(syslog['3']).toBe('error')
    expect(syslog['30']).toBeUndefined()
  })

  test('custom uses the stored map', () => {
    const rules = normalizeParseRules({
      numeric: { preset: 'custom', map: { '70': 'fatal' } },
    })
    expect(numericLevelMap(rules)['70']).toBe('fatal')
    expect(numericLevelMap(rules)['30']).toBeUndefined()
  })
})
