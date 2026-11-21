import { describe, expect, test } from 'vitest'
import { MAX_PRETTIFY_BYTES, prettifyJsonText } from './json-format.ts'

describe('prettifyJsonText', () => {
  test('formats with two spaces by default', () => {
    const result = prettifyJsonText('{"b":1,"a":[true,null]}')
    expect(result).toEqual({
      ok: true,
      text: '{\n  "b": 1,\n  "a": [\n    true,\n    null\n  ]\n}',
    })
  })

  test('formats with four spaces when requested', () => {
    const result = prettifyJsonText('{"a":1}', 4)
    expect(result).toEqual({ ok: true, text: '{\n    "a": 1\n}' })
  })

  test('preserves key order and accepts top-level scalars', () => {
    expect(prettifyJsonText('{"z":1,"a":2}')).toEqual({
      ok: true,
      text: '{\n  "z": 1,\n  "a": 2\n}',
    })
    expect(prettifyJsonText('"hello"')).toEqual({ ok: true, text: '"hello"' })
  })

  test('reports empty input and invalid JSON', () => {
    expect(prettifyJsonText('   ')).toEqual({ ok: false, error: 'Paste JSON first.' })
    expect(prettifyJsonText('{"a":}')).toEqual({ ok: false, error: 'This is not valid JSON.' })
  })

  test('refuses input over the byte cap', () => {
    const oversized = `"${'a'.repeat(MAX_PRETTIFY_BYTES)}"`
    expect(prettifyJsonText(oversized)).toEqual({
      ok: false,
      error: 'This input is over 1 MB.',
    })
  })
})
