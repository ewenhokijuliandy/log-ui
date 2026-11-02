export type JsonTokenKind = 'key' | 'string' | 'number' | 'bool' | 'null' | 'plain'

export type JsonToken = {
  text: string
  kind: JsonTokenKind
}

const TOKEN_PATTERN =
  /(?<key>"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"\s*:)|(?<string>"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*")|(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(?<bool>true|false)\b|\b(?<nil>null)\b/g

export function prettyJson(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2)
    return typeof text === 'string' ? text : ''
  } catch {
    return ''
  }
}

export function jsonTokens(value: unknown): JsonToken[] {
  const source = prettyJson(value)
  if (source.length === 0) return []
  const tokens: JsonToken[] = []
  let cursor = 0
  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ text: source.slice(cursor, index), kind: 'plain' })
    cursor = index + match[0].length
    const groups = match.groups ?? {}
    if (groups.key !== undefined) {
      tokens.push({ text: match[0], kind: 'key' })
      continue
    }
    if (groups.string !== undefined) {
      tokens.push({ text: match[0], kind: 'string' })
      continue
    }
    if (groups.number !== undefined) {
      tokens.push({ text: match[0], kind: 'number' })
      continue
    }
    if (groups.bool !== undefined) {
      tokens.push({ text: match[0], kind: 'bool' })
      continue
    }
    tokens.push({ text: match[0], kind: 'null' })
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor), kind: 'plain' })
  return tokens
}
