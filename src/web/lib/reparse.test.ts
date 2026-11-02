import { describe, expect, test } from 'vitest'
import {
  DEFAULT_PARSE_RULES,
  normalizeParseRules,
  type ParseRules,
} from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import { reparseRecord, reparseRecords } from './reparse.ts'

const CUSTOM_RULES: ParseRules = normalizeParseRules({
  json: { levelKeys: ['sev'], timeKeys: ['when'], messageKeys: ['text'] },
  numeric: { preset: 'auto', map: {} },
  time: { numericUnit: 'auto' },
})

function record(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    seq: 7,
    raw: '{"sev":"error","when":1761134138742,"text":"boom"}',
    truncated: false,
    ts: null,
    level: 'unknown',
    message: '{"sev":"error","when":1761134138742,"text":"boom"}',
    json: null,
    ids: [],
    ...overrides,
  }
}

describe('reparse', () => {
  test('default rules keep the original records', () => {
    const records = [record()]
    const output = reparseRecords(records, DEFAULT_PARSE_RULES)
    expect(output[0]).toBe(records[0])
  })

  test('custom rules reparse the raw line and preserve identity fields', () => {
    const source = record({ truncated: true })
    const output = reparseRecord(source, CUSTOM_RULES)
    expect(output.seq).toBe(source.seq)
    expect(output.truncated).toBe(true)
    expect(output.level).toBe('error')
    expect(output.ts).toBe(1_761_134_138_742)
    expect(output.message).toBe('boom')
    expect(output.json).toEqual({ sev: 'error', when: 1761134138742, text: 'boom' })
  })

  test('memoizes per record and rules object', () => {
    const source = record()
    const first = reparseRecord(source, CUSTOM_RULES)
    expect(reparseRecord(source, CUSTOM_RULES)).toBe(first)
  })

  test('reparses a 10k buffer within 800ms', () => {
    const records = Array.from({ length: 10_000 }, (_, index) => record({ seq: index + 1 }))
    const started = performance.now()
    const output = reparseRecords(records, CUSTOM_RULES)
    const elapsed = performance.now() - started
    expect(output).toHaveLength(10_000)
    expect(output[0]?.level).toBe('error')
    expect(elapsed).toBeLessThan(800)
  })
})
