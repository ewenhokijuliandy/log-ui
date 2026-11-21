import { describe, expect, test } from 'vitest'
import { DEFAULT_FILTER } from './filters.ts'
import {
  createPreset,
  loadPresets,
  PRESETS_KEY,
  type PresetStorage,
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
  test('starts with no presets when storage is empty', () => {
    const storage = fakeStorage()
    expect(loadPresets(storage)).toEqual([])
    expect(storage.data.has(PRESETS_KEY)).toBe(false)
  })

  test('drops the retired seed presets from existing storage', () => {
    const storage = fakeStorage({
      [PRESETS_KEY]: JSON.stringify([
        { id: 'payments-5xx', name: 'payments 5xx' },
        { id: 'checkout-slow', name: 'checkout slow' },
        { id: 'trace-5b8e', name: 'trace 5b8e' },
        { id: 'custom', name: 'mine' },
      ]),
    })
    const presets = loadPresets(storage)
    expect(presets.map((preset) => preset.id)).toEqual(['custom'])
    expect(JSON.parse(storage.data.get(PRESETS_KEY) ?? '[]')).toHaveLength(1)
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
        chips: ['error', 'warn'],
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
      levels: ['error', 'warn'],
      range: 'custom',
      sort: 'oldest',
      trace: 'trace-1',
      from: 1_700_000_000_000,
      to: 1_700_000_600_000,
    })
  })

  test('normalizes legacy and current levels, ignoring corrupt storage', () => {
    const legacy = fakeStorage({
      [PRESETS_KEY]: JSON.stringify([
        { id: 'legacy', name: 'legacy', query: 'api', regex: false, level: 'warn', range: '15m' },
        { id: 'all-level', name: 'legacy all', level: 'all' },
        { id: 'current', name: 'current', levels: ['error', 'bogus', 'all', 'error'] },
        { name: 'missing id' },
      ]),
    })
    const [preset, allLevel, current, ...rest] = loadPresets(legacy)
    expect(rest).toEqual([])
    expect(preset).toMatchObject({
      id: 'legacy',
      name: 'legacy',
      levels: ['warn'],
      range: '15m',
      sort: 'newest',
      trace: null,
      from: null,
      to: null,
    })
    expect(allLevel?.levels).toEqual([])
    expect(current?.levels).toEqual(['error'])
    expect(loadPresets(fakeStorage({ [PRESETS_KEY]: '{not json' }))).toEqual([])
  })
})
