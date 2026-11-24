import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { LogRecord } from '../shared/types.ts'
import {
  createSaved,
  deleteSaved,
  listSaved,
  readSaved,
  renameSaved,
  savedDir,
} from './saved-store.ts'

const makeRow = (seq: number): LogRecord => ({
  seq,
  ts: 1_700_000_000_000 + seq,
  level: 'info',
  message: `line ${String(seq)}`,
  raw: `line ${String(seq)}`,
  json: null,
  ids: [],
  truncated: false,
})

describe('saved store', () => {
  let stateDir = ''

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), 'logdeck-saved-'))
  })

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true })
  })

  test('starts empty and creates a directory on first save', async () => {
    expect(await listSaved(stateDir)).toEqual([])
    await createSaved(stateDir, {
      name: 'first',
      streamName: 'api',
      zone: 'utc',
      rules: null,
      rows: [makeRow(1)],
      bufferCap: 100,
    })
    const names = await readdir(savedDir(stateDir))
    expect(names).toHaveLength(1)
    expect(names[0].endsWith('.json')).toBe(true)
  })

  test('round-trips the envelope including rules and zone', async () => {
    const created = await createSaved(stateDir, {
      name: 'decline',
      streamName: 'payments',
      zone: 'local',
      rules: { levelKey: 'lvl' },
      rows: [makeRow(1), makeRow(2)],
      bufferCap: 100,
    })
    const loaded = await readSaved(stateDir, created.id)
    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe('decline')
    expect(loaded?.streamName).toBe('payments')
    expect(loaded?.zone).toBe('local')
    expect(loaded?.rules).toEqual({ levelKey: 'lvl' })
    expect(loaded?.rowCount).toBe(2)
    expect(loaded?.rows.map((row) => row.seq)).toEqual([1, 2])
  })

  test('caps the stored rows at the buffer cap, keeping the newest', async () => {
    const rows = Array.from({ length: 50 }, (_, index) => makeRow(index + 1))
    const created = await createSaved(stateDir, {
      name: 'capped',
      streamName: 'api',
      zone: 'utc',
      rules: null,
      rows,
      bufferCap: 10,
    })
    const loaded = await readSaved(stateDir, created.id)
    expect(loaded?.rowCount).toBe(10)
    expect(loaded?.rows[0].seq).toBe(41)
    expect(loaded?.rows[9].seq).toBe(50)
  })

  test('lists newest first with metadata only', async () => {
    const first = await createSaved(stateDir, {
      name: 'older',
      streamName: 'a',
      zone: 'utc',
      rules: null,
      rows: [makeRow(1)],
      bufferCap: 100,
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createSaved(stateDir, {
      name: 'newer',
      streamName: 'b',
      zone: 'utc',
      rules: null,
      rows: [makeRow(1), makeRow(2)],
      bufferCap: 100,
    })
    const list = await listSaved(stateDir)
    expect(list.map((item) => item.id)).toEqual([second.id, first.id])
    expect(Object.keys(list[0]).sort()).toEqual([
      'counts',
      'id',
      'name',
      'rowCount',
      'savedAt',
      'streamName',
    ])
  })

  test('renames and keeps the rows intact', async () => {
    const created = await createSaved(stateDir, {
      name: 'before',
      streamName: 'api',
      zone: 'utc',
      rules: null,
      rows: [makeRow(1)],
      bufferCap: 100,
    })
    const renamed = await renameSaved(stateDir, created.id, 'after')
    expect(renamed?.name).toBe('after')
    const loaded = await readSaved(stateDir, created.id)
    expect(loaded?.name).toBe('after')
    expect(loaded?.rows).toHaveLength(1)
  })

  test('deletes the file from disk', async () => {
    const created = await createSaved(stateDir, {
      name: 'gone',
      streamName: 'api',
      zone: 'utc',
      rules: null,
      rows: [makeRow(1)],
      bufferCap: 100,
    })
    expect(await deleteSaved(stateDir, created.id)).toBe(true)
    expect(await readSaved(stateDir, created.id)).toBeNull()
    expect(await listSaved(stateDir)).toEqual([])
    expect(await deleteSaved(stateDir, created.id)).toBe(false)
  })

  test('rejects ids that could escape the saved directory', async () => {
    expect(await readSaved(stateDir, '../settings')).toBeNull()
    expect(await deleteSaved(stateDir, '../../etc/passwd')).toBe(false)
    expect(await renameSaved(stateDir, '../x', 'nope')).toBeNull()
  })

  test('reports the level mix for each entry', async () => {
    const rows: LogRecord[] = [
      { ...makeRow(1), level: 'error' },
      { ...makeRow(2), level: 'fatal' },
      { ...makeRow(3), level: 'warn' },
      { ...makeRow(4), level: 'info' },
      { ...makeRow(5), level: 'debug' },
      { ...makeRow(6), level: 'trace' },
      { ...makeRow(7), level: 'unknown' },
    ]
    const created = await createSaved(stateDir, {
      name: 'mixed',
      streamName: 'api',
      zone: 'utc',
      rules: null,
      rows,
      bufferCap: 100,
    })
    const [meta] = await listSaved(stateDir)
    expect(meta.id).toBe(created.id)
    expect(meta.counts).toEqual({ error: 2, warn: 1, info: 1, debug: 2, unknown: 1 })
  })

  test('clamps an empty name to a readable fallback', async () => {
    const created = await createSaved(stateDir, {
      name: '   ',
      streamName: 'worker',
      zone: 'utc',
      rules: null,
      rows: [makeRow(1)],
      bufferCap: 100,
    })
    expect(created.name).toBe('worker — saved')
  })
})
