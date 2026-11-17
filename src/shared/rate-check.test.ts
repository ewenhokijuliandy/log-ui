import { expect, test } from 'vitest'
import { parseLine } from './parse-line.ts'
import { THROUGHPUT_POOL } from './tests/fixtures.ts'

const DEFAULT_FLOOR_LINES_PER_SECOND = 20_000
const WARMUP_LINES = 2_000
const SAMPLE_LINE_COUNT = 20_000
const SAMPLE_COUNT = 5

function parseFloor(): number {
  const raw = process.env.LOGDECK_PARSE_FLOOR ?? ''
  const parsed = Number(raw)
  const valid = raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0
  return valid ? parsed : DEFAULT_FLOOR_LINES_PER_SECOND
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

test('parser sustains at least the configured lines-per-second floor', () => {
  const floor = parseFloor()

  for (let i = 0; i < WARMUP_LINES; i += 1) {
    const warm = THROUGHPUT_POOL[i % THROUGHPUT_POOL.length] ?? ''
    parseLine(warm)
  }

  const lines: string[] = []
  for (let i = 0; i < SAMPLE_LINE_COUNT; i += 1) {
    lines.push(THROUGHPUT_POOL[i % THROUGHPUT_POOL.length] ?? '')
  }

  const samples: number[] = []
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const started = performance.now()
    for (const text of lines) parseLine(text)
    const elapsedMs = performance.now() - started
    samples.push(lines.length / (elapsedMs / 1000))
  }

  const perSecond = median(samples)
  expect(
    perSecond,
    `median ${Math.round(perSecond)} lines/s over ${String(SAMPLE_COUNT)} samples (floor ${String(floor)})`,
  ).toBeGreaterThan(floor)
})
