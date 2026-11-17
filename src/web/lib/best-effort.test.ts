import { describe, expect, test } from 'vitest'
import { bestEffort } from './best-effort.ts'

describe('bestEffort', () => {
  test('runs the action when it succeeds', () => {
    let calls = 0
    bestEffort(() => {
      calls += 1
    })
    expect(calls).toBe(1)
  })

  test('swallows errors thrown by the action', () => {
    expect(() =>
      bestEffort(() => {
        throw new Error('quota exceeded')
      }),
    ).not.toThrow()
  })
})
