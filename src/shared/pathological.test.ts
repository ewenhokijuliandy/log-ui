import { expect, test } from 'vitest'
import { parseLine } from './parse-line.ts'
import { oversizedLine, SAMPLE_LINES, THROUGHPUT_POOL } from './tests/fixtures.ts'

const OPEN_BRACKET_20K = '['.repeat(20_000)
const OPEN_BRACE_20K = '{'.repeat(20_000)
const OPEN_BRACKET_100K = `[${'a '.repeat(Math.ceil((100 * 1024 - 2) / 2))}`
const OPEN_BRACKET_RUN_100K = `[a `.repeat(Math.ceil((100 * 1024) / 3)).slice(0, 100 * 1024)

const PATHOLOGICAL_LINES: readonly string[] = [
  OPEN_BRACKET_20K,
  OPEN_BRACE_20K,
  OPEN_BRACKET_100K,
  OPEN_BRACKET_RUN_100K,
]

const PARSE_BUDGET_MS = 5

type PinnedResult = {
  line: string
  level: string
  message: string
  ids: string[]
  json: unknown
}

const PINNED_RESULTS: readonly PinnedResult[] = [
  {
    line: `{"level":"info","msg":"request completed","method":"GET","request_id":"8f21c0a4"}`,
    level: 'info',
    message: 'request completed',
    ids: ['8f21c0a4'],
    json: { level: 'info', msg: 'request completed', method: 'GET', request_id: '8f21c0a4' },
  },
  {
    line: '1719638400.123 INFO epoch seconds line',
    level: 'info',
    message: 'epoch seconds line',
    ids: [],
    json: null,
  },
  {
    line: 'java.lang.NullPointerException: invoice is null',
    level: 'unknown',
    message: 'java.lang.NullPointerException: invoice is null',
    ids: [],
    json: null,
  },
  {
    line: '[2026-10-25 11:47:03,123] [ERROR] boom happened',
    level: 'error',
    message: 'boom happened',
    ids: [],
    json: null,
  },
  {
    line: '{"kind":"batch"} queued jobs=4',
    level: 'unknown',
    message: '{"kind":"batch"} queued jobs=4',
    ids: [],
    json: { kind: 'batch' },
  },
  {
    line: '{ broken tail {"valid":2} end',
    level: 'unknown',
    message: '{ broken tail {"valid":2} end',
    ids: [],
    json: { valid: 2 },
  },
]

test('pathological lines parse within a fixed time budget', () => {
  for (const line of PATHOLOGICAL_LINES) parseLine(line)

  for (const line of PATHOLOGICAL_LINES) {
    const started = performance.now()
    parseLine(line)
    const elapsedMs = performance.now() - started
    expect(elapsedMs, `pathological line of length ${String(line.length)}`).toBeLessThan(
      PARSE_BUDGET_MS,
    )
  }
})

test('pathological lines still yield no json and no ids', () => {
  for (const line of PATHOLOGICAL_LINES) {
    const parsed = parseLine(line)
    expect(parsed.json, `json for line of length ${String(line.length)}`).toBeNull()
    expect(parsed.ids, `ids for line of length ${String(line.length)}`).toEqual([])
    expect(parsed.truncated).toBe(line.length > 100 * 1024)
  }
})

test('ordinary lines keep their parse result', () => {
  for (const pinned of PINNED_RESULTS) {
    const parsed = parseLine(pinned.line)
    expect(parsed.level, pinned.line).toBe(pinned.level)
    expect(parsed.message, pinned.line).toBe(pinned.message)
    expect(parsed.ids, pinned.line).toEqual(pinned.ids)
    expect(parsed.json, pinned.line).toEqual(pinned.json)
  }

  for (const line of SAMPLE_LINES) {
    const parsed = parseLine(line)
    expect(parsed.raw).toBe(line)
    expect(parsed.truncated).toBe(false)
  }

  for (const line of THROUGHPUT_POOL) {
    expect(parseLine(line).raw).toBe(line)
  }
})

test('absurd json volumes stay null instead of guessing', () => {
  const capped = parseLine(oversizedLine())
  expect(capped.truncated).toBe(true)
  expect(capped.raw.length).toBe(100 * 1024)
  expect(capped.level).toBe('error')
})
