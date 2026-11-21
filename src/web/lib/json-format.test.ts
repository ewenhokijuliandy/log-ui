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
    const result = prettifyJsonText('{"a":1}', { indent: 4 })
    expect(result).toEqual({ ok: true, text: '{\n    "a": 1\n}' })
  })

  test('minifies', () => {
    expect(prettifyJsonText('{ "a": 1, "b": [true] }', { minify: true })).toEqual({
      ok: true,
      text: '{"a":1,"b":[true]}',
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
    })
  })

  test('sorts keys and minifies together', () => {
    expect(prettifyJsonText('{"b":1,"a":2}', { sortKeys: true, minify: true })).toEqual({
      ok: true,
      text: '{"a":2,"b":1}',
    })
  })

  test('preserves key order without sorting and accepts top-level scalars', () => {
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
