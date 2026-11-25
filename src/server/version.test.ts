import { describe, expect, test } from 'vitest'
import { readVersion } from './version.ts'

describe('readVersion', () => {
  test('reads the version from package.json', () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('reads the current version, not a cached one', () => {
    expect(readVersion()).toBe('1.4.1')
  })
})
