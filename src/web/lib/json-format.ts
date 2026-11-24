export type PrettifyResult =
  | { ok: true; text: string; decoded: boolean }
  | { ok: false; error: string }

export const MAX_PRETTIFY_BYTES = 1_000_000

export type PrettifyIndent = 2 | 4

export type PrettifyOptions = {
  indent?: PrettifyIndent
  minify?: boolean
  sortKeys?: boolean
}

const ESCAPE_PATTERN = /\\(u[0-9a-fA-F]{4}|["\\/bfnrt])/g

const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

export function unescapeJsonish(text: string): string {
  return text.replace(ESCAPE_PATTERN, (match, sequence: string) => {
    if (!sequence.startsWith('u')) return SIMPLE_ESCAPES[sequence] ?? match
    const code = Number.parseInt(sequence.slice(1), 16)
    return Number.isNaN(code) ? match : String.fromCharCode(code)
  })
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export type DecodedJson = { value: unknown; decoded: boolean }

export function decodeJsonText(raw: string): DecodedJson | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  let value = tryParseJson(trimmed)
  let decoded = false
  if (value === undefined) {
    const unescaped = unescapeJsonish(trimmed)
    if (unescaped === trimmed) return null
    value = tryParseJson(unescaped)
    if (value === undefined) return null
    decoded = true
  }
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof value !== 'string') return { value, decoded }
    const inner = value.trim()
    if (inner.length === 0) return { value, decoded }
    const first = inner[0]
    if (first !== '{' && first !== '[') return { value, decoded }
    const direct = tryParseJson(inner)
    if (direct !== undefined) {
      value = direct
      decoded = true
      continue
    }
    const unescapedInner = unescapeJsonish(inner)
    if (unescapedInner === inner) return { value, decoded }
    const viaEscape = tryParseJson(unescapedInner)
    if (viaEscape === undefined) return { value, decoded }
    value = viaEscape
    decoded = true
  }
  return { value, decoded }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeysDeep(item))
  if (value === null || typeof value !== 'object') return value
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
  }
  return sorted
}

export function prettifyJsonText(
  raw: string,
  options: PrettifyOptions = {},
  maxBytes = MAX_PRETTIFY_BYTES,
): PrettifyResult {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: 'Paste JSON first.' }
  }
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { ok: false, error: 'This input is over 1 MB.' }
  }
  const decodedJson = decodeJsonText(trimmed)
  if (decodedJson === null) {
    return { ok: false, error: 'This is not valid JSON.' }
  }
  const value = options.sortKeys === true ? sortKeysDeep(decodedJson.value) : decodedJson.value
  if (options.minify === true) {
    return { ok: true, text: JSON.stringify(value), decoded: decodedJson.decoded }
  }
  return {
    ok: true,
    text: JSON.stringify(value, null, options.indent ?? 2),
    decoded: decodedJson.decoded,
  }
}
