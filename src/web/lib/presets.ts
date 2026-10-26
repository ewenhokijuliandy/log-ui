import type { LevelChipKey } from '../../shared/levels.ts'
import type { FilterState, RangeKey, SortKey } from './filters.ts'

export type Preset = {
  id: string
  name: string
  query: string
  regex: boolean
  level: LevelChipKey
  range: RangeKey
  sort: SortKey
  trace: string | null
  from: number | null
  to: number | null
}

export type PresetStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export const PRESETS_KEY = 'log-ui.presets'

const DESIGN_TRACE_ID = '5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d'

const LEVEL_KEYS: readonly LevelChipKey[] = ['all', 'error', 'warn', 'info', 'debug']
const RANGE_KEYS: readonly RangeKey[] = ['5m', '15m', '1h', 'all', 'custom']

export const SEED_PRESETS: readonly Preset[] = [
  {
    id: 'payments-5xx',
    name: 'payments 5xx',
    query: 'payments',
    regex: false,
    level: 'error',
    range: '15m',
    sort: 'newest',
    trace: null,
    from: null,
    to: null,
  },
  {
    id: 'checkout-slow',
    name: 'checkout slow',
    query: 'checkout|latency',
    regex: true,
    level: 'warn',
    range: 'all',
    sort: 'newest',
    trace: null,
    from: null,
    to: null,
  },
  {
    id: 'trace-5b8e',
    name: 'trace 5b8e',
    query: '',
    regex: false,
    level: 'all',
    range: 'all',
    sort: 'newest',
    trace: DESIGN_TRACE_ID,
    from: null,
    to: null,
  },
]

export function createPreset(
  id: string,
  name: string,
  filter: FilterState,
  sort: SortKey,
  trace: string | null,
): Preset {
  return {
    id,
    name: name.trim(),
    query: filter.query.trim(),
    regex: filter.regexMode,
    level: filter.chip,
    range: filter.range,
    sort,
    trace,
    from: filter.from,
    to: filter.to,
  }
}

export function loadPresets(storage: PresetStorage): Preset[] {
  let raw: string | null
  try {
    raw = storage.getItem(PRESETS_KEY)
  } catch {
    raw = null
  }
  if (raw === null) {
    const seeded = SEED_PRESETS.map((preset) => ({ ...preset }))
    savePresets(storage, seeded)
    return seeded
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const presets: Preset[] = []
    for (const entry of parsed) {
      const preset = normalizePreset(entry)
      if (preset !== null) presets.push(preset)
    }
    return presets
  } catch {
    return []
  }
}

export function savePresets(storage: PresetStorage, presets: readonly Preset[]): void {
  try {
    storage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {}
}

function normalizePreset(value: unknown): Preset | null {
  if (value === null || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: raw.name,
    query: typeof raw.query === 'string' ? raw.query : '',
    regex: raw.regex === true,
    level: isLevelKey(raw.level) ? raw.level : 'all',
    range: isRangeKey(raw.range) ? raw.range : 'all',
    sort: raw.sort === 'oldest' ? 'oldest' : 'newest',
    trace: typeof raw.trace === 'string' && raw.trace.length > 0 ? raw.trace : null,
    from: isStamp(raw.from) ? raw.from : null,
    to: isStamp(raw.to) ? raw.to : null,
  }
}

function isLevelKey(value: unknown): value is LevelChipKey {
  return LEVEL_KEYS.includes(value as LevelChipKey)
}

function isRangeKey(value: unknown): value is RangeKey {
  return RANGE_KEYS.includes(value as RangeKey)
}

function isStamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
