export type PrettifyResult = { ok: true; text: string } | { ok: false; error: string }

export const MAX_PRETTIFY_BYTES = 1_000_000

export type PrettifyIndent = 2 | 4

export type PrettifyOptions = {
  indent?: PrettifyIndent
  minify?: boolean
  sortKeys?: boolean
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
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'This is not valid JSON.' }
  }
  const value = options.sortKeys === true ? sortKeysDeep(parsed) : parsed
  if (options.minify === true) {
    return { ok: true, text: JSON.stringify(value) }
  }
  return { ok: true, text: JSON.stringify(value, null, options.indent ?? 2) }
}
