import { describe, expect, test } from 'vitest'
import type { StreamEntry } from '../app/stream-entry.ts'
import { closeInactiveBody, closeInactiveTitle, inactiveStreamsOf } from './sheets-model.ts'

function entry(name: string, kind: 'pipe' | 'manual', status: 'active' | 'stopped'): StreamEntry {
  return {
    id: name,
    name,
    kind,
    status,
    createdAt: 0,
    records: [],
    lineCount: 0,
    dropped: 0,
    levelCounts: {
      fatal: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
      unknown: 0,
    },
    firstSeq: null,
    lastSeq: null,
    pausedAt: null,
    cleared: false,
  } as unknown as StreamEntry
}

describe('close inactive tabs copy', () => {
  test('counts only ended pipe streams', () => {
    const streams = [
      entry('live', 'pipe', 'active'),
      entry('ended', 'pipe', 'stopped'),
      entry('manual', 'manual', 'stopped'),
    ]
    expect(inactiveStreamsOf(streams).map((item) => item.name)).toEqual(['ended'])
  })

  test('titles sing and pluralise', () => {
    expect(closeInactiveTitle([entry('one', 'pipe', 'stopped')])).toBe('Close 1 inactive tab?')
    expect(closeInactiveTitle([entry('a', 'pipe', 'stopped'), entry('b', 'pipe', 'stopped')])).toBe(
      'Close 2 inactive tabs?',
    )
    expect(closeInactiveTitle([entry('live', 'pipe', 'active')])).toBe('Close inactive tabs?')
  })

  test('body names what is kept, with correct verb agreement', () => {
    const liveKept = closeInactiveBody([
      entry('ended', 'pipe', 'stopped'),
      entry('live', 'pipe', 'active'),
    ])
    expect(liveKept).toContain('This closes 1 ended stream')
    expect(liveKept).toContain('1 live stream stays open')

    const noneKept = closeInactiveBody([entry('ended', 'pipe', 'stopped')])
    expect(noneKept).not.toContain('stays open')

    const bothKept = closeInactiveBody([
      entry('a', 'pipe', 'stopped'),
      entry('b', 'pipe', 'stopped'),
      entry('live-a', 'pipe', 'active'),
      entry('live-b', 'pipe', 'active'),
      entry('manual', 'manual', 'stopped'),
    ])
    expect(bothKept).toContain('2 live streams')
    expect(bothKept).toContain('1 manual tab')
    expect(bothKept).toContain('stay open')
  })

  test('body explains when nothing is inactive', () => {
    expect(closeInactiveBody([entry('live', 'pipe', 'active')])).toBe(
      'Every open tab is still live.',
    )
  })
})
