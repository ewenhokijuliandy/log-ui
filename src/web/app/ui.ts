import { create } from 'zustand'

export type Screen = 'stream' | 'quick'

type UiState = {
  screen: Screen
  selectedSeq: Record<string, number | null>
  isolateTrace: string | null
  inspectorOpen: boolean
  theme: 'dark' | 'light'
}

type UiActions = {
  setScreen: (screen: Screen) => void
  select: (streamId: string | null, seq: number | null) => void
  setIsolate: (trace: string | null) => void
  setInspectorOpen: (open: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
}

export const useUi = create<UiState & UiActions>((set) => ({
  screen: 'quick',
  selectedSeq: {},
  isolateTrace: null,
  inspectorOpen: false,
  theme: 'dark',

  setScreen: (screen) => set({ screen }),

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

  setIsolate: (trace) => set({ isolateTrace: trace }),

  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  setTheme: (theme) => set({ theme }),
}))
