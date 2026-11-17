import { describe, expect, it } from 'vitest'
import { beginCopy, COPIED_MS, clearCopy, copiedKeyFor, IDLE_COPY } from './use-copy-feedback.ts'

describe('copy feedback state', () => {
  it('starts idle with no copied key', () => {
    expect(IDLE_COPY.key).toBeNull()
    expect(copiedKeyFor(IDLE_COPY, undefined)).toBeNull()
  })

  it('records the key of the last copied value', () => {
    const state = beginCopy('raw', 42)
    expect(state.key).toBe('raw')
    expect(copiedKeyFor(state, 42)).toBe('raw')
  })

  it('reports no copied key once the selection moves on', () => {
    const state = beginCopy('raw', 42)
    expect(copiedKeyFor(state, 43)).toBeNull()
  })

  it('keeps the scope while clearing the key', () => {
    const state = clearCopy(beginCopy('json', 7))
    expect(state.key).toBeNull()
    expect(state.scope).toBe(7)
    expect(copiedKeyFor(state, 7)).toBeNull()
  })

  it('shows Copied for 1.2 seconds', () => {
    expect(COPIED_MS).toBe(1_200)
  })
})
