import type { LogLevel } from './types.ts'

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'unknown'] as const
export const LEVEL_ORDER = LEVELS as readonly LogLevel[]

export type LevelCounts = Record<LogLevel, number>

export type LevelChipKey = 'all' | 'error' | 'warn' | 'info' | 'debug'

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
}

export const LEVEL_CHIPS: readonly LevelChipKey[] = ['all', 'error', 'warn', 'info', 'debug']

export function chipShowsLevel(chip: LevelChipKey, level: LogLevel): boolean {
  if (chip === 'all') return true
  if (level === 'unknown') return true
  return CHIP_GROUPS[chip].includes(level)
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
