import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LogRecord } from '../shared/types.ts'

export type SavedMeta = {
  id: string
  name: string
  streamName: string
  savedAt: number
  rowCount: number
}

export type SavedEnvelope = SavedMeta & {
  zone: 'utc' | 'local'
  rules: unknown
  rows: LogRecord[]
}

const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/
const MAX_ROWS_CEILING = 200_000
const MAX_NAME_LENGTH = 120

export function savedDir(stateDir: string): string {
  return join(stateDir, 'saved')
}

function savedPath(stateDir: string, id: string): string | null {
  if (!ID_PATTERN.test(id)) return null
  return join(savedDir(stateDir), `${id}.json`)
}

function clampName(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, MAX_NAME_LENGTH)
  return trimmed.length === 0 ? fallback : trimmed
}

function toMeta(envelope: SavedEnvelope): SavedMeta {
  return {
    id: envelope.id,
    name: envelope.name,
    streamName: envelope.streamName,
    savedAt: envelope.savedAt,
    rowCount: envelope.rowCount,
  }
}

async function readEnvelope(path: string): Promise<SavedEnvelope | null> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as SavedEnvelope
    if (typeof parsed?.id !== 'string' || !Array.isArray(parsed.rows)) return null
    return parsed
  } catch {
    return null
  }
}

export async function listSaved(stateDir: string): Promise<SavedMeta[]> {
  const dir = savedDir(stateDir)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const metas: SavedMeta[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const envelope = await readEnvelope(join(dir, name))
    if (envelope === null) continue
    metas.push(toMeta(envelope))
  }
  return metas.sort((left, right) => right.savedAt - left.savedAt)
}

export async function readSaved(stateDir: string, id: string): Promise<SavedEnvelope | null> {
  const path = savedPath(stateDir, id)
  if (path === null) return null
  return readEnvelope(path)
}

export type CreateSavedInput = {
  name: string
  streamName: string
  zone: 'utc' | 'local'
  rules: unknown
  rows: readonly LogRecord[]
  bufferCap: number
}

export async function createSaved(
  stateDir: string,
  input: CreateSavedInput,
): Promise<SavedEnvelope> {
  const limit = Math.min(MAX_ROWS_CEILING, Math.max(1, input.bufferCap))
  const rows = input.rows.slice(-limit)
  const envelope: SavedEnvelope = {
    id: randomUUID(),
    name: clampName(input.name, `${input.streamName} — saved`),
    streamName: input.streamName,
    savedAt: Date.now(),
    rowCount: rows.length,
    zone: input.zone,
    rules: input.rules,
    rows,
  }
  await mkdir(savedDir(stateDir), { recursive: true })
  await writeFile(join(savedDir(stateDir), `${envelope.id}.json`), JSON.stringify(envelope), 'utf8')
  return envelope
}

export async function renameSaved(
  stateDir: string,
  id: string,
  name: string,
): Promise<SavedMeta | null> {
  const envelope = await readSaved(stateDir, id)
  if (envelope === null) return null
  const next: SavedEnvelope = { ...envelope, name: clampName(name, envelope.name) }
  const path = savedPath(stateDir, id)
  if (path === null) return null
  await writeFile(path, JSON.stringify(next), 'utf8')
  return toMeta(next)
}

export async function deleteSaved(stateDir: string, id: string): Promise<boolean> {
  const path = savedPath(stateDir, id)
  if (path === null) return false
  try {
    await unlink(path)
    return true
  } catch {
    return false
  }
}
