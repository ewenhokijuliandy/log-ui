import { describe, expect, test } from 'vitest'
import { MAX_STREAM_NAME, streamNameProblem } from './stream-name.ts'

describe('stream name validation', () => {
  test('accepts a fresh trimmed name', () => {
    expect(streamNameProblem('orders', ['api', 'worker'])).toBeNull()
  })

  test('rejects an empty name', () => {
    expect(streamNameProblem('', ['api'])).toEqual({
      kind: 'empty',
      message: 'Name cannot be empty.',
    })
  })

  test('rejects a name longer than the cap', () => {
    const name = 'x'.repeat(MAX_STREAM_NAME + 1)
    expect(streamNameProblem(name, [])?.kind).toBe('long')
    expect(streamNameProblem('x'.repeat(MAX_STREAM_NAME), [])).toBeNull()
  })

  test('rejects a name already used by another stream', () => {
    expect(streamNameProblem('worker', ['api', 'worker'])).toEqual({
      kind: 'duplicate',
      message: 'Name already in use.',
    })
  })
})
