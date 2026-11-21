import type { ParseRules } from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import type { Prefs } from '../app/prefs.ts'
import type { StreamEntry } from '../app/store.ts'
import { BUFFER_CAP } from '../app/store.ts'
import { formatNumber } from '../lib/format-time.ts'

export type SheetName = 'settings' | 'help' | 'manual' | 'rules' | 'compare' | 'prettify' | null

export type PdfState = {
  title: string
  meta: string
  pages: string[]
}

export type ConfirmModel = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export type SheetsModel = {
  detail: { record: LogRecord; zone: Prefs['zone']; onClose: () => void } | null
  quick: {
    open: boolean
    connected: boolean
    onManual: () => void
    onHelp: () => void
    onClose: () => void
  }
  clear: ConfirmModel
  close: ConfirmModel
  settings: {
    open: boolean
    onClose: () => void
    prefs: Prefs
    onSave: (draft: Prefs) => void
    onOpenRules: () => void
    port: string
    bufferCap: number
  }
  help: { open: boolean; onClose: () => void; onQuickStart: () => void }
  manual: {
    open: boolean
    cap: number
    rules: ParseRules
    onClose: () => void
    onParse: (records: LogRecord[], totalLines: number) => void
  }
  rules: {
    open: boolean
    rules: ParseRules
    zone: Prefs['zone']
    onClose: () => void
    onSave: (next: ParseRules) => void
  }
  compare: { open: boolean; onClose: () => void }
  prettify: { open: boolean; onClose: () => void }
  print: { open: boolean; title: string; meta: string; pages: string[]; onClose: () => void }
}

export type SheetsInput = {
  sheet: SheetName
  onCloseSheet: () => void
  onOpenRules: () => void
  onQuickStartFromHelp: () => void
  quickOpen: boolean
  connected: boolean
  onQuickManual: () => void
  onQuickHelp: () => void
  onQuickClose: () => void
  detail: { record: LogRecord; zone: Prefs['zone'] } | null
  onCloseDetail: () => void
  clearTarget: StreamEntry | null
  onConfirmClear: () => void
  onCancelClear: () => void
  closeTarget: StreamEntry | null
  onConfirmClose: () => void
  onCancelClose: () => void
  prefs: Prefs
  onSavePrefs: (draft: Prefs) => void
  rules: ParseRules
  onSaveRules: (next: ParseRules) => void
  onParseManual: (records: LogRecord[], totalLines: number) => void
  pdfState: PdfState | null
  onClosePdf: () => void
}

export function buildSheets(input: SheetsInput): SheetsModel {
  const clearEntry = input.clearTarget
  const closeEntry = input.closeTarget
  return {
    detail:
      input.detail === null
        ? null
        : { record: input.detail.record, zone: input.detail.zone, onClose: input.onCloseDetail },
    quick: {
      open: input.quickOpen,
      connected: input.connected,
      onManual: input.onQuickManual,
      onHelp: input.onQuickHelp,
      onClose: input.onQuickClose,
    },
    clear: {
      open: clearEntry !== null,
      title: clearEntry === null ? 'Clear this buffer?' : `Clear the ${clearEntry.name} buffer?`,
      body:
        clearEntry === null
          ? 'This removes the retained lines for the stream. This cannot be undone.'
          : clearBody(clearEntry),
      confirmLabel: 'Clear buffer',
      cancelLabel: 'Keep lines',
      onConfirm: input.onConfirmClear,
      onCancel: input.onCancelClear,
    },
    close: {
      open: closeEntry !== null,
      title: closeEntry === null ? 'Close this tab?' : `Close ${closeEntry.name}?`,
      body:
        closeEntry === null
          ? 'This removes the tab and its buffer. This cannot be undone.'
          : closeBody(closeEntry),
      confirmLabel: 'Close tab',
      cancelLabel: 'Keep open',
      onConfirm: input.onConfirmClose,
      onCancel: input.onCancelClose,
    },
    settings: {
      open: input.sheet === 'settings',
      onClose: input.onCloseSheet,
      prefs: input.prefs,
      onSave: input.onSavePrefs,
      onOpenRules: input.onOpenRules,
      port: window.location.port === '' ? '3333' : window.location.port,
      bufferCap: BUFFER_CAP,
    },
    help: {
      open: input.sheet === 'help',
      onClose: input.onCloseSheet,
      onQuickStart: input.onQuickStartFromHelp,
    },
    manual: {
      open: input.sheet === 'manual',
      cap: BUFFER_CAP,
      rules: input.rules,
      onClose: input.onCloseSheet,
      onParse: input.onParseManual,
    },
    rules: {
      open: input.sheet === 'rules',
      rules: input.rules,
      zone: input.prefs.zone,
      onClose: input.onCloseSheet,
      onSave: input.onSaveRules,
    },
    compare: { open: input.sheet === 'compare', onClose: input.onCloseSheet },
    prettify: { open: input.sheet === 'prettify', onClose: input.onCloseSheet },
    print: {
      open: input.pdfState !== null,
      title: input.pdfState?.title ?? '',
      meta: input.pdfState?.meta ?? '',
      pages: input.pdfState?.pages ?? [],
      onClose: input.onClosePdf,
    },
  }
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
