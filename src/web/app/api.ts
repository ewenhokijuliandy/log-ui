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

export async function deleteStream(id: string): Promise<void> {
  await fetch(joinPath(`/api/streams/${id}`), { method: 'DELETE' })
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
