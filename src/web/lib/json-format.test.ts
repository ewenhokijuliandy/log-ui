import { describe, expect, test } from 'vitest'
import { decodeJsonText, MAX_PRETTIFY_BYTES, prettifyJsonText } from './json-format.ts'

describe('prettifyJsonText', () => {
  test('formats with two spaces by default', () => {
    const result = prettifyJsonText('{"b":1,"a":[true,null]}')
    expect(result).toEqual({
      ok: true,
      text: '{\n  "b": 1,\n  "a": [\n    true,\n    null\n  ]\n}',
      decoded: false,
    })
  })

  test('formats with four spaces when requested', () => {
    const result = prettifyJsonText('{"a":1}', { indent: 4 })
    expect(result).toEqual({ ok: true, text: '{\n    "a": 1\n}', decoded: false })
  })

  test('minifies', () => {
    expect(prettifyJsonText('{ "a": 1, "b": [true] }', { minify: true })).toEqual({
      ok: true,
      text: '{"a":1,"b":[true]}',
      decoded: false,
    })
  })

  test('sorts keys deeply while preserving arrays', () => {
    expect(
      prettifyJsonText('{"z":1,"a":{"y":2,"b":3},"items":[{"z":1,"a":2}]}', {
        sortKeys: true,
      }),
    ).toEqual({
      ok: true,
      text: '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "items": [\n    {\n      "a": 2,\n      "z": 1\n    }\n  ],\n  "z": 1\n}',
      decoded: false,
    })
  })

  test('sorts keys and minifies together', () => {
    expect(prettifyJsonText('{"b":1,"a":2}', { sortKeys: true, minify: true })).toEqual({
      ok: true,
      text: '{"a":2,"b":1}',
      decoded: false,
    })
  })

  test('preserves key order without sorting and accepts top-level scalars', () => {
    expect(prettifyJsonText('{"z":1,"a":2}')).toEqual({
      ok: true,
      text: '{\n  "z": 1,\n  "a": 2\n}',
      decoded: false,
    })
    expect(prettifyJsonText('"hello"')).toEqual({ ok: true, text: '"hello"', decoded: false })
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

describe('escaped and double-encoded JSON', () => {
  const escaped =
    '{\\"inputCommonServDtls\\":{\\"inpF01\\":\\"PRM000_3M\\",\\"inpArrDtls\\":[{\\"inpArrF02\\":\\"AUTH\\"}]}}'
  const object = {
    inputCommonServDtls: {
      inpF01: 'PRM000_3M',
      inpArrDtls: [{ inpArrF02: 'AUTH' }],
    },
  }

  test('prettifies backslash-escaped JSON', () => {
    const result = prettifyJsonText(escaped)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(JSON.parse(result.text)).toEqual(object)
    expect(result.text).toContain('\n  "inputCommonServDtls": {')
  })

  test('unwraps JSON embedded as a JSON string', () => {
    const result = prettifyJsonText(JSON.stringify(escaped))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(true)
    expect(JSON.parse(result.text)).toEqual(object)
  })

  test('unwraps a plain JSON string holding an object', () => {
    const result = prettifyJsonText(JSON.stringify(JSON.stringify(object)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.text)).toEqual(object)
  })

  test('leaves ordinary JSON untouched and reports it was not decoded', () => {
    const result = prettifyJsonText('{"a":1}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.decoded).toBe(false)
    expect(JSON.parse(result.text)).toEqual({ a: 1 })
  })

  test('keeps a genuine JSON string as a string', () => {
    const result = prettifyJsonText('"hello"')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toBe('"hello"')
    expect(result.decoded).toBe(false)
  })

  test('still rejects input that is not JSON at all', () => {
    expect(prettifyJsonText('not json').ok).toBe(false)
    expect(prettifyJsonText('{"a":').ok).toBe(false)
  })

  test('decodes escapes for unicode and newlines', () => {
    const escapedWithUnicode = '{\\"msg\\":\\"caf\\u00e9\\\\nnext\\"}'
    const decoded = decodeJsonText(escapedWithUnicode)
    expect(decoded?.value).toEqual({ msg: 'café\nnext' })
  })
})
