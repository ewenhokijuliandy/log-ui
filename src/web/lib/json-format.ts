export type PrettifyResult = { ok: true; text: string } | { ok: false; error: string }

export const MAX_PRETTIFY_BYTES = 1_000_000

export type PrettifyIndent = 2 | 4

export function prettifyJsonText(
  raw: string,
  indent: PrettifyIndent = 2,
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
  return { ok: true, text: JSON.stringify(parsed, null, indent) }
}
