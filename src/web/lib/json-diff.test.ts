import { describe, expect, test } from 'vitest'
import { diffJson, diffToText, diffValueText } from './json-diff.ts'

function kinds(entries: ReturnType<typeof diffJson>['entries']): string[] {
  return entries.map((entry) => `${entry.kind} ${entry.path}`)
}

describe('json diff', () => {
  test('equal values and key order produce no entries', () => {
    expect(diffJson({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }).entries).toEqual([])
    expect(diffJson(null, null).entries).toEqual([])
  })

  test('nested added, removed and changed paths', () => {
    const result = diffJson(
      { a: 1, b: { c: 2 }, gone: true },
      { a: 2, b: { c: 2, d: 3 }, added: 'x' },
    )
    expect(kinds(result.entries)).toEqual([
      'changed $.a',
      'added $.b.d',
      'removed $.gone',
      'added $.added',
    ])
    expect(result.truncated).toBe(false)
  })

  test('arrays compare by index and length', () => {
    expect(kinds(diffJson({ a: [1, 2] }, { a: [1, 3, 4] }).entries)).toEqual([
      'changed $.a[1]',
      'added $.a[2]',
    ])
    expect(kinds(diffJson([1, 2, 3], [1, 3]).entries)).toEqual(['changed $[1]', 'removed $[2]'])
  })

  test('type changes are reported at the path', () => {
    expect(kinds(diffJson({ a: {} }, { a: [] }).entries)).toEqual(['changed $.a'])
    expect(kinds(diffJson({ a: 1 }, { a: '1' }).entries)).toEqual(['changed $.a'])
    expect(kinds(diffJson(1, '1').entries)).toEqual(['changed $'])
  })

  test('keys that are not identifiers use brackets', () => {
    expect(kinds(diffJson({ 'a.b': 1 }, { 'a.b': 2 }).entries)).toEqual(['changed $["a.b"]'])
  })

  test('caps entries and flags truncation', () => {
    const left: number[] = []
    const right = Array.from({ length: 6_000 }, (_, index) => index)
    const result = diffJson(left, right)
    expect(result.entries).toHaveLength(5_000)
    expect(result.truncated).toBe(true)
  })

  test('formats copy text and long values', () => {
    const result = diffJson({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })
    expect(diffToText(result.entries)).toBe('~ $.b 2 -> 3\n+ $.c 4')
    expect(diffValueText('x'.repeat(200))).toHaveLength(118)
  })
})
