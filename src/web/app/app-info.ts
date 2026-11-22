import { create } from 'zustand'
import { fetchJson } from './api.ts'

export type HealthResponse = {
  ok: boolean
  pid: number
  version: string
  startedAt: number
  port: number
  node: string
}

type AppInfoState = {
  version: string | null
  pid: number | null
  startedAt: number | null
  port: number | null
  node: string | null
  loaded: boolean
}

type AppInfoActions = {
  loadAppInfo: () => Promise<void>
}

export const useAppInfo = create<AppInfoState & AppInfoActions>((set) => ({
  version: null,
  pid: null,
  startedAt: null,
  port: null,
  node: null,
  loaded: false,

  loadAppInfo: async () => {
    const health = await fetchJson<HealthResponse>('/api/health')
    if (health === null) {
      set({ loaded: true })
      return
    }
    set({
      version: health.version,
      pid: health.pid,
      startedAt: health.startedAt,
      port: health.port,
      node: health.node,
      loaded: true,
    })
  },
}))
