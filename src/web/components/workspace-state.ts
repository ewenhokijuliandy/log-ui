import { useEffect, useState } from 'react'
import { countForChip } from '../../shared/levels.ts'
import { normalizeParseRules, type ParseRules } from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import { patchSettings, saveStream } from '../app/api.ts'
import { emptyStateText } from '../app/empty-state.ts'
import { loadParseRules, saveParseRules } from '../app/parse-rules.ts'
import {
  clampInspectorWidth,
  defaultInspectorWidth,
  loadInspectorWidth,
  type Prefs,
  saveInspectorWidth,
} from '../app/prefs.ts'
import { levelCountTotal, reconnectNow, useStreams } from '../app/store.ts'
import { useUi, type WorkspaceView } from '../app/ui.ts'
import { useKeyboardShortcuts } from '../app/use-keyboard-shortcuts.ts'
import { usePrefsEffects } from '../app/use-prefs-effects.ts'
import { usePresetActions } from '../app/use-preset-actions.ts'
import {
  DEFAULT_FILTER,
  DEFAULT_SORT,
  type FilterState,
  filterError,
  filtersActive,
  type SortKey,
} from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import { useMediaQuery } from '../lib/media.ts'
import { pendingCount } from '../lib/pause.ts'
import { loadPresets, type Preset } from '../lib/presets.ts'
import { buildPrintPages } from '../lib/print-sheet.ts'
import { downloadText, exportRecords, exportText } from './export.tsx'
import {
  buildSheets,
  type MoreModel,
  type PdfState,
  type SheetName,
  type SheetsModel,
} from './sheets-model.ts'
import type { StreamActions, StreamData } from './stream-view.tsx'
import {
  flippedTheme,
  useBootEffect,
  useDerivedCounts,
  useDerivedRecords,
  useQuickStartAdvance,
  useSelectionSync,
  useVisibleRecords,
} from './workspace-derivations.ts'

export type { PdfState, SheetName }

export type Workspace = {
  zeroStreams: boolean
  bufferCap: number
  onBackToLogs: () => void
  stream: {
    data: StreamData
    actions: StreamActions
    filter: FilterState
    sort: SortKey
    prefs: Prefs
    presets: Preset[]
  }
  exportMenu: {
    count: number
    onTxt: () => void
    onPdf: () => void
  }
  merge: {
    inspectorWidth: number
    onInspectorWidth: (width: number) => void
    onResetInspectorWidth: () => void
  }
  rail: {
    openSheet: (target: SheetName) => void
    toggleTheme: () => void
    onStreams: () => void
    onMerge: () => void
    onCompare: () => void
    onPretty: () => void
    onGraphql: () => void
    onSaved: () => void
    workspaceView: WorkspaceView
    expanded: boolean
    onToggleExpanded: () => void
  }
  topBar: {
    openSheet: (target: SheetName) => void
    toggleTheme: () => void
    onSimulateLoss: () => void
  }
  tabs: {
    onQuickStart: () => void
    onCloseTab: (id: string) => void
    onCloseAll: () => void
    toolViewActive: boolean
  }
  empty: {
    error: string | null
    onRetry: () => void
    onManual: () => void
    onQuickStart: () => void
  }
  statusbar: {
    showing: string
    retained: string
    dropped: string
    zone: Prefs['zone']
  }
  sheets: SheetsModel
}

export function useWorkspace(): Workspace {
  const streams = useStreams((state) => state.streams)
  const activeId = useStreams((state) => state.activeId)
  const connection = useStreams((state) => state.connection)
  const simulatedLost = useStreams((state) => state.simulatedLost)
  const bootError = useStreams((state) => state.bootError)
  const resync = useStreams((state) => state.resync)
  const setSimulatedLost = useStreams((state) => state.setSimulatedLost)
  const addManual = useStreams((state) => state.addManual)
  const setPaused = useStreams((state) => state.setPaused)
  const closeStream = useStreams((state) => state.closeStream)
  const closeAllStreams = useStreams((state) => state.closeAllStreams)
  const clearStream = useStreams((state) => state.clearStream)
  const cleared = useStreams((state) => state.cleared)
  const bufferCap = useStreams((state) => state.bufferCap)

  const screen = useUi((state) => state.screen)
  const setScreen = useUi((state) => state.setScreen)
  const workspaceView = useUi((state) => state.workspaceView)
  const setWorkspaceView = useUi((state) => state.setWorkspaceView)
  const isolateTrace = useUi((state) => state.isolateTrace)
  const setIsolate = useUi((state) => state.setIsolate)
  const select = useUi((state) => state.select)
  const setInspectorOpen = useUi((state) => state.setInspectorOpen)
  const inspectorOpen = useUi((state) => state.inspectorOpen)
  const selectedSeq = useUi((state) =>
    activeId === null ? null : (state.selectedSeq[activeId] ?? null),
  )

  const [filter, setFilter] = useState<FilterState>(() => ({ ...DEFAULT_FILTER }))
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT)
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets(window.localStorage))
  const [sheet, setSheet] = useState<SheetName>(null)
  const [rules, setRules] = useState<ParseRules>(() => loadParseRules())
  const [clearTarget, setClearTarget] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<string | null>(null)
  const [closeAllOpen, setCloseAllOpen] = useState(false)
  const [pdfState, setPdfState] = useState<PdfState | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(
    () => loadInspectorWidth() ?? defaultInspectorWidth(),
  )

  useEffect(() => {
    const onResize = () => setInspectorWidth((value) => clampInspectorWidth(value))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const { prefs, setPrefs } = usePrefsEffects({ setRules })
  const { savePreset, renamePreset, deletePreset } = usePresetActions(presets, setPresets)

  const active = streams.find((entry) => entry.id === activeId) ?? null
  const narrow = useMediaQuery('(max-width: 960px)')
  const derivedRecords = useDerivedRecords(active, rules)
  const derivedCounts = useDerivedCounts(active, rules, derivedRecords)
  const visible = useVisibleRecords(active, derivedRecords, filter, isolateTrace, sort)

  useBootEffect()

  const zeroStreams = streams.length === 0
  const quickOpen = screen === 'quick'
  useQuickStartAdvance(zeroStreams, screen, setScreen)
  useSelectionSync(active, derivedRecords, select)

  const paused = active !== null && active.pausedAt !== null
  const pending = active === null ? 0 : pendingCount(derivedRecords, active.pausedAt)

  const toggleTheme = (): void => {
    setPrefs((state) => ({ ...state, theme: flippedTheme(state.theme) }))
  }

  useKeyboardShortcuts({
    activeId,
    visible,
    quickOpen,
    sheetOpen: sheet !== null,
    closeSheet: () => setSheet(null),
    openHelp: () => setSheet('help'),
    openInspector: () => setInspectorOpen(true),
    toggleTheme,
  })

  const selectedRecord =
    active === null || selectedSeq === null
      ? null
      : (derivedRecords.find((record) => record.seq === selectedSeq) ?? null)
  const showDetailSheet = narrow && inspectorOpen && selectedRecord !== null

  const saveActiveLog = async (id: string): Promise<void> => {
    const entry = streams.find((item) => item.id === id)
    if (entry === undefined) return
    useStreams.getState().setLastError(null)
    const outcome = await saveStream({
      streamId: id,
      name: entry.name,
      zone: prefs.zone,
      rules,
    })
    if (!outcome.ok) {
      useStreams.getState().setLastError(outcome.error)
      return
    }
    setWorkspaceView('saved')
  }

  const togglePause = (): void => {
    if (active === null) return
    setPaused(active.id, active.pausedAt === null)
  }

  const resetInspectorWidth = (): void => updateInspectorWidth(defaultInspectorWidth())

  const updateInspectorWidth = (next: number): void => {
    const value = clampInspectorWidth(next)
    setInspectorWidth(value)
    saveInspectorWidth(value)
  }

  const clearFilters = (): void => {
    setFilter({ ...DEFAULT_FILTER })
    setIsolate(null)
  }

  const confirmClear = (): void => {
    const id = clearTarget
    setClearTarget(null)
    if (id === null) return
    void clearStream(id)
  }

  const confirmClose = (): void => {
    const id = closeTarget
    setCloseTarget(null)
    if (id === null) return
    void closeStream(id)
  }

  const retryConnection = (): void => {
    setSimulatedLost(false)
    if (connection === 'connected') {
      if (active !== null) void resync(active.id)
      return
    }
    reconnectNow()
  }

  const applyPreset = (preset: Preset): void => {
    setFilter({
      query: preset.query,
      regexMode: preset.regex,
      chips: [...preset.levels],
      range: preset.range,
      from: preset.from,
      to: preset.to,
    })
    setSort(preset.sort)
    setIsolate(preset.trace)
  }

  const exportCurrent = (): LogRecord[] => exportRecords(derivedRecords, filter, isolateTrace, sort)

  const chipCounts = {
    error: countForChip(derivedCounts, 'error'),
    warn: countForChip(derivedCounts, 'warn'),
    info: countForChip(derivedCounts, 'info'),
    debug: countForChip(derivedCounts, 'debug'),
    unknown: countForChip(derivedCounts, 'unknown'),
  }

  const totalCount = levelCountTotal(derivedCounts)
  const totalLines = active?.lineCount ?? 0
  const droppedLines = active?.dropped ?? 0
  const clearedActive = active !== null && cleared.includes(active.id)
  const clearEntry = streams.find((entry) => entry.id === clearTarget) ?? null
  const closeEntry = streams.find((entry) => entry.id === closeTarget) ?? null
  const filterProblem = filterError(filter)
  const emptyText = emptyStateText({
    cleared: clearedActive,
    activeKind: active === null ? null : active.kind,
    filterProblem,
    filtersActive: filtersActive(filter, isolateTrace),
    bootError,
  })

  const data: StreamData = {
    active,
    derivedRecords,
    visible,
    paused,
    pending,
    chipCounts,
    totalCount,
    totalLines,
    droppedLines,
    clearedActive,
    bootError,
    connection,
    simulatedLost,
    filterProblem,
    emptyText,
    selectedRecord,
    inspectorOpen,
    inspectorWidth,
  }

  const actions: StreamActions = {
    isolateTrace,
    onFilter: setFilter,
    onSort: setSort,
    onApplyPreset: applyPreset,
    onSavePreset: (name) => savePreset(name, filter, sort, isolateTrace),
    onRenamePreset: renamePreset,
    onDeletePreset: deletePreset,
    onToggleZone: () =>
      setPrefs((state) => ({ ...state, zone: state.zone === 'utc' ? 'local' : 'utc' })),
    onToggleWrap: () => setPrefs((state) => ({ ...state, wrap: !state.wrap })),
    onToggleAutoscroll: () => setPrefs((state) => ({ ...state, autoscroll: !state.autoscroll })),
    onTogglePause: togglePause,
    onResume: () => {
      if (active === null) return
      setPaused(active.id, false)
    },
    onRetry: retryConnection,
    onClearFilters: clearFilters,
    onClearBuffer: setClearTarget,
    onSaveLog: (id) => {
      void saveActiveLog(id)
    },
    onInspectorWidth: updateInspectorWidth,
    onResetInspectorWidth: resetInspectorWidth,
  }

  const more: MoreModel = {
    open: sheet === 'more',
    onView: (target) => {
      setSheet(null)
      setWorkspaceView(target)
    },
    onManual: () => setSheet('manual'),
    onSettings: () => setSheet('settings'),
    onHelp: () => setSheet('help'),
    onClose: () => setSheet(null),
  }

  const sheets = buildSheets({
    more,
    sheet,
    bufferCap,
    onSaveBufferCap: async (value) => {
      const result = await patchSettings(value)
      if (!result.ok) return result.error
      useStreams.getState().setBufferCap(result.settings.bufferCap)
      return null
    },
    onCloseSheet: () => setSheet(null),
    onOpenRules: () => setSheet('rules'),
    onQuickStartFromHelp: () => {
      setSheet(null)
      setScreen('quick')
    },
    quickOpen,
    connected: connection === 'connected' && !simulatedLost,
    onQuickManual: () => {
      setScreen('stream')
      setWorkspaceView('stream')
      setSheet('manual')
    },
    onQuickHelp: () => {
      setScreen('stream')
      setWorkspaceView('stream')
      setSheet('help')
    },
    onQuickClose: () => {
      setScreen('stream')
      setWorkspaceView('stream')
    },
    detail:
      showDetailSheet && selectedRecord !== null
        ? { record: selectedRecord, zone: prefs.zone, source: null }
        : null,
    onCloseDetail: () => setInspectorOpen(false),
    closeAllOpen,
    closeAllStreams: streams,
    onConfirmCloseAll: () => {
      setCloseAllOpen(false)
      void closeAllStreams()
    },
    onCancelCloseAll: () => setCloseAllOpen(false),
    clearTarget: clearEntry,
    onConfirmClear: confirmClear,
    onCancelClear: () => setClearTarget(null),
    closeTarget: closeEntry,
    onConfirmClose: confirmClose,
    onCancelClose: () => setCloseTarget(null),
    prefs,
    onSavePrefs: (draft) => {
      setPrefs(draft)
      setSheet(null)
    },
    rules,
    onSaveRules: (next) => {
      const normalized = normalizeParseRules(next)
      setRules(normalized)
      saveParseRules(normalized)
      setSheet(null)
    },
    onParseManual: (records, totalLinesParsed) => {
      addManual(records, totalLinesParsed)
      setInspectorOpen(false)
      setScreen('stream')
      setWorkspaceView('stream')
    },
    pdfState,
    onClosePdf: () => setPdfState(null),
  })

  return {
    zeroStreams,
    bufferCap,
    onBackToLogs: () => setWorkspaceView('stream'),
    stream: { data, actions, filter, sort, prefs, presets },
    exportMenu: {
      count: visible.length,
      onTxt: () => {
        if (active === null) return
        downloadText(active.name, exportText(exportCurrent()))
      },
      onPdf: () => {
        if (active === null) return
        setPdfState(buildPrintPages(active.name, exportCurrent(), prefs.zone, bufferCap))
      },
    },
    merge: {
      inspectorWidth,
      onInspectorWidth: updateInspectorWidth,
      onResetInspectorWidth: resetInspectorWidth,
    },
    rail: {
      openSheet: setSheet,
      toggleTheme,
      onStreams: () => setWorkspaceView('stream'),
      onMerge: () => setWorkspaceView('merge'),
      onCompare: () => setWorkspaceView('compare'),
      onPretty: () => setWorkspaceView('prettify'),
      onGraphql: () => setWorkspaceView('graphql'),
      onSaved: () => setWorkspaceView('saved'),
      workspaceView,
      expanded: prefs.railExpanded,
      onToggleExpanded: () => setPrefs({ ...prefs, railExpanded: !prefs.railExpanded }),
    },
    topBar: {
      openSheet: setSheet,
      toggleTheme,
      onSimulateLoss: () => setSimulatedLost(!simulatedLost),
    },
    tabs: {
      onQuickStart: () => setScreen('quick'),
      onCloseTab: setCloseTarget,
      onCloseAll: () => setCloseAllOpen(true),
      toolViewActive: workspaceView !== 'stream',
    },
    empty: {
      error: bootError,
      onRetry: () => void useStreams.getState().boot(),
      onManual: () => setSheet('manual'),
      onQuickStart: () => setScreen('quick'),
    },
    statusbar: {
      showing: zeroStreams
        ? 'No streams · waiting for a pipe'
        : `${formatNumber(visible.length)} of ${formatNumber(totalLines)} in view`,
      retained: zeroStreams || active === null ? '-' : formatNumber(totalLines),
      dropped: zeroStreams || active === null ? '-' : formatNumber(droppedLines),
      zone: prefs.zone,
    },
    sheets,
  }
}
