import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import {
  ConfirmDialog,
  HelpSheet,
  ManualDialog,
  PrintSheet,
  SettingsSheet,
} from '../components/dialogs.tsx'
import {
  downloadText,
  ExportMenuContent,
  exportRecords,
  exportText,
} from '../components/export.tsx'
import { Sprite } from '../components/icons.tsx'
import { Inspector } from '../components/inspector.tsx'
import { LogList } from '../components/logs.tsx'
import { EmptyState, QuickStart } from '../components/quick.tsx'
import { Rail, Statusbar, TopBar } from '../components/shell.tsx'
import { SignalStrip } from '../components/signal.tsx'
import { StreamTabs } from '../components/tabs.tsx'
import { Toolbar } from '../components/toolbar.tsx'
import { copyText } from '../lib/clipboard.ts'
import {
  DEFAULT_FILTER,
  type FilterState,
  filterError,
  filtersActive,
  orderRecords,
  type SortKey,
  visibleRecords,
} from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import { frozenRecords, pendingCount } from '../lib/pause.ts'
import { createPreset, loadPresets, type Preset, savePresets } from '../lib/presets.ts'
import { buildPrintPages } from '../lib/print-sheet.ts'
import {
  applyTheme,
  clampInspectorWidth,
  defaultInspectorWidth,
  loadInspectorWidth,
  loadPrefs,
  type Prefs,
  resolveTheme,
  saveInspectorWidth,
  savePrefs,
} from './prefs.ts'
import {
  BUFFER_CAP,
  chipCount,
  levelCountTotal,
  openSocket,
  type StreamEntry,
  useStreams,
} from './store.ts'
import { useUi } from './ui.ts'

type PdfState = {
  title: string
  meta: string
  pages: string[]
}

export function App() {
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
  const clearStream = useStreams((state) => state.clearStream)
  const cleared = useStreams((state) => state.cleared)

  const screen = useUi((state) => state.screen)
  const setScreen = useUi((state) => state.setScreen)
  const isolateTrace = useUi((state) => state.isolateTrace)
  const setIsolate = useUi((state) => state.setIsolate)
  const select = useUi((state) => state.select)
  const setInspectorOpen = useUi((state) => state.setInspectorOpen)
  const inspectorOpen = useUi((state) => state.inspectorOpen)
  const setResolvedTheme = useUi((state) => state.setTheme)
  const selectedSeq = useUi((state) =>
    activeId === null ? null : (state.selectedSeq[activeId] ?? null),
  )

  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const [filter, setFilter] = useState<FilterState>(() => ({ ...DEFAULT_FILTER }))
  const [sort, setSort] = useState<SortKey>('newest')
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets(window.localStorage))
  const [sheet, setSheet] = useState<'settings' | 'help' | 'manual' | null>(null)
  const [clearTarget, setClearTarget] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<PdfState | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(
    () => loadInspectorWidth() ?? defaultInspectorWidth(),
  )

  const active = streams.find((entry) => entry.id === activeId) ?? null

  useEffect(() => {
    openSocket()
    void useStreams.getState().boot()
  }, [])

  useEffect(() => {
    const onResize = () => setInspectorWidth((value) => clampInspectorWidth(value))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    applyTheme(prefs.theme)
    setResolvedTheme(resolveTheme(prefs.theme))
    savePrefs(prefs)
  }, [prefs, setResolvedTheme])

  useEffect(() => {
    if (prefs.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      applyTheme('system')
      setResolvedTheme(resolveTheme('system'))
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [prefs.theme, setResolvedTheme])

  const zeroStreams = streams.length === 0
  const quickOpen = screen === 'quick'

  const prevZeroStreams = useRef(zeroStreams)
  useEffect(() => {
    const wasEmpty = prevZeroStreams.current
    prevZeroStreams.current = zeroStreams
    if (wasEmpty && !zeroStreams && screen === 'quick') setScreen('stream')
  }, [zeroStreams, screen, setScreen])

  useEffect(() => {
    if (active === null) return
    const current = useUi.getState().selectedSeq[active.id]
    if (
      current !== undefined &&
      current !== null &&
      active.records.some((record) => record.seq === current)
    )
      return
    const newest = active.records.length > 0 ? active.records[active.records.length - 1] : null
    select(active.id, newest?.seq ?? null)
  }, [active, select])

  const paused = active !== null && active.pausedAt !== null
  const pending = active === null ? 0 : pendingCount(active.records, active.pausedAt)

  const visible = useMemo<LogRecord[]>(() => {
    if (active === null) return []
    const frozen = frozenRecords(active.records, active.pausedAt)
    return orderRecords(visibleRecords(frozen, filter, isolateTrace), sort)
  }, [active, filter, isolateTrace, sort])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (event.key === 'Escape' && sheet !== null) {
        setSheet(null)
        return
      }
      if (typing) return
      if (event.key === '/') {
        event.preventDefault()
        const box = document.querySelector('[data-search]') as HTMLInputElement | null
        box?.focus()
        return
      }
      if (quickOpen) return
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault()
        if (active === null || visible.length === 0) return
        const current = useUi.getState().selectedSeq[active.id] ?? null
        const index = current === null ? -1 : visible.findIndex((record) => record.seq === current)
        const step = event.key === 'j' ? 1 : -1
        const next =
          index === -1
            ? step === 1
              ? 0
              : visible.length - 1
            : Math.max(0, Math.min(visible.length - 1, index + step))
        const record = visible[next]
        if (record === undefined) return
        select(active.id, record.seq)
        return
      }
      if (event.key === 'Enter') {
        if (active === null) return
        if (visible.length === 0) return
        setInspectorOpen(true)
        return
      }
      if (event.key === 't') {
        event.preventDefault()
        setPrefs((state) => ({
          ...state,
          theme: resolveTheme(state.theme) === 'dark' ? 'light' : 'dark',
        }))
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setSheet('help')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, quickOpen, sheet, select, setInspectorOpen, visible])

  const selectedRecord =
    active === null || selectedSeq === null
      ? null
      : (active.records.find((record) => record.seq === selectedSeq) ?? null)

  function updateInspectorWidth(next: number): void {
    const value = clampInspectorWidth(next)
    setInspectorWidth(value)
    saveInspectorWidth(value)
  }

  function toggleTheme(): void {
    setPrefs((state) => ({
      ...state,
      theme: resolveTheme(state.theme) === 'dark' ? 'light' : 'dark',
    }))
  }

  function togglePause(): void {
    if (active === null) return
    setPaused(active.id, active.pausedAt === null)
  }

  async function confirmClear(): Promise<void> {
    const id = clearTarget
    setClearTarget(null)
    if (id === null) return
    await clearStream(id)
  }

  async function confirmClose(): Promise<void> {
    const id = closeTarget
    setCloseTarget(null)
    if (id === null) return
    await closeStream(id)
  }

  function savePreset(name: string): void {
    if (name.length === 0) return
    const preset = createPreset(crypto.randomUUID(), name, filter, sort, isolateTrace)
    const next = [...presets, preset]
    setPresets(next)
    savePresets(window.localStorage, next)
  }

  function renamePreset(id: string, name: string): void {
    const clean = name.trim()
    if (clean.length === 0) return
    const next = presets.map((preset) => (preset.id === id ? { ...preset, name: clean } : preset))
    setPresets(next)
    savePresets(window.localStorage, next)
  }

  function deletePreset(id: string): void {
    const next = presets.filter((preset) => preset.id !== id)
    setPresets(next)
    savePresets(window.localStorage, next)
  }

  function clearFilters(): void {
    setFilter({ ...DEFAULT_FILTER })
    setIsolate(null)
  }

  const chipCounts = {
    error: active === null ? 0 : chipCount(active.levelCounts, 'error'),
    warn: active === null ? 0 : chipCount(active.levelCounts, 'warn'),
    info: active === null ? 0 : chipCount(active.levelCounts, 'info'),
    debug: active === null ? 0 : chipCount(active.levelCounts, 'debug'),
  }

  const totalCount = active === null ? 0 : levelCountTotal(active.levelCounts)
  const totalLines = active?.lineCount ?? 0
  const droppedLines = active?.dropped ?? 0
  const clearedActive = active !== null && cleared.includes(active.id)
  const clearEntry = streams.find((entry) => entry.id === clearTarget) ?? null
  const closeEntry = streams.find((entry) => entry.id === closeTarget) ?? null
  const emptyText = clearedActive
    ? active?.kind === 'manual'
      ? 'Parsed lines cleared.'
      : 'Buffer cleared. New lines will appear here.'
    : filtersActive(filter, isolateTrace)
      ? 'No lines match this view.'
      : (bootError ?? 'No lines in this buffer yet.')

  return (
    <>
      <Sprite />
      <div className="shell">
        <Rail
          openSheet={(target) => setSheet(target)}
          toggleTheme={toggleTheme}
          onStreams={() => setScreen('stream')}
        />
        <div className="main">
          <TopBar
            openSheet={(target) => setSheet(target)}
            toggleTheme={toggleTheme}
            onExport={
              <ExportMenuContent
                count={visible.length}
                cap={BUFFER_CAP}
                onTxt={() => {
                  if (active === null) return
                  downloadText(
                    active.name,
                    exportText(exportRecords(active.records, filter, isolateTrace, sort)),
                  )
                }}
                onPdf={() => {
                  if (active === null) return
                  setPdfState(
                    buildPrintPages(
                      active.name,
                      exportRecords(active.records, filter, isolateTrace, sort),
                      prefs.zone,
                      BUFFER_CAP,
                    ),
                  )
                }}
              />
            }
            onSimulateLoss={() => setSimulatedLost(!simulatedLost)}
          />
          <StreamTabs
            onQuickStart={() => setScreen('quick')}
            onCloseTab={(id) => setCloseTarget(id)}
          />
          <div className="workspace">
            {zeroStreams ? (
              <EmptyState
                onManual={() => setSheet('manual')}
                onQuickStart={() => setScreen('quick')}
              />
            ) : (
              active !== null && (
                <section className="view" aria-label="Stream workspace">
                  <div className="title-row">
                    <div className="title-block">
                      <div className="title-line">
                        <h1>{active.name}</h1>
                        <span
                          className={`status-pill${
                            active.kind === 'manual' || active.status === 'stopped'
                              ? ' stopped'
                              : ''
                          }`}
                        >
                          <span className="dot" />
                          {active.kind === 'manual'
                            ? 'MANUAL'
                            : active.status === 'stopped'
                              ? 'STOPPED'
                              : 'ACTIVE'}
                        </span>
                      </div>
                      <p className="finding">
                        {active.kind === 'manual'
                          ? 'Parsed in this browser. Filters, inspection and export work on these lines.'
                          : (bootError ?? '')}
                      </p>
                    </div>
                    <div className="title-meta">
                      <span className="retained">
                        <span className="num">
                          {formatNumber(totalLines)}
                          {droppedLines > 0
                            ? ` retained · ${formatNumber(droppedLines)} dropped`
                            : ' retained'}
                        </span>
                      </span>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => setClearTarget(active.id)}
                      >
                        Clear buffer
                      </button>
                    </div>
                  </div>

                  {connection !== 'connected' || simulatedLost ? (
                    <div className="banner">
                      <span>Connection to the daemon lost. Reconnecting…</span>
                      <button
                        className="link"
                        type="button"
                        onClick={() => {
                          setSimulatedLost(false)
                          void resync(active.id)
                        }}
                      >
                        Retry now
                      </button>
                    </div>
                  ) : null}

                  {active.kind !== 'manual' && active.status === 'stopped' && !clearedActive ? (
                    <div className="banner">
                      <span>
                        The pipe for {active.name} ended. Restart the stream to see new lines.
                      </span>
                    </div>
                  ) : null}

                  <Toolbar
                    filter={filter}
                    sort={sort}
                    onFilter={setFilter}
                    onSort={setSort}
                    chipCounts={chipCounts}
                    totalCount={totalCount}
                    zone={prefs.zone}
                    autoscroll={prefs.autoscroll}
                    wrap={prefs.wrap}
                    paused={paused}
                    pending={pending}
                    onToggleZone={() =>
                      setPrefs((state) => ({
                        ...state,
                        zone: state.zone === 'utc' ? 'local' : 'utc',
                      }))
                    }
                    onToggleWrap={() => setPrefs((state) => ({ ...state, wrap: !state.wrap }))}
                    onToggleAutoscroll={() =>
                      setPrefs((state) => ({ ...state, autoscroll: !state.autoscroll }))
                    }
                    onTogglePause={togglePause}
                    presets={presets}
                    onApplyPreset={(preset) => {
                      setFilter({
                        query: preset.query,
                        regexMode: preset.regex,
                        chip: preset.level,
                        range: preset.range,
                        from: preset.from,
                        to: preset.to,
                      })
                      setSort(preset.sort)
                      setIsolate(preset.trace)
                    }}
                    onSavePreset={savePreset}
                    onDeletePreset={deletePreset}
                    onRenamePreset={renamePreset}
                  />

                  <SignalStrip records={active.records} zone={prefs.zone} />

                  <div
                    className={`log-shell${inspectorOpen && selectedRecord !== null ? '' : ' no-inspector'}`}
                    style={
                      {
                        '--inspector-w': `${String(inspectorWidth)}px`,
                      } as CSSProperties
                    }
                  >
                    <LogList
                      visible={visible}
                      zone={prefs.zone}
                      autoscroll={prefs.autoscroll}
                      newestFirst={sort === 'newest'}
                      wrap={prefs.wrap}
                      isolateTrace={isolateTrace}
                      paused={paused}
                      pending={pending}
                      onResume={() => setPaused(active.id, false)}
                      emptyText={emptyText}
                      onClearFilters={
                        filtersActive(filter, isolateTrace) ? clearFilters : undefined
                      }
                    />
                    <Inspector
                      record={selectedRecord}
                      zone={prefs.zone}
                      width={inspectorWidth}
                      onWidth={updateInspectorWidth}
                      onResetWidth={() => updateInspectorWidth(defaultInspectorWidth())}
                      onCopyRaw={() => {
                        if (selectedRecord === null) return Promise.resolve(false)
                        return copyText(selectedRecord.raw)
                      }}
                      onCopyJson={() => {
                        if (selectedRecord === null) return Promise.resolve(false)
                        return copyText(
                          selectedRecord.json === null
                            ? selectedRecord.raw
                            : JSON.stringify(selectedRecord.json, null, 2),
                        )
                      }}
                    />
                  </div>
                </section>
              )
            )}
          </div>
          <Statusbar
            showing={
              zeroStreams
                ? 'No streams · waiting for a pipe'
                : `${formatNumber(visible.length)} of ${formatNumber(totalLines)} in view`
            }
            retained={zeroStreams || active === null ? '-' : formatNumber(totalLines)}
            dropped={zeroStreams || active === null ? '-' : formatNumber(droppedLines)}
            zone={prefs.zone}
            error={filterError(filter)}
          />
        </div>
      </div>

      <QuickStart
        open={quickOpen}
        connected={connection === 'connected' && !simulatedLost}
        onManual={() => {
          setScreen('stream')
          setSheet('manual')
        }}
        onHelp={() => {
          setScreen('stream')
          setSheet('help')
        }}
        onClose={() => setScreen('stream')}
      />

      <ConfirmDialog
        open={clearTarget !== null}
        title={clearEntry === null ? 'Clear this buffer?' : `Clear the ${clearEntry.name} buffer?`}
        body={
          clearEntry === null
            ? 'This removes the retained lines for the stream. This cannot be undone.'
            : clearBody(clearEntry)
        }
        confirmLabel="Clear buffer"
        cancelLabel="Keep lines"
        onConfirm={() => void confirmClear()}
        onCancel={() => setClearTarget(null)}
      />

      <ConfirmDialog
        open={closeTarget !== null}
        title={closeEntry === null ? 'Close this tab?' : `Close ${closeEntry.name}?`}
        body={
          closeEntry === null
            ? 'This removes the tab and its buffer. This cannot be undone.'
            : closeBody(closeEntry)
        }
        confirmLabel="Close tab"
        cancelLabel="Keep open"
        onConfirm={() => void confirmClose()}
        onCancel={() => setCloseTarget(null)}
      />

      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        prefs={prefs}
        onSave={(draft) => {
          setPrefs(draft)
          setSheet(null)
        }}
        port={window.location.port === '' ? '3333' : window.location.port}
        bufferCap={BUFFER_CAP}
      />

      <HelpSheet
        open={sheet === 'help'}
        onClose={() => setSheet(null)}
        onQuickStart={() => {
          setSheet(null)
          setScreen('quick')
        }}
      />

      <ManualDialog
        open={sheet === 'manual'}
        cap={BUFFER_CAP}
        onClose={() => setSheet(null)}
        onParse={(records, totalLines) => {
          addManual(records, totalLines)
          setInspectorOpen(false)
          setScreen('stream')
        }}
      />

      <PrintSheet
        open={pdfState !== null}
        title={pdfState?.title ?? ''}
        meta={pdfState?.meta ?? ''}
        pages={pdfState?.pages ?? []}
        onClose={() => setPdfState(null)}
      />
    </>
  )
}

function clearBody(entry: StreamEntry): string {
  const noun = entry.kind === 'manual' ? 'parsed' : 'retained'
  const tail =
    entry.kind === 'manual'
      ? 'This parsed copy exists only in this browser.'
      : entry.status === 'stopped'
        ? 'The source process has ended, so the buffer cannot be refilled.'
        : 'The stream stays connected and new lines keep arriving.'
  return `This removes ${formatNumber(entry.lineCount)} ${noun} lines from this tab. ${tail} This cannot be undone.`
}

function closeBody(entry: StreamEntry): string {
  if (entry.kind === 'manual') {
    return `This removes its ${formatNumber(entry.lineCount)} parsed lines from this browser. This cannot be undone.`
  }
  return `This clears its ${formatNumber(entry.lineCount)} retained lines and ends that stream. If a pipe is still streaming into it, the CLI exits with code 0. This cannot be undone.`
}
