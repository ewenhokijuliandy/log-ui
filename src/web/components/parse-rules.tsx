import { useEffect, useMemo, useState } from 'react'
import { parseLine } from '../../shared/parse-line.ts'
import {
  defaultParseRules,
  type NumericLevelPreset,
  type NumericUnit,
  normalizeParseRules,
  type ParseRules,
} from '../../shared/parse-rules.ts'
import type { LogLevel } from '../../shared/types.ts'
import { formatTime, type Zone } from '../lib/format-time.ts'
import { DialogFrame, Segment } from './dialogs.tsx'

const LEVEL_VALUES: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'unknown',
]

const DEFAULT_SAMPLE =
  '{"name":"checkout","time":1761134138742,"level":30,"msg":"numeric level mapped to info"}'

const PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'pino', label: 'Pino / Bunyan' },
  { value: 'syslog', label: 'Syslog' },
  { value: 'custom', label: 'Custom' },
]

const UNIT_OPTIONS: Array<{ value: NumericUnit; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 's', label: 'Seconds' },
  { value: 'ms', label: 'Milliseconds' },
  { value: 'us', label: 'Microseconds' },
  { value: 'ns', label: 'Nanoseconds' },
]

function splitKeys(value: string): string[] {
  return value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
}

function mapToText(map: Record<string, LogLevel>): string {
  return Object.entries(map)
    .map(([key, level]) => `${key}=${level}`)
    .join(', ')
}

function parseMapText(value: string): { map: Record<string, LogLevel>; problem: string } {
  const map: Record<string, LogLevel> = {}
  for (const entry of value.split(/[,\n]/)) {
    const text = entry.trim()
    if (text.length === 0) continue
    const separator = text.search(/[=:]/)
    if (separator <= 0) return { map, problem: `"${text}" is not a number=level pair.` }
    const key = text.slice(0, separator).trim()
    const level = text
      .slice(separator + 1)
      .trim()
      .toLowerCase()
    if (!/^\d+$/.test(key)) return { map, problem: `"${key}" is not a numeric level.` }
    if (!LEVEL_VALUES.includes(level as LogLevel)) {
      return { map, problem: `"${level}" is not a level.` }
    }
    map[key] = level as LogLevel
  }
  return { map, problem: '' }
}

export function ParseRulesDialog({
  open,
  rules,
  zone,
  onClose,
  onSave,
}: {
  open: boolean
  rules: ParseRules
  zone: Zone
  onClose: () => void
  onSave: (rules: ParseRules) => void
}) {
  const [levelKeys, setLevelKeys] = useState('')
  const [timeKeys, setTimeKeys] = useState('')
  const [messageKeys, setMessageKeys] = useState('')
  const [preset, setPreset] = useState<NumericLevelPreset>('auto')
  const [customMap, setCustomMap] = useState('')
  const [unit, setUnit] = useState<NumericUnit>('auto')
  const [sample, setSample] = useState(DEFAULT_SAMPLE)

  useEffect(() => {
    if (!open) return
    setLevelKeys(rules.json.levelKeys.join(', '))
    setTimeKeys(rules.json.timeKeys.join(', '))
    setMessageKeys(rules.json.messageKeys.join(', '))
    setPreset(rules.numeric.preset)
    setCustomMap(mapToText(rules.numeric.map))
    setUnit(rules.time.numericUnit)
    setSample(DEFAULT_SAMPLE)
  }, [open, rules])

  const draft = useMemo(() => {
    const parsedMap = parseMapText(customMap)
    return {
      rules: normalizeParseRules({
        version: 1,
        json: {
          levelKeys: splitKeys(levelKeys),
          timeKeys: splitKeys(timeKeys),
          messageKeys: splitKeys(messageKeys),
        },
        numeric: { preset, map: parsedMap.map },
        time: { numericUnit: unit },
      }),
      problem: preset === 'custom' ? parsedMap.problem : '',
    }
  }, [levelKeys, timeKeys, messageKeys, preset, customMap, unit])

  const preview = useMemo(
    () => parseLine(sample.trim().length > 0 ? sample : DEFAULT_SAMPLE, draft.rules),
    [sample, draft.rules],
  )

  function reset(): void {
    const next = defaultParseRules()
    setLevelKeys(next.json.levelKeys.join(', '))
    setTimeKeys(next.json.timeKeys.join(', '))
    setMessageKeys(next.json.messageKeys.join(', '))
    setPreset(next.numeric.preset)
    setCustomMap(mapToText(next.numeric.map))
    setUnit(next.time.numericUnit)
    setSample(DEFAULT_SAMPLE)
  }

  function save(): void {
    if (draft.problem.length > 0) return
    onSave(draft.rules)
  }

  return (
    <DialogFrame open={open} wide className="rules-dialog" label="Parsing rules" onClose={onClose}>
      <h2>Parsing rules</h2>
      <p>Applied in this browser to every retained line. The daemon keeps its built-in parse.</p>
      <div className="rules-grid">
        <label className="field">
          <span className="field-label">JSON level keys</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={levelKeys}
            onChange={(event) => setLevelKeys(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">JSON time keys</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={timeKeys}
            onChange={(event) => setTimeKeys(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">JSON message keys</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={messageKeys}
            onChange={(event) => setMessageKeys(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Numeric unit</span>
          <select value={unit} onChange={(event) => setUnit(event.target.value as NumericUnit)}>
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <span className="field-label">Numeric levels</span>
        <Segment
          label="Numeric levels"
          value={preset}
          options={PRESET_OPTIONS}
          onChange={(value) => setPreset(value as NumericLevelPreset)}
        />
      </div>
      {preset === 'custom' ? (
        <label className="field">
          <span className="field-label">Custom numeric levels</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="10=trace, 30=info, 60=fatal"
            value={customMap}
            onChange={(event) => setCustomMap(event.target.value)}
          />
        </label>
      ) : null}
      <label className="field">
        <span className="field-label">Test a line</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
      </label>
      <dl className="parsed rules-preview">
        <div>
          <dt>level</dt>
          <dd>{preview.level.toUpperCase()}</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd>{formatTime(preview.ts, zone)}</dd>
        </div>
        <div>
          <dt>message</dt>
          <dd title={preview.message}>{preview.message}</dd>
        </div>
        <div>
          <dt>json</dt>
          <dd>{preview.json === null ? 'none' : 'detected'}</dd>
        </div>
      </dl>
      <p className="rules-hint">
        Keys are comma-separated, up to 12 per list and 40 characters each. Empty lists fall back to
        the defaults.
      </p>
      {draft.problem.length > 0 ? (
        <p className="guard" role="alert">
          {draft.problem}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button className="btn ghost" type="button" onClick={reset}>
          Reset to defaults
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={draft.problem.length > 0}
          onClick={save}
        >
          Save rules
        </button>
      </div>
    </DialogFrame>
  )
}
