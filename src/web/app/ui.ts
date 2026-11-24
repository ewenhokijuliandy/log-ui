import { create } from 'zustand'

export type Screen = 'stream' | 'quick'

export type WorkspaceView = 'stream' | 'compare' | 'prettify' | 'merge' | 'graphql' | 'saved'

export type CompareStats = {
  added: number
  removed: number
  changed: number
  total: number
}

export type PrettyStats = {
  lines: number
}

type UiState = {
  screen: Screen
  workspaceView: WorkspaceView
  selectedSeq: Record<string, number | null>
  selectedMergedKey: string | null
  isolateTrace: string | null
  inspectorOpen: boolean
  theme: 'dark' | 'light'
  compareStats: CompareStats | null
  prettyStats: PrettyStats | null
}

type UiActions = {
  setScreen: (screen: Screen) => void
  setWorkspaceView: (view: WorkspaceView) => void
  select: (streamId: string | null, seq: number | null) => void
  selectMerged: (key: string | null) => void
  setIsolate: (trace: string | null) => void
  setInspectorOpen: (open: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
  setCompareStats: (stats: CompareStats | null) => void
  setPrettyStats: (stats: PrettyStats | null) => void
}

export const useUi = create<UiState & UiActions>((set) => ({
  screen: 'quick',
  workspaceView: 'stream',
  selectedSeq: {},
  selectedMergedKey: null,
  isolateTrace: null,
  inspectorOpen: false,
  theme: 'dark',
  compareStats: null,
  prettyStats: null,

  setScreen: (screen) => set({ screen }),

  setWorkspaceView: (workspaceView) => set({ workspaceView }),

  select: (streamId, seq) =>
    set((state) => {
      if (streamId === null) return { selectedSeq: {}, isolateTrace: null }
      const nextSelected: Record<string, number | null> = { ...state.selectedSeq }
      if (seq !== null || nextSelected[streamId] !== undefined) nextSelected[streamId] = seq
      return {
        selectedSeq: nextSelected,
        isolateTrace: streamId === null ? null : state.isolateTrace,
      }
    }),

  selectMerged: (selectedMergedKey) => set({ selectedMergedKey }),

  setIsolate: (trace) => set({ isolateTrace: trace }),

  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  setTheme: (theme) => set({ theme }),

  setCompareStats: (compareStats) => set({ compareStats }),

  setPrettyStats: (prettyStats) => set({ prettyStats }),
}))
