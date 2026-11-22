import { prettyJson } from './json-pretty.ts'

export type DiffRowKind = 'same' | 'added' | 'removed' | 'changed'

export type DiffRow = {
  kind: DiffRowKind
  leftNo: number | null
  rightNo: number | null
  leftText: string | null
  rightText: string | null
}

type EditStep = {
  kind: 'same' | 'removed' | 'added'
  leftIndex: number
  rightIndex: number
}

const MAX_EDIT_DISTANCE = 2000
const MAX_ROWS = 2000

export function prettyLines(value: unknown): string[] {
  return prettyJson(value).split('\n')
}

function commonPrefixLength(before: readonly string[], after: readonly string[]): number {
  const limit = Math.min(before.length, after.length)
  let index = 0
  while (index < limit && before[index] === after[index]) {
    index += 1
  }
  return index
}

function commonSuffixLength(
  before: readonly string[],
  after: readonly string[],
  prefix: number,
): number {
  const limit = Math.min(before.length, after.length) - prefix
  let index = 0
  while (index < limit && before[before.length - 1 - index] === after[after.length - 1 - index]) {
    index += 1
  }
  return index
}

function buildTrace(
  before: readonly string[],
  after: readonly string[],
  limit: number,
): Int32Array[] | null {
  const leftLength = before.length
  const rightLength = after.length
  const span = leftLength + rightLength
  if (span === 0) return [new Int32Array(1)]
  const offset = span
  const furthest = new Int32Array(2 * span + 1)
  const trace: Int32Array[] = []
  const maxStep = Math.min(limit, span)
  for (let step = 0; step <= maxStep; step += 1) {
    trace.push(furthest.slice(offset - step, offset + step + 1))
    for (let diagonal = -step; diagonal <= step; diagonal += 2) {
      const movesDown =
        diagonal === -step ||
        (diagonal !== step && furthest[offset + diagonal - 1] < furthest[offset + diagonal + 1])
      const startX = movesDown
        ? furthest[offset + diagonal + 1]
        : furthest[offset + diagonal - 1] + 1
      let x = startX
      let y = x - diagonal
      while (x < leftLength && y < rightLength && before[x] === after[y]) {
        x += 1
        y += 1
      }
      furthest[offset + diagonal] = x
      if (x >= leftLength && y >= rightLength) return trace
    }
  }
  return null
}

function traceToSteps(
  trace: readonly Int32Array[],
  leftLength: number,
  rightLength: number,
): EditStep[] {
  const steps: EditStep[] = []
  let x = leftLength
  let y = rightLength
  for (let step = trace.length - 1; step >= 0; step -= 1) {
    if (step === 0) {
      while (x > 0 && y > 0) {
        x -= 1
        y -= 1
        steps.push({ kind: 'same', leftIndex: x, rightIndex: y })
      }
      continue
    }
    const slice = trace[step]
    const diagonal = x - y
    const movesDown =
      diagonal === -step ||
      (diagonal !== step && slice[diagonal - 1 + step] < slice[diagonal + 1 + step])
    const previousDiagonal = movesDown ? diagonal + 1 : diagonal - 1
    const previousX = slice[previousDiagonal + step]
    const previousY = previousX - previousDiagonal
    while (x > previousX && y > previousY) {
      x -= 1
      y -= 1
      steps.push({ kind: 'same', leftIndex: x, rightIndex: y })
    }
    if (x === previousX) {
      y -= 1
      steps.push({ kind: 'added', leftIndex: -1, rightIndex: y })
      continue
    }
    x -= 1
    steps.push({ kind: 'removed', leftIndex: x, rightIndex: -1 })
  }
  return steps.reverse()
}

function rowFromStep(
  step: EditStep,
  before: readonly string[],
  after: readonly string[],
  offset: number,
): DiffRow {
  if (step.kind === 'same') {
    return {
      kind: 'same',
      leftNo: step.leftIndex + offset + 1,
      rightNo: step.rightIndex + offset + 1,
      leftText: before[step.leftIndex],
      rightText: after[step.rightIndex],
    }
  }
  if (step.kind === 'removed') {
    return {
      kind: 'removed',
      leftNo: step.leftIndex + offset + 1,
      rightNo: null,
      leftText: before[step.leftIndex],
      rightText: null,
    }
  }
  return {
    kind: 'added',
    leftNo: null,
    rightNo: step.rightIndex + offset + 1,
    leftText: null,
    rightText: after[step.rightIndex],
  }
}

function appendSteps(
  rows: DiffRow[],
  steps: readonly EditStep[],
  before: readonly string[],
  after: readonly string[],
  offset: number,
): void {
  for (const step of steps) {
    if (rows.length >= MAX_ROWS) return
    rows.push(rowFromStep(step, before, after, offset))
  }
}

function appendSameRun(
  rows: DiffRow[],
  before: readonly string[],
  after: readonly string[],
  leftStart: number,
  rightStart: number,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    if (rows.length >= MAX_ROWS) return
    rows.push({
      kind: 'same',
      leftNo: leftStart + index + 1,
      rightNo: rightStart + index + 1,
      leftText: before[leftStart + index],
      rightText: after[rightStart + index],
    })
  }
}

function appendFallback(
  rows: DiffRow[],
  before: readonly string[],
  after: readonly string[],
  prefix: number,
  suffix: number,
): void {
  const leftEnd = before.length - suffix
  const rightEnd = after.length - suffix
  for (let index = prefix; index < leftEnd; index += 1) {
    if (rows.length >= MAX_ROWS) return
    rows.push({
      kind: 'removed',
      leftNo: index + 1,
      rightNo: null,
      leftText: before[index],
      rightText: null,
    })
  }
  for (let index = prefix; index < rightEnd; index += 1) {
    if (rows.length >= MAX_ROWS) return
    rows.push({
      kind: 'added',
      leftNo: null,
      rightNo: index + 1,
      leftText: null,
      rightText: after[index],
    })
  }
}

export function diffLines(before: readonly string[], after: readonly string[]): DiffRow[] {
  const rows: DiffRow[] = []
  const prefix = commonPrefixLength(before, after)
  const suffix = commonSuffixLength(before, after, prefix)
  appendSameRun(rows, before, after, 0, 0, prefix)
  if (rows.length >= MAX_ROWS) return rows
  const leftMiddle = before.slice(prefix, before.length - suffix)
  const rightMiddle = after.slice(prefix, after.length - suffix)
  const trace = buildTrace(leftMiddle, rightMiddle, MAX_EDIT_DISTANCE)
  if (trace === null) {
    appendFallback(rows, before, after, prefix, suffix)
    return rows
  }
  const steps = traceToSteps(trace, leftMiddle.length, rightMiddle.length)
  appendSteps(rows, steps, leftMiddle, rightMiddle, prefix)
  if (rows.length >= MAX_ROWS) return rows
  appendSameRun(rows, before, after, before.length - suffix, after.length - suffix, suffix)
  return rows
}

export function pairChanged(rows: readonly DiffRow[]): DiffRow[] {
  const paired: DiffRow[] = []
  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (row.kind !== 'removed') {
      paired.push(row)
      index += 1
      continue
    }
    const removedRun: DiffRow[] = []
    while (index < rows.length && rows[index].kind === 'removed') {
      removedRun.push(rows[index])
      index += 1
    }
    const addedRun: DiffRow[] = []
    while (index < rows.length && rows[index].kind === 'added') {
      addedRun.push(rows[index])
      index += 1
    }
    const pairCount = Math.min(removedRun.length, addedRun.length)
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      paired.push({
        kind: 'changed',
        leftNo: removedRun[pairIndex].leftNo,
        rightNo: addedRun[pairIndex].rightNo,
        leftText: removedRun[pairIndex].leftText,
        rightText: addedRun[pairIndex].rightText,
      })
    }
    for (let leftover = pairCount; leftover < removedRun.length; leftover += 1) {
      paired.push(removedRun[leftover])
    }
    for (let leftover = pairCount; leftover < addedRun.length; leftover += 1) {
      paired.push(addedRun[leftover])
    }
  }
  return paired
}

function numberText(value: number | null): string {
  return value === null ? '' : String(value)
}

function textText(value: string | null): string {
  return value === null ? '' : value
}

function formatRow(row: DiffRow): string {
  if (row.kind === 'changed') {
    return `~ ${numberText(row.leftNo)} ${textText(row.leftText)} -> ${textText(row.rightText)}`
  }
  if (row.kind === 'removed') {
    return `- ${numberText(row.leftNo)} ${textText(row.leftText)}`
  }
  if (row.kind === 'added') {
    return `+ ${numberText(row.rightNo)} ${textText(row.rightText)}`
  }
  return `  ${numberText(row.leftNo)} ${textText(row.leftText)}`
}

export function diffRowsToText(rows: readonly DiffRow[]): string {
  return rows.map(formatRow).join('\n')
}

export function diffStats(rows: readonly DiffRow[]): {
  added: number
  removed: number
  changed: number
} {
  let added = 0
  let removed = 0
  let changed = 0
  for (const row of rows) {
    if (row.kind === 'added') added += 1
    if (row.kind === 'removed') removed += 1
    if (row.kind === 'changed') changed += 1
  }
  return { added, removed, changed }
}
