export type GqlTokenKind =
  | 'keyword'
  | 'field'
  | 'variable'
  | 'string'
  | 'number'
  | 'comment'
  | 'punct'
  | 'plain'

export type GqlToken = {
  text: string
  kind: GqlTokenKind
}

const KEYWORDS = new Set([
  'query',
  'mutation',
  'subscription',
  'fragment',
  'on',
  'true',
  'false',
  'null',
])

const GQL_TOKEN =
  /(?<block>"""[\s\S]*?""")|(?<string>"(?:\\.|[^"\\])*")|(?<comment>#[^\n]*)|(?<spread>\.\.\.)|(?<variable>\$[A-Za-z_][A-Za-z0-9_]*)|(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?<name>[A-Za-z_][A-Za-z0-9_]*)|(?<punct>[!{}()[\]@:=|&,])/g

type RawToken = {
  text: string
  type: 'block' | 'string' | 'comment' | 'spread' | 'variable' | 'number' | 'name' | 'punct'
}

export function tokenizeGql(source: string): RawToken[] {
  const tokens: RawToken[] = []
  for (const match of source.matchAll(GQL_TOKEN)) {
    const groups = match.groups ?? {}
    const type = (
      groups.block !== undefined
        ? 'block'
        : groups.string !== undefined
          ? 'string'
          : groups.comment !== undefined
            ? 'comment'
            : groups.spread !== undefined
              ? 'spread'
              : groups.variable !== undefined
                ? 'variable'
                : groups.number !== undefined
                  ? 'number'
                  : groups.name !== undefined
                    ? 'name'
                    : 'punct'
    ) as RawToken['type']
    tokens.push({ text: match[0], type })
  }
  return tokens
}

export const GQL_LINE_PATTERN =
  /(?<block>"""[\s\S]*?""")|(?<string>"(?:\\.|[^"\\])*")|(?<comment>#[^\n]*)|(?<spread>\.\.\.)|(?<variable>\$[A-Za-z_][A-Za-z0-9_]*)|(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?<name>[A-Za-z_][A-Za-z0-9_]*)|(?<punct>[!{}()[\]@:=|&,])/g

export function gqlLineTokens(line: string): GqlToken[] {
  if (line.length === 0) return []
  const tokens: GqlToken[] = []
  let cursor = 0
  for (const match of line.matchAll(GQL_LINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ text: line.slice(cursor, index), kind: 'plain' })
    cursor = index + match[0].length
    const groups = match.groups ?? {}
    if (groups.comment !== undefined) {
      tokens.push({ text: match[0], kind: 'comment' })
      continue
    }
    if (groups.string !== undefined || groups.block !== undefined) {
      tokens.push({ text: match[0], kind: 'string' })
      continue
    }
    if (groups.variable !== undefined) {
      tokens.push({ text: match[0], kind: 'variable' })
      continue
    }
    if (groups.number !== undefined) {
      tokens.push({ text: match[0], kind: 'number' })
      continue
    }
    if (groups.name !== undefined) {
      const kind: GqlTokenKind = KEYWORDS.has(match[0]) ? 'keyword' : 'field'
      tokens.push({ text: match[0], kind })
      continue
    }
    tokens.push({ text: match[0], kind: 'punct' })
  }
  if (cursor < line.length) tokens.push({ text: line.slice(cursor), kind: 'plain' })
  return tokens
}

export type GqlFormatResult = { ok: true; text: string } | { ok: false; error: string }

const INDENT = '  '

const NO_SPACE_AFTER = new Set(['(', '[', '@', '...'])
const TIGHT_TOKEN = new Set(['(', ')', ']', '!', ':'])
const SELECTION_CONTINUE = new Set(['on'])

type Writer = {
  lines: string[]
  line: string
  indent: number
  selectionDepth: number
  objectDepth: number
  parenDepth: number
  bracketDepth: number
  continuation: boolean
}

function flush(writer: Writer): void {
  if (writer.line.length === 0) return
  writer.lines.push(writer.line.replace(/\s+$/, ''))
  writer.line = ''
}

function append(writer: Writer, text: string, spaceBefore: boolean): void {
  if (writer.line.length === 0) {
    writer.line = `${INDENT.repeat(writer.indent)}${text}`
    return
  }
  writer.line += spaceBefore ? ` ${text}` : text
}

function atSelectionLevel(writer: Writer): boolean {
  return writer.selectionDepth > 0 && writer.parenDepth === 0 && writer.bracketDepth === 0
}

function needsSpaceBefore(writer: Writer, token: RawToken, previous: RawToken | null): boolean {
  if (writer.line.length === 0) return false
  if (previous === null) return false
  if (NO_SPACE_AFTER.has(previous.text) && token.text !== 'on') return false
  if (token.type === 'punct' && TIGHT_TOKEN.has(token.text)) return false
  return true
}

export function formatGql(source: string): GqlFormatResult {
  const tokens = tokenizeGql(source)
  if (tokens.length === 0) return { ok: false, error: 'Nothing to format yet.' }
  const writer: Writer = {
    lines: [],
    line: '',
    indent: 0,
    selectionDepth: 0,
    objectDepth: 0,
    parenDepth: 0,
    bracketDepth: 0,
    continuation: false,
  }
  let previous: RawToken | null = null

  for (const token of tokens) {
    if (token.type === 'comment') {
      flush(writer)
      writer.line = `${INDENT.repeat(writer.indent)}${token.text}`
      flush(writer)
      previous = token
      continue
    }

    const isPunct = token.type === 'punct'

    if (isPunct && token.text === '{') {
      if (writer.parenDepth > 0 || writer.bracketDepth > 0) {
        append(writer, '{', writer.line.length > 0)
        writer.objectDepth += 1
        writer.continuation = true
        previous = token
        continue
      }
      append(writer, '{', writer.line.length > 0)
      flush(writer)
      writer.indent += 1
      writer.selectionDepth += 1
      writer.continuation = false
      previous = token
      continue
    }

    if (isPunct && token.text === '}') {
      if (writer.objectDepth > 0) {
        writer.objectDepth -= 1
        append(writer, '}', true)
        writer.continuation = writer.objectDepth > 0
        previous = token
        continue
      }
      if (writer.selectionDepth === 0) return { ok: false, error: 'Unbalanced closing brace.' }
      writer.selectionDepth -= 1
      writer.indent = Math.max(0, writer.indent - 1)
      flush(writer)
      writer.line = `${INDENT.repeat(writer.indent)}}`
      writer.continuation = false
      previous = token
      continue
    }

    if (isPunct && token.text === '(') {
      writer.parenDepth += 1
      append(writer, '(', false)
      writer.continuation = true
      previous = token
      continue
    }

    if (isPunct && token.text === ')') {
      writer.parenDepth = Math.max(0, writer.parenDepth - 1)
      append(writer, ')', false)
      writer.continuation = false
      previous = token
      continue
    }

    if (isPunct && token.text === '[') {
      writer.bracketDepth += 1
      append(writer, '[', needsSpaceBefore(writer, token, previous))
      writer.continuation = true
      previous = token
      continue
    }

    if (isPunct && token.text === ']') {
      writer.bracketDepth = Math.max(0, writer.bracketDepth - 1)
      append(writer, ']', false)
      writer.continuation = false
      previous = token
      continue
    }

    if (isPunct && token.text === ',') {
      append(writer, ',', false)
      writer.continuation = true
      previous = token
      continue
    }

    if (isPunct && token.text === ':') {
      append(writer, ':', false)
      writer.continuation = true
      previous = token
      continue
    }

    if (isPunct && token.text === '@') {
      append(writer, '@', needsSpaceBefore(writer, token, previous))
      writer.continuation = true
      previous = token
      continue
    }

    if (token.type === 'spread') {
      if (atSelectionLevel(writer) && !writer.continuation) flush(writer)
      append(writer, '...', needsSpaceBefore(writer, token, previous))
      writer.continuation = true
      previous = token
      continue
    }

    const startsSelection =
      token.type === 'name' && atSelectionLevel(writer) && !writer.continuation
    if (startsSelection && writer.line.length > 0) flush(writer)

    const spaceBefore = needsSpaceBefore(writer, token, previous)
    append(writer, token.text, spaceBefore)
    const continueInline =
      token.type === 'name' && SELECTION_CONTINUE.has(token.text) && atSelectionLevel(writer)
    writer.continuation = continueInline
    previous = token
  }

  if (writer.selectionDepth !== 0) return { ok: false, error: 'Unbalanced braces.' }
  if (writer.objectDepth !== 0) return { ok: false, error: 'Unbalanced braces.' }
  if (writer.parenDepth !== 0) return { ok: false, error: 'Unbalanced parentheses.' }
  if (writer.bracketDepth !== 0) return { ok: false, error: 'Unbalanced brackets.' }
  flush(writer)
  return { ok: true, text: writer.lines.join('\n') }
}
