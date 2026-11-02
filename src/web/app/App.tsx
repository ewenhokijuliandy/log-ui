import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { countForChip, countLevels, emptyLevelCounts } from '../../shared/levels.ts'
import {
  isDefaultParseRules,
  normalizeParseRules,
  type ParseRules,
} from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import { CompareDialog } from '../components/compare.tsx'
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
import { DetailSheet, Inspector } from '../components/inspector.tsx'
import { LogList } from '../components/logs.tsx'
import { ParseRulesDialog } from '../components/parse-rules.tsx'
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
import { useMediaQuery } from '../lib/media.ts'
import { frozenRecords, pendingCount } from '../lib/pause.ts'
import { createPreset, loadPresets, type Preset, savePresets } from '../lib/presets.ts'
import { buildPrintPages } from '../lib/print-sheet.ts'
import { reparseRecords } from '../lib/reparse.ts'
import { loadParseRules, PARSE_RULES_KEY, saveParseRules } from './parse-rules.ts'
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
  levelCountTotal,
  openSocket,
  reconnectNow,
  type StreamEntry,
  useStreams,
} from './store.ts'
import { useUi } from './ui.ts'

const EMPTY_RECORDS: LogRecord[] = []

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
  const [sheet, setSheet] = useState<'settings' | 'help' | 'manual' | 'rules' | 'compare' | null>(
    null,
  )
  const [rules, setRules] = useState<ParseRules>(() => loadParseRules())
  const [clearTarget, setClearTarget] = useState<string | null>(null)
  const [closeTarget, setCloseTarget] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<PdfState | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(
    () => loadInspectorWidth() ?? defaultInspectorWidth(),
  )

  const active = streams.find((entry) => entry.id === activeId) ?? null
  const narrow = useMediaQuery('(max-width: 960px)')
  const sourceRecords = active === null ? EMPTY_RECORDS : active.records
  const derivedRecords = useMemo(() => reparseRecords(sourceRecords, rules), [sourceRecords, rules])
  const derivedCounts = useMemo(() => {
    if (active === null) return emptyLevelCounts()
    if (isDefaultParseRules(rules)) return active.levelCounts
    return countLevels(derivedRecords)
  }, [active, rules, derivedRecords])

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
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PARSE_RULES_KEY) return
      setRules(loadParseRules())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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
      derivedRecords.some((record) => record.seq === current)
    )
      return
    const newest = derivedRecords.length > 0 ? derivedRecords[derivedRecords.length - 1] : null
    select(active.id, newest?.seq ?? null)
  }, [active, derivedRecords, select])

  const paused = active !== null && active.pausedAt !== null
  const pending = active === null ? 0 : pendingCount(derivedRecords, active.pausedAt)

  const visible = useMemo<LogRecord[]>(() => {
    if (active === null) return []
    const frozen = frozenRecords(derivedRecords, active.pausedAt)
    return orderRecords(visibleRecords(frozen, filter, isolateTrace), sort)
  }, [active, derivedRecords, filter, isolateTrace, sort])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (event.key === 'Escape' && sheet !== null) {
        setSheet(null)
        return
      }
      if (document.querySelector('dialog[open]') !== null) return
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
      : (derivedRecords.find((record) => record.seq === selectedSeq) ?? null)
  const showDetailSheet = narrow && inspectorOpen && selectedRecord !== null

  function copySelectedRaw(): Promise<boolean> {
    if (selectedRecord === null) return Promise.resolve(false)
    return copyText(selectedRecord.raw)
  }

  function copySelectedJson(): Promise<boolean> {
    if (selectedRecord === null) return Promise.resolve(false)
    return copyText(
      selectedRecord.json === null
        ? selectedRecord.raw
        : JSON.stringify(selectedRecord.json, null, 2),
    )
  }

  function openDetail(): void {
    if (active === null) return
    const current = useUi.getState().selectedSeq[active.id] ?? null
    const valid = current !== null && derivedRecords.some((record) => record.seq === current)
    if (!valid) {
      const newest = derivedRecords[derivedRecords.length - 1]
      if (newest !== undefined) select(active.id, newest.seq)
    }
    setInspectorOpen(true)
  }

  function toggleDetail(): void {
    if (inspectorOpen) {
      setInspectorOpen(false)
      return
    }
    openDetail()
  }

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
  const emptyText = clearedActive
    ? active?.kind === 'manual'
      ? 'Parsed lines cleared.'
      : 'Buffer cleared. New lines will appear here.'
    : filterProblem !== null
      ? 'This pattern is not a valid regular expression.'
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
          onDetail={toggleDetail}
          onCompare={() => setSheet('compare')}
          detailOpen={inspectorOpen && selectedRecord !== null}
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
                    exportText(exportRecords(derivedRecords, filter, isolateTrace, sort)),
                  )
                }}
                onPdf={() => {
                  if (active === null) return
                  setPdfState(
                    buildPrintPages(
                      active.name,
                      exportRecords(derivedRecords, filter, isolateTrace, sort),
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
                error={bootError}
                onRetry={() => void useStreams.getState().boot()}
                onManual={() => setSheet('manual')}
                onQuickStart={() => setScreen('quick')}
              />
            ) : (
              active !== null && (
                <section
                  className="view"
                  id="stream-view"
                  role="tabpanel"
                  aria-labelledby={`tab-${active.id}`}
                >
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
                    <div className="banner" role="status">
                      <span>Connection to the daemon lost. Reconnecting…</span>
                      <button
                        className="link"
                        type="button"
                        onClick={() => {
                          setSimulatedLost(false)
                          if (connection === 'connected') {
                            if (active !== null) void resync(active.id)
                            return
                          }
                          reconnectNow()
                        }}
                      >
                        Retry now
                      </button>
                    </div>
                  ) : null}

                  {active.kind !== 'manual' && active.status === 'stopped' && !clearedActive ? (
                    <div className="banner" role="status">
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
                        chips: [...preset.levels],
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

                  <SignalStrip records={derivedRecords} zone={prefs.zone} />

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
                        filterProblem === null && filtersActive(filter, isolateTrace)
                          ? clearFilters
                          : undefined
                      }
                    />
                    <Inspector
                      record={selectedRecord}
                      zone={prefs.zone}
                      width={inspectorWidth}
                      onWidth={updateInspectorWidth}
                      onResetWidth={() => updateInspectorWidth(defaultInspectorWidth())}
                      onCopyRaw={copySelectedRaw}
                      onCopyJson={copySelectedJson}
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
          />
        </div>
      </div>

      {showDetailSheet && selectedRecord !== null ? (
        <DetailSheet
          record={selectedRecord}
          zone={prefs.zone}
          onClose={() => setInspectorOpen(false)}
          onCopyRaw={copySelectedRaw}
          onCopyJson={copySelectedJson}
        />
      ) : null}

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
        onOpenRules={() => setSheet('rules')}
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
        rules={rules}
        onClose={() => setSheet(null)}
        onParse={(records, totalLines) => {
          addManual(records, totalLines)
          setInspectorOpen(false)
          setScreen('stream')
        }}
      />

      <ParseRulesDialog
        open={sheet === 'rules'}
        rules={rules}
        zone={prefs.zone}
        onClose={() => setSheet(null)}
        onSave={(next) => {
          const normalized = normalizeParseRules(next)
          setRules(normalized)
          saveParseRules(normalized)
          setSheet(null)
        }}
      />

      <CompareDialog open={sheet === 'compare'} onClose={() => setSheet(null)} />

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
