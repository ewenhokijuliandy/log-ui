import { describe, expect, test } from 'vitest'
import { copyValueText, jsonEntries, jsonLeafText } from './json-value.ts'

describe('json helpers', () => {
  test('lists object keys and array indices', () => {
    expect(jsonEntries({ a: 1, b: 2 })).toEqual([
      ['a', 1],
      ['b', 2],
    ])
    expect(jsonEntries(['x', 'y'])).toEqual([
      ['0', 'x'],
      ['1', 'y'],
    ])
    expect(jsonEntries(null)).toEqual([])
    expect(jsonEntries('scalar')).toEqual([])
  })

  test('copies leaves as their value and branches as formatted json', () => {
    expect(copyValueText('line\nbreak "quoted"')).toBe('line\nbreak "quoted"')
    expect(copyValueText(42)).toBe('42')
    expect(copyValueText(false)).toBe('false')
    expect(copyValueText(null)).toBe('null')
    expect(copyValueText({ order: 'ord_8841', items: [1, { sku: 'SKU-4471' }] })).toBe(
      JSON.stringify({ order: 'ord_8841', items: [1, { sku: 'SKU-4471' }] }, null, 2),
    )
  })

  test('displays strings with escaped quotes and newlines', () => {
    expect(jsonLeafText('a"b\nc')).toBe('"a\\"b\\nc"')
    expect(jsonLeafText(12)).toBe('12')
    expect(jsonLeafText(null)).toBe('null')
  })

  test('keeps a 4 kb payload intact', () => {
    const payload = 'x'.repeat(4096)
    const value = { payload, nested: [[payload], { payload }] }
    expect(copyValueText(value).length).toBeGreaterThan(4096)
    expect(copyValueText(value)).toContain(payload)
  })
})
