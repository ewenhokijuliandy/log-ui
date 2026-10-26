import { describe, expect, test } from 'vitest'
import { DEFAULT_FILTER } from './filters.ts'
import {
  createPreset,
  loadPresets,
  PRESETS_KEY,
  type PresetStorage,
  SEED_PRESETS,
  savePresets,
} from './presets.ts'

function fakeStorage(
  initial: Record<string, string> = {},
): PresetStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('filter presets', () => {
  test('seeds the design presets on first run and persists them', () => {
    const storage = fakeStorage()
    const presets = loadPresets(storage)
    expect(presets.map((preset) => preset.name)).toEqual([
      'payments 5xx',
      'checkout slow',
      'trace 5b8e',
    ])
    expect(presets[0]).toMatchObject({ query: 'payments', level: 'error', range: '15m' })
    expect(presets[1]).toMatchObject({ query: 'checkout|latency', regex: true, level: 'warn' })
    expect(presets[2]?.trace).toBe('5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d')
    expect(storage.data.has(PRESETS_KEY)).toBe(true)
    expect(loadPresets(storage)).toHaveLength(SEED_PRESETS.length)
  })

  test('does not reseed after the user deletes every preset', () => {
    const storage = fakeStorage()
    savePresets(storage, [])
    expect(loadPresets(storage)).toEqual([])
  })

  test('roundtrips a saved view including a custom range', () => {
    const storage = fakeStorage({ [PRESETS_KEY]: '[]' })
    const preset = createPreset(
      'custom-view',
      '  checkout window  ',
      {
        ...DEFAULT_FILTER,
        query: '  timeout ',
        regexMode: true,
        chip: 'error',
        range: 'custom',
        from: 1_700_000_000_000,
        to: 1_700_000_600_000,
      },
      'oldest',
      'trace-1',
    )
    savePresets(storage, [preset])
    const [loaded] = loadPresets(storage)
    expect(loaded).toEqual({
      id: 'custom-view',
      name: 'checkout window',
      query: 'timeout',
      regex: true,
      level: 'error',
      range: 'custom',
      sort: 'oldest',
      trace: 'trace-1',
      from: 1_700_000_000_000,
      to: 1_700_000_600_000,
    })
  })

  test('normalizes legacy presets and ignores corrupt storage', () => {
    const legacy = fakeStorage({
      [PRESETS_KEY]: JSON.stringify([
        { id: 'legacy', name: 'legacy', query: 'api', regex: false, level: 'warn', range: '15m' },
        { name: 'missing id' },
      ]),
    })
    const [preset, ...rest] = loadPresets(legacy)
    expect(rest).toEqual([])
    expect(preset).toMatchObject({
      id: 'legacy',
      name: 'legacy',
      level: 'warn',
      range: '15m',
      sort: 'newest',
      trace: null,
      from: null,
      to: null,
    })
    expect(loadPresets(fakeStorage({ [PRESETS_KEY]: '{not json' }))).toEqual([])
  })
})
