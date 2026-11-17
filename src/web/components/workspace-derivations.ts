import { useEffect, useMemo, useRef } from 'react'
import { countLevels, emptyLevelCounts } from '../../shared/levels.ts'
import { isDefaultParseRules, type ParseRules } from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import { type Prefs, resolveTheme } from '../app/prefs.ts'
import { openSocket, type StreamEntry, useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import { type FilterState, orderRecords, type SortKey, visibleRecords } from '../lib/filters.ts'
import { frozenRecords } from '../lib/pause.ts'
import { reparseRecords } from '../lib/reparse.ts'

const EMPTY_RECORDS: LogRecord[] = []

export function useDerivedRecords(active: StreamEntry | null, rules: ParseRules): LogRecord[] {
  const source = active === null ? EMPTY_RECORDS : active.records
  return useMemo(() => reparseRecords(source, rules), [source, rules])
}

export function useDerivedCounts(
  active: StreamEntry | null,
  rules: ParseRules,
  derivedRecords: readonly LogRecord[],
) {
  return useMemo(() => {
    if (active === null) return emptyLevelCounts()
    if (isDefaultParseRules(rules)) return active.levelCounts
    return countLevels(derivedRecords)
  }, [active, rules, derivedRecords])
}

export function useVisibleRecords(
  active: StreamEntry | null,
  derivedRecords: readonly LogRecord[],
  filter: FilterState,
  isolateTrace: string | null,
  sort: SortKey,
): LogRecord[] {
  return useMemo(() => {
    if (active === null) return []
    const frozen = frozenRecords(derivedRecords, active.pausedAt)
    return orderRecords(visibleRecords(frozen, filter, isolateTrace), sort)
  }, [active, derivedRecords, filter, isolateTrace, sort])
}

export function useBootEffect(): void {
  useEffect(() => {
    openSocket()
    void useStreams.getState().boot()
  }, [])
}

export function useQuickStartAdvance(
  zeroStreams: boolean,
  screen: string,
  setScreen: (next: 'stream' | 'quick') => void,
): void {
  const previous = useRef(zeroStreams)
  useEffect(() => {
    const wasEmpty = previous.current
    previous.current = zeroStreams
    if (wasEmpty && !zeroStreams && screen === 'quick') setScreen('stream')
  }, [zeroStreams, screen, setScreen])
}

export function useSelectionSync(
  active: StreamEntry | null,
  derivedRecords: readonly LogRecord[],
  select: (streamId: string | null, seq: number | null) => void,
): void {
  useEffect(() => {
    if (active === null) return
    const current = useUi.getState().selectedSeq[active.id]
    const stillSelected =
      current !== undefined &&
      current !== null &&
      derivedRecords.some((record) => record.seq === current)
    if (stillSelected) return
    const newest = derivedRecords.length > 0 ? derivedRecords[derivedRecords.length - 1] : null
    select(active.id, newest?.seq ?? null)
  }, [active, derivedRecords, select])
}

export function selectNewest(streamId: string, records: readonly LogRecord[]): void {
  if (records.length === 0) return
  const newest = records[records.length - 1]
  if (newest === undefined) return
  useUi.getState().select(streamId, newest.seq)
}

export function flippedTheme(theme: Prefs['theme']): 'dark' | 'light' {
  return resolveTheme(theme) === 'dark' ? 'light' : 'dark'
}
