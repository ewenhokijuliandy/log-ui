import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import {
  ConfirmDialog,
  copyText,
  HelpSheet,
  ManualDialog,
  PrintSheet,
  SettingsSheet,
} from '../components/dialogs.tsx'
import {
  buildPrintPages,
  downloadText,
  ExportMenuContent,
  exportRecords,
  exportText,
} from '../components/export.tsx'
import { Sprite } from '../components/icons.tsx'
import { Inspector } from '../components/inspector.tsx'
import { LogList } from '../components/logs.tsx'
import { QuickStart } from '../components/quick.tsx'
import { Rail, Statusbar, TopBar } from '../components/shell.tsx'
import { SignalStrip } from '../components/signal.tsx'
import { StreamTabs } from '../components/tabs.tsx'
import { type PresetView, Toolbar } from '../components/toolbar.tsx'
import { type FilterState, filtersActive, type SortKey, visibleRecords } from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import { applyTheme, loadPrefs, type Prefs, resolveTheme, savePrefs } from './prefs.ts'
import { BUFFER_CAP, openSocket, type StreamEntry, useStreams } from './store.ts'
import { useUi } from './ui.ts'

type PdfState = {
  title: string
  meta: string
  pages: string[]
}

const PRESETS_KEY = 'log-ui.presets'

function loadPresets(): PresetView[] {
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as PresetView[]
  } catch {
    return []
  }
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
  const removeLocal = useStreams((state) => state.removeLocal)
  const cleared = useStreams((state) => state.cleared)

  const screen = useUi((state) => state.screen)
  const setScreen = useUi((state) => state.setScreen)
  const isolateTrace = useUi((state) => state.isolateTrace)
  const setIsolate = useUi((state) => state.setIsolate)
  const select = useUi((state) => state.select)
  const setInspectorOpen = useUi((state) => state.setInspectorOpen)
  const inspectorOpen = useUi((state) => state.inspectorOpen)
  const setResolvedTheme = useUi((state) => state.setTheme)

  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const [filter, setFilter] = useState<FilterState>({
    query: '',
    regexMode: false,
    chip: 'all',
    range: 'all',
  })
  const [sort, setSort] = useState<SortKey>('newest')
  const [presets, setPresets] = useState<PresetView[]>(() => loadPresets())
  const [sheet, setSheet] = useState<'settings' | 'help' | 'manual' | null>(null)
  const [clearTarget, setClearTarget] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<PdfState | null>(null)

  const active = streams.find((entry) => entry.id === activeId) ?? null

  useEffect(() => {
    openSocket()
    void useStreams.getState().boot()
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
  const quickMode = screen === 'quick' || zeroStreams

  useEffect(() => {
    document.body.classList.toggle('quick-mode', quickMode)
    return () => {
      document.body.classList.toggle('quick-mode', false)
    }
  }, [quickMode])

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

  const visible = useMemo<LogRecord[]>(() => {
    if (active === null) return []
    const ordered = visibleRecords(active.records, filter, isolateTrace)
    if (sort === 'newest') return ordered
    return ordered.slice().reverse()
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
      if (quickMode) return
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
  }, [active, quickMode, sheet, select, setInspectorOpen, visible])

  const selectedRecord =
    active === null
      ? null
      : (active.records.find(
          (record) => record.seq === (useUi.getState().selectedSeq[active.id] ?? null),
        ) ?? null)

  function toggleTheme(): void {
    setPrefs((state) => ({
      ...state,
      theme: resolveTheme(state.theme) === 'dark' ? 'light' : 'dark',
    }))
  }

  async function confirmClear(): Promise<void> {
    const id = clearTarget
    setClearTarget(null)
    if (id === null) return
    const manual =
      useStreams
        .getState()
        .streams.find((entry) => entry.id === id)
        ?.name.startsWith('manual') ?? false
    if (manual) {
      useStreams.setState((state) => ({
        cleared: [...state.cleared.filter((item) => item !== id), id],
        streams: state.streams.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                records: [],
                dropped: 0,
                lineCount: 0,
                levelCounts: { ...entry.levelCounts },
              }
            : entry,
        ),
      }))
      return
    }
    try {
      await fetch(`/api/streams/${id}/clear`, { method: 'POST' })
    } catch {}
  }

  async function confirmClose(): Promise<void> {
    const id = closeTarget
    setCloseTarget(null)
    if (id === null) return
    const manual =
      useStreams
        .getState()
        .streams.find((entry) => entry.id === id)
        ?.name.startsWith('manual') ?? false
    if (manual) {
      removeLocal(id)
      return
    }
    try {
      await fetch(`/api/streams/${id}`, { method: 'DELETE' })
    } catch {}
  }

  function savePreset(name: string): void {
    if (name.length === 0) return
    const preset: PresetView = {
      id: crypto.randomUUID(),
      name,
      query: filter.query,
      regex: filter.regexMode,
      level: filter.chip,
      range: filter.range,
      sort,
      trace: isolateTrace,
    }
    const next = [...presets, preset]
    setPresets(next)
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
  }

  function deletePreset(id: string): void {
    const next = presets.filter((preset) => preset.id !== id)
    setPresets(next)
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
  }

  function clearFilters(): void {
    setFilter({ query: '', regexMode: false, chip: 'all', range: 'all' })
    setIsolate(null)
  }

  const chipCounts = {
    error: chipTotal(active?.levelCounts, ['fatal', 'error']),
    warn: chipTotal(active?.levelCounts, ['warn']),
    info: chipTotal(active?.levelCounts, ['info']),
    debug: chipTotal(active?.levelCounts, ['debug', 'trace']),
  }

  const totalLines = active?.lineCount ?? 0
  const droppedLines = active?.dropped ?? 0
  const clearedActive = active !== null && cleared.includes(active.id)
  const emptyText = clearedActive
    ? 'Buffer cleared. New lines will appear here.'
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
                      filter.range,
                      prefs.zone,
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
            {quickMode ? (
              <QuickStart
                connected={connection === 'connected' && !simulatedLost}
                onManual={() => setSheet('manual')}
                onHelp={() => setSheet('help')}
              />
            ) : (
              active !== null && (
                <section className="view" aria-label="Stream workspace">
                  <div className="title-row">
                    <div className="title-block">
                      <div className="title-line">
                        <h1>{active.name}</h1>
                        <span
                          className={`status-pill${active.status === 'stopped' ? ' stopped' : ''}`}
                        >
                          <span className="dot" />
                          {active.status === 'stopped' ? 'STOPPED' : 'ACTIVE'}
                        </span>
                      </div>
                      <p className="finding">{bootError ?? ''}</p>
                    </div>
                    <div className="title-meta">
                      <span className="retained">
                        <span className="num">
                          {formatNumber(Math.min(totalLines, BUFFER_CAP))}
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

                  {active.status === 'stopped' && !clearedActive ? (
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
                    totalCount={totalLines}
                    zone={prefs.zone}
                    autoscroll={prefs.autoscroll}
                    wrap={prefs.wrap}
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
                    presets={presets}
                    onApplyPreset={(preset) => {
                      setFilter({
                        query: preset.query,
                        regexMode: preset.regex,
                        chip: preset.level,
                        range: preset.range,
                      })
                      setSort(preset.sort)
                      setIsolate(preset.trace)
                    }}
                    onSavePreset={savePreset}
                    onDeletePreset={deletePreset}
                  />

                  <SignalStrip records={active.records} zone={prefs.zone} />

                  <div
                    className={`log-shell${inspectorOpen && selectedRecord !== null ? '' : ' no-inspector'}`}
                  >
                    <LogList
                      visible={visible}
                      zone={prefs.zone}
                      autoscroll={prefs.autoscroll}
                      wrap={prefs.wrap}
                      isolateTrace={isolateTrace}
                      emptyText={emptyText}
                      onClearFilters={clearFilters}
                    />
                    <Inspector
                      record={selectedRecord}
                      zone={prefs.zone}
                      onCopyRaw={() => {
                        if (selectedRecord !== null) void copyText(selectedRecord.raw)
                      }}
                      onCopyJson={() => {
                        if (selectedRecord === null) return
                        void copyText(
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
                ? 'Quick start · waiting for a pipe'
                : `${formatNumber(visible.length)} of ${formatNumber(totalLines)} in view`
            }
            retained={
              zeroStreams || active === null ? '-' : formatNumber(Math.min(totalLines, BUFFER_CAP))
            }
            dropped={zeroStreams || active === null ? '-' : formatNumber(droppedLines)}
            zone={prefs.zone}
          />
        </div>
      </div>

      <ConfirmDialog
        open={clearTarget !== null}
        title={`Clear the ${active?.name ?? 'stream'} buffer?`}
        body={
          active === null
            ? 'This removes the retained lines for the stream. The buffer keeps filling as new lines arrive.'
            : `This removes the retained lines for ${active.name}. The tab stays open and the buffer keeps filling as new lines arrive.`
        }
        confirmLabel="Clear buffer"
        cancelLabel="Keep lines"
        onConfirm={() => void confirmClear()}
        onCancel={() => setClearTarget(null)}
      />

      <ConfirmDialog
        open={closeTarget !== null}
        title="Close this tab?"
        body={`The ${closeName(closeTarget, streams)} tab and its retained buffer are removed. If a pipe is still streaming into it, the CLI exits with code 0.`}
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
        onClose={() => setSheet(null)}
        onParse={(records) => {
          addManual(records)
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

function chipTotal(counts: Record<string, number> | undefined, levels: readonly string[]): number {
  if (counts === undefined) return 0
  return levels.reduce((sum, level) => sum + (counts[level] ?? 0), 0)
}

function closeName(id: string | null, streams: readonly StreamEntry[]): string {
  return streams.find((entry) => entry.id === id)?.name ?? 'this stream'
}
