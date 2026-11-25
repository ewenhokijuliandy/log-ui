import { describe, expect, test } from 'vitest'
import { readVersion } from '../server/version.ts'

describe('daemon version handshake', () => {
  test('the CLI and the daemon read the same version source', () => {
    expect(readVersion()).toBe('1.4.1')
  })
})
