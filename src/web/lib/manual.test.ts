import { describe, expect, test } from 'vitest'
import { MANUAL_FILE_LIMIT, manualFileProblem, parseManual } from './manual.ts'

describe('manual parsing', () => {
  test('skips blank lines and numbers the remaining lines', () => {
    const result = parseManual(
      '2026-10-26 10:00:00,000 INFO one\n\n  \n2026-10-26 10:00:01,000 ERROR two',
      10_000,
    )
    expect(result.totalLines).toBe(2)
    expect(result.records.map((record) => record.seq)).toEqual([1, 2])
    expect(result.records.map((record) => record.level)).toEqual(['info', 'error'])
  })

  test('keeps only the last cap lines with their original sequence numbers', () => {
    const text = Array.from(
      { length: 25 },
      (_, index) => `2026-10-26 10:00:00,000 INFO line ${String(index + 1)}`,
    ).join('\n')
    const result = parseManual(text, 10)
    expect(result.totalLines).toBe(25)
    expect(result.records).toHaveLength(10)
    expect(result.records[0]?.seq).toBe(16)
    expect(result.records[9]?.seq).toBe(25)
    expect(result.records[9]?.message).toContain('line 25')
  })

  test('parses JSON bodies and the design timestamp format', () => {
    const result = parseManual(
      '2026-10-26 10:00:00,000 INFO svc - hello\n{"level":"warn","time":"2026-10-26T10:00:01.000Z","msg":"body","n":1}',
      10_000,
    )
    expect(result.records[0]?.ts).not.toBeNull()
    expect(result.records[1]?.level).toBe('warn')
    expect(result.records[1]?.json).toEqual({
      level: 'warn',
      time: '2026-10-26T10:00:01.000Z',
      msg: 'body',
      n: 1,
    })
  })

  test('returns an empty result for blank input', () => {
    expect(parseManual('\n \n', 10_000)).toEqual({ records: [], totalLines: 0 })
  })

  test('parses a 5 MB file within two seconds', () => {
    const line =
      '2026-10-26 10:00:00,000 INFO http-nio-8080-exec-1 c.v.orders.OrderService - order 4471 persisted in 12 ms'
    const count = Math.floor((5 * 1024 * 1024) / (line.length + 1))
    const text = Array.from({ length: count }, (_, index) => `${line} ${String(index)}`).join('\n')
    const started = performance.now()
    const result = parseManual(text, 10_000)
    const elapsed = performance.now() - started
    expect(result.totalLines).toBe(count)
    expect(result.records).toHaveLength(10_000)
    expect(result.records[9999]?.seq).toBe(count)
    expect(elapsed).toBeLessThan(2_000)
  })
})

describe('manual file guards', () => {
  test('accepts .txt, .log and text/plain files within the size limit', () => {
    expect(manualFileProblem({ name: 'app.log', size: 1024, type: '' })).toBeNull()
    expect(manualFileProblem({ name: 'APP.TXT', size: 1024, type: '' })).toBeNull()
    expect(manualFileProblem({ name: 'capture', size: 1024, type: 'text/plain' })).toBeNull()
  })

  test('rejects unsupported file types', () => {
    expect(manualFileProblem({ name: 'photo.png', size: 10, type: 'image/png' })).toBe(
      'Manual mode accepts .txt and .log files.',
    )
  })

  test('rejects files over the 25 MB limit with the real size', () => {
    expect(
      manualFileProblem({ name: 'huge.log', size: MANUAL_FILE_LIMIT + 1, type: 'text/plain' }),
    ).toBe('This file is 25.0 MB. Manual mode accepts up to 25 MB.')
  })
})
