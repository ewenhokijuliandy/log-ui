import { expect, test } from 'vitest'
import { parseLine } from './parse-line.ts'
import { THROUGHPUT_POOL } from './tests/fixtures.ts'

const FLOOR_LINES_PER_SECOND = 20_000
const WARMUP_LINES = 2_000

test('parser sustains at least 20k lines per second', () => {
  for (let i = 0; i < WARMUP_LINES; i += 1) {
    const warm = THROUGHPUT_POOL[i % THROUGHPUT_POOL.length] ?? ''
    parseLine(warm)
  }

  const lines: string[] = []
  for (let i = 0; i < 20_000; i += 1) {
    lines.push(THROUGHPUT_POOL[i % THROUGHPUT_POOL.length] ?? '')
  }

  const started = performance.now()
  for (const text of lines) parseLine(text)
  const elapsedMs = performance.now() - started

  const perSecond = lines.length / (elapsedMs / 1000)
  expect(
    perSecond,
    `measured ${Math.round(perSecond)} lines/s in ${elapsedMs.toFixed(0)}ms`,
  ).toBeGreaterThan(FLOOR_LINES_PER_SECOND)
})
