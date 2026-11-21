import { describe, expect, test } from 'vitest'
import { formatStreamBanner } from './banner.ts'

const base = {
  name: 'api',
  port: 3333,
  columns: 80,
  unicode: true,
  color: false,
} as const

describe('formatStreamBanner', () => {
  test('formats the wide TTY banner', () => {
    expect(formatStreamBanner({ ...base, daemonState: 'running' })).toEqual([
      '▌ logdeck  api',
      '  streaming   http://127.0.0.1:3333',
      '  daemon      already running on port 3333',
      '  stop        Ctrl+C this stream  ·  logdeck stop all',
    ])
  })

  test('distinguishes a freshly started daemon', () => {
    const lines = formatStreamBanner({ ...base, daemonState: 'started' })
    expect(lines[2]).toBe('  daemon      started on port 3333')
  })

  test('falls back to ASCII glyphs and separators', () => {
    expect(formatStreamBanner({ ...base, daemonState: 'started', unicode: false })).toEqual([
      '| logdeck  api',
      '  streaming   http://127.0.0.1:3333',
      '  daemon      started on port 3333',
      '  stop        Ctrl+C this stream  -  logdeck stop all',
    ])
  })

  test('uses the narrow three-line form below 62 columns', () => {
    expect(formatStreamBanner({ ...base, daemonState: 'running', columns: 61 })).toEqual([
      '▌ logdeck  api',
      '  http://127.0.0.1:3333',
      '  Ctrl+C stop  ·  logdeck stop all',
    ])
  })

  test('colors only the leading mark', () => {
    const [first, second] = formatStreamBanner({
      ...base,
      daemonState: 'running',
      color: true,
    })
    expect(first).toBe('\u001b[38;2;74;138;214m▌\u001b[0m logdeck  api')
    expect(second).toBe('  streaming   http://127.0.0.1:3333')
  })
})
