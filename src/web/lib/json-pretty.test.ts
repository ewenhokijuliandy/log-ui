import { describe, expect, test } from 'vitest'
import { jsonTokens, prettyJson } from './json-pretty.ts'

describe('pretty JSON', () => {
  test('formats nested objects and arrays', () => {
    const value = { a: 1, b: [true, null], c: { d: 'x' } }
    const text = prettyJson(value)
    expect(text).toContain('\n  "a": 1')
    expect(text).toContain('\n  "b": [')
    expect(JSON.parse(text)).toEqual(value)
  })

  test('tokens reconstruct the pretty text', () => {
    const value = {
      msg: 'a "quote" and \\ slash',
      n: -1.5e3,
      ok: true,
      none: null,
      nested: { k: 'v' },
    }
    const tokens = jsonTokens(value)
    expect(tokens.map((token) => token.text).join('')).toBe(prettyJson(value))
    const kinds = new Set(tokens.map((token) => token.kind))
    expect(kinds).toContain('key')
    expect(kinds).toContain('string')
    expect(kinds).toContain('number')
    expect(kinds).toContain('bool')
    expect(kinds).toContain('null')
    expect(kinds).toContain('plain')
  })

  test('string contents do not become keys or numbers', () => {
    const tokens = jsonTokens({ text: '10: "not a key" 42' })
    expect(tokens.filter((token) => token.kind === 'number')).toHaveLength(0)
    expect(tokens.find((token) => token.kind === 'string')?.text).toContain('not a key')
  })

  test('handles empty and unsupported values', () => {
    expect(prettyJson(undefined)).toBe('')
    expect(jsonTokens(undefined)).toEqual([])
    expect(prettyJson([1, 2])).toBe('[\n  1,\n  2\n]')
  })
})
