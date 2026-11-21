import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUFFER_CAP_DEFAULT, normalizeBufferCap } from '../shared/buffer-cap.ts'

export type ServerSettings = {
  bufferCap: number
}

export type SettingsStore = {
  get: () => ServerSettings
  load: () => Promise<void>
  setBufferCap: (value: number) => Promise<void>
}

export function settingsFilePath(stateDir: string): string {
  return join(stateDir, 'settings.json')
}

export function createSettingsStore(stateDir?: string): SettingsStore {
  let current: ServerSettings = { bufferCap: BUFFER_CAP_DEFAULT }

  return {
    get: () => ({ ...current }),
    load: async () => {
      if (stateDir === undefined) return
      try {
        const raw = await readFile(settingsFilePath(stateDir), 'utf8')
        const parsed = JSON.parse(raw) as { bufferCap?: unknown } | null
        const bufferCap = normalizeBufferCap(parsed?.bufferCap)
        if (bufferCap !== null) current = { bufferCap }
      } catch {
        current = { bufferCap: BUFFER_CAP_DEFAULT }
      }
    },
    setBufferCap: async (value: number) => {
      const bufferCap = normalizeBufferCap(value)
      if (bufferCap === null) throw new Error('invalid buffer cap')
      if (stateDir !== undefined) {
        await mkdir(stateDir, { recursive: true })
        await writeFile(settingsFilePath(stateDir), JSON.stringify({ bufferCap }, null, 2), 'utf8')
      }
      current = { bufferCap }
    },
  }
}
