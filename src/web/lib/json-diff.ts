export type DiffKind = 'added' | 'removed' | 'changed'

export type DiffEntry = {
  path: string
  kind: DiffKind
  before?: unknown
  after?: unknown
}

export type DiffResult = {
  entries: DiffEntry[]
  truncated: boolean
}

const MAX_ENTRIES = 5_000
const MAX_DEPTH = 100
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function isBranch(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

function childPath(base: string, key: string, index: boolean): string {
  if (index) return `${base}[${key}]`
  return IDENTIFIER.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  depth: number,
  entries: DiffEntry[],
): void {
  if (entries.length >= MAX_ENTRIES) return
  if (Object.is(before, after)) return
  if (depth > MAX_DEPTH) {
    entries.push({ path, kind: 'changed', before, after })
    return
  }
  const beforeBranch = isBranch(before)
  const afterBranch = isBranch(after)
  if (!beforeBranch || !afterBranch) {
    entries.push({ path, kind: 'changed', before, after })
    return
  }
  const beforeArray = Array.isArray(before)
  const afterArray = Array.isArray(after)
  if (beforeArray !== afterArray) {
    entries.push({ path, kind: 'changed', before, after })
    return
  }
  if (beforeArray) {
    const left = before as unknown[]
    const right = after as unknown[]
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
      if (entries.length >= MAX_ENTRIES) return
      const child = childPath(path, String(index), true)
      const hasBefore = index < left.length
      const hasAfter = index < right.length
      if (!hasBefore) {
        entries.push({ path: child, kind: 'added', after: right[index] })
        continue
      }
      if (!hasAfter) {
        entries.push({ path: child, kind: 'removed', before: left[index] })
        continue
      }
      walk(left[index], right[index], child, depth + 1, entries)
    }
    return
  }
  const left = before as Record<string, unknown>
  const right = after as Record<string, unknown>
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])]
  for (const key of keys) {
    if (entries.length >= MAX_ENTRIES) return
    const child = childPath(path, key, false)
    const hasBefore = Object.hasOwn(left, key)
    const hasAfter = Object.hasOwn(right, key)
    if (!hasBefore) {
      entries.push({ path: child, kind: 'added', after: right[key] })
      continue
    }
    if (!hasAfter) {
      entries.push({ path: child, kind: 'removed', before: left[key] })
      continue
    }
    walk(left[key], right[key], child, depth + 1, entries)
  }
}

export function diffJson(before: unknown, after: unknown): DiffResult {
  const entries: DiffEntry[] = []
  walk(before, after, '$', 0, entries)
  return { entries, truncated: entries.length >= MAX_ENTRIES }
}

export function diffValueText(value: unknown): string {
  if (value === undefined) return '—'
  const text =
    typeof value === 'string'
      ? JSON.stringify(value)
      : typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value)
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

export function diffToText(entries: readonly DiffEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.kind === 'added') return `+ ${entry.path} ${diffValueText(entry.after)}`
      if (entry.kind === 'removed') return `- ${entry.path} ${diffValueText(entry.before)}`
      return `~ ${entry.path} ${diffValueText(entry.before)} -> ${diffValueText(entry.after)}`
    })
    .join('\n')
}
