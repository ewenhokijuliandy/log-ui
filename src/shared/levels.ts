import type { LogLevel } from './types.ts'

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'unknown'] as const
export const LEVEL_ORDER = LEVELS as readonly LogLevel[]

const NUMERIC_LEVEL_BANDS: Readonly<Record<number, LogLevel | undefined>> = {
  0: 'fatal',
  1: 'fatal',
  2: 'fatal',
  3: 'error',
  4: 'warn',
  5: 'info',
  6: 'info',
  7: 'debug',
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
}

export function levelFromNumeric(value: number | string): LogLevel | null {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null
  const numeric = typeof value === 'number' ? value : Number(value.trim())
  if (!Number.isInteger(numeric)) return null
  return NUMERIC_LEVEL_BANDS[numeric] ?? null
}

export type LevelCounts = Record<LogLevel, number>

export type LevelChipKey = 'all' | 'error' | 'warn' | 'info' | 'debug' | 'unknown'

export const EMPTY_LEVEL_COUNTS: LevelCounts = {
  fatal: 0,
  error: 0,
  warn: 0,
  info: 0,
  debug: 0,
  trace: 0,
  unknown: 0,
}

export function emptyLevelCounts(): LevelCounts {
  return { ...EMPTY_LEVEL_COUNTS }
}

const CHIP_GROUPS: Record<Exclude<LevelChipKey, 'all'>, readonly LogLevel[]> = {
  error: ['fatal', 'error'],
  warn: ['warn'],
  info: ['info'],
  debug: ['debug', 'trace'],
  unknown: ['unknown'],
}

export const LEVEL_CHIPS: readonly LevelChipKey[] = [
  'all',
  'error',
  'warn',
  'info',
  'debug',
  'unknown',
]

export function chipShowsLevel(chip: LevelChipKey, level: LogLevel): boolean {
  if (chip === 'all') return true
  return CHIP_GROUPS[chip].includes(level)
}

export function chipShowsRecord(chips: readonly LevelChipKey[], level: LogLevel): boolean {
  if (chips.length === 0) return true
  return chips.some((chip) => chipShowsLevel(chip, level))
}

export function sumCounts(target: LevelCounts, source: LevelCounts): void {
  for (const level of LEVEL_ORDER) target[level] += source[level]
}

export function copyCounts(counts: LevelCounts): LevelCounts {
  return { ...counts }
}

export function countForChip(counts: LevelCounts, chip: LevelChipKey): number {
  let total = 0
  for (const level of LEVEL_ORDER) if (chipShowsLevel(chip, level)) total += counts[level]
  return total
}
