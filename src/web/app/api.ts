import type { StreamMeta } from '../../shared/types.ts'

export const FETCH_TIMEOUT_MS = 4000

const RENAME_FAILED = 'Could not rename this stream.'

export type RenameOutcome = { ok: true; name: string } | { ok: false; error: string }

const joinPath = (path: string): string => `${window.location.origin}${path}`

export async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(joinPath(path), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

function renameErrorFromBody(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
    return RENAME_FAILED
  } catch {
    return RENAME_FAILED
  }
}

export async function patchStreamName(id: string, name: string): Promise<RenameOutcome> {
  try {
    const response = await fetch(joinPath(`/api/streams/${id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      const raw = await response.text()
      return { ok: false, error: renameErrorFromBody(raw) }
    }
    const meta = (await response.json()) as StreamMeta
    return { ok: true, name: meta.name }
  } catch {
    return { ok: false, error: RENAME_FAILED }
  }
}

export type DeleteOutcome = { ok: true } | { ok: false; error: string }

export async function deleteStream(id: string): Promise<DeleteOutcome> {
  try {
    const response = await fetch(joinPath(`/api/streams/${id}`), {
      method: 'DELETE',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, error: 'Could not close this stream.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not close this stream.' }
  }
}

export async function clearStreamBuffer(id: string): Promise<void> {
  await fetch(joinPath(`/api/streams/${id}/clear`), { method: 'POST' })
}

export type ServerSettings = {
  bufferCap: number
}

export async function patchSettings(
  bufferCap: number,
): Promise<{ ok: true; settings: ServerSettings } | { ok: false; error: string }> {
  try {
    const response = await fetch(joinPath('/api/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bufferCap }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      let message = 'Could not save the buffer limit.'
      try {
        const parsed = (await response.json()) as { error?: unknown }
        if (typeof parsed.error === 'string') message = parsed.error
      } catch {
        message = 'Could not save the buffer limit.'
      }
      return { ok: false, error: message }
    }
    const settings = (await response.json()) as ServerSettings
    return { ok: true, settings }
  } catch {
    return { ok: false, error: 'Could not save the buffer limit.' }
  }
}

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
  rows: import('../../shared/types.ts').LogRecord[]
}

export type SaveOutcome = { ok: true; meta: SavedMeta } | { ok: false; error: string }

export async function fetchSavedList(): Promise<SavedMeta[]> {
  const list = await fetchJson<SavedMeta[]>('/api/saved')
  return list ?? []
}

export async function fetchSaved(id: string): Promise<SavedEnvelope | null> {
  return fetchJson<SavedEnvelope>(`/api/saved/${id}`)
}

export async function saveStream(input: {
  streamId: string
  name: string
  zone: 'utc' | 'local'
  rules: unknown
}): Promise<SaveOutcome> {
  try {
    const response = await fetch(joinPath('/api/saved'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, error: await response.text() }
    return { ok: true, meta: (await response.json()) as SavedMeta }
  } catch {
    return { ok: false, error: 'Could not save this log.' }
  }
}

export async function renameSavedLog(id: string, name: string): Promise<SaveOutcome> {
  try {
    const response = await fetch(joinPath(`/api/saved/${id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, error: await response.text() }
    return { ok: true, meta: (await response.json()) as SavedMeta }
  } catch {
    return { ok: false, error: 'Could not rename this saved log.' }
  }
}

export async function deleteSavedLog(id: string): Promise<DeleteOutcome> {
  try {
    const response = await fetch(joinPath(`/api/saved/${id}`), {
      method: 'DELETE',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, error: 'Could not delete this saved log.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete this saved log.' }
  }
}
