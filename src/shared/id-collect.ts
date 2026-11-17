const ID_LIMIT = 8

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const HEX32_PATTERN = /\b[0-9a-f]{32}\b/gi
const KEYED_ID_PATTERN =
  /\b(?:trace|span|request|correlation|conversation|x-request)[-_]?(?:id)?\s*[=:]\s*["']?([0-9a-zA-Z][0-9a-zA-Z_:-]{7,63})["']?/gi

const HEX_DIGIT_FLAGS = new Uint8Array(128)
for (const hexDigit of '0123456789abcdefABCDEF') {
  HEX_DIGIT_FLAGS[hexDigit.charCodeAt(0)] = 1
}

function longestHexRun(text: string): number {
  let longest = 0
  let run = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    const isHexDigit = code < 128 && HEX_DIGIT_FLAGS[code] === 1
    if (!isHexDigit) {
      run = 0
      continue
    }
    run += 1
    if (run > longest) longest = run
  }
  return longest
}

const JSON_ID_KEYS: readonly string[] = [
  'trace_id',
  'traceId',
  'trace',
  'span_id',
  'spanId',
  'span',
  'request_id',
  'requestId',
  'request',
  'req_id',
  'req',
  'correlation_id',
  'correlationId',
  'x_request_id',
  'x-request-id',
  'conversation_id',
]

export function collectIdsFromJson(json: unknown, into: Map<string, string>): void {
  if (typeof json !== 'object' || json === null) return
  const record = json as Record<string, unknown>
  for (const key of JSON_ID_KEYS) {
    if (into.size >= ID_LIMIT) return
    const raw = record[key]
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    const rawId = String(raw).trim()
    if (rawId.length < 8 || rawId.length > 64) continue
    const normalizedId = rawId.toLowerCase()
    into.set(normalizedId, rawId)
  }
}

export function collectIdsFromText(text: string, into: Map<string, string>): void {
  for (const match of text.matchAll(KEYED_ID_PATTERN)) {
    if (into.size >= ID_LIMIT) return
    const rawId = match[1]
    if (rawId === undefined) continue
    const normalizedId = rawId.toLowerCase()
    into.set(normalizedId, rawId)
  }
  const longestRun = longestHexRun(text)
  if (text.includes('-') && longestRun >= 8) {
    for (const match of text.matchAll(UUID_PATTERN)) {
      if (into.size >= ID_LIMIT) return
      const rawId = match[0]
      const normalizedId = rawId.toLowerCase()
      into.set(normalizedId, rawId)
    }
  }
  if (longestRun < 32) return
  for (const match of text.matchAll(HEX32_PATTERN)) {
    if (into.size >= ID_LIMIT) return
    const rawId = match[0]
    const normalizedId = rawId.toLowerCase()
    into.set(normalizedId, rawId)
  }
}

export function limitIds(collected: Map<string, string>): string[] {
  const ids: string[] = []
  for (const rawId of collected.values()) {
    if (ids.length >= ID_LIMIT) break
    ids.push(rawId)
  }
  return ids
}
