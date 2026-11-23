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

type Snake = {
  leftStart: number
  rightStart: number
  leftEnd: number
  rightEnd: number
}

export function prettyLines(value: unknown): string[] {
  return prettyJson(value).split('\n')
}

function findMiddleSnake(
  before: readonly string[],
  after: readonly string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): Snake {
  const leftLength = leftEnd - leftStart
  const rightLength = rightEnd - rightStart
  const delta = leftLength - rightLength
  const odd = (delta & 1) !== 0
  const maxSteps = Math.ceil((leftLength + rightLength) / 2)
  const offset = maxSteps + 1
  const size = 2 * maxSteps + 3
  const forward = new Int32Array(size).fill(-1)
  const backward = new Int32Array(size).fill(-1)
  forward[offset + 1] = 0
  backward[offset + 1] = 0

  for (let step = 0; step <= maxSteps; step += 1) {
    for (let diagonal = -step; diagonal <= step; diagonal += 2) {
      const index = offset + diagonal
      const down =
        diagonal === -step || (diagonal !== step && forward[index - 1] < forward[index + 1])
      let x = down ? forward[index + 1] : forward[index - 1] + 1
      let y = x - diagonal
      const snakeLeftStart = x
      const snakeRightStart = y
      while (x < leftLength && y < rightLength && before[leftStart + x] === after[rightStart + y]) {
        x += 1
        y += 1
      }
      forward[index] = x
      if (!odd) continue
      if (diagonal < delta - (step - 1)) continue
      if (diagonal > delta + (step - 1)) continue
      if (forward[index] + backward[offset + delta - diagonal] < leftLength) continue
      return {
        leftStart: leftStart + snakeLeftStart,
        rightStart: rightStart + snakeRightStart,
        leftEnd: leftStart + x,
        rightEnd: rightStart + y,
      }
    }

    for (let diagonal = -step; diagonal <= step; diagonal += 2) {
      const index = offset + diagonal
      const down =
        diagonal === -step || (diagonal !== step && backward[index - 1] < backward[index + 1])
      let x = down ? backward[index + 1] : backward[index - 1] + 1
      let y = x - diagonal
      const snakeLeftEnd = x
      const snakeRightEnd = y
      while (
        x < leftLength &&
        y < rightLength &&
        before[leftEnd - 1 - x] === after[rightEnd - 1 - y]
      ) {
        x += 1
        y += 1
      }
      backward[index] = x
      if (odd) continue
      if (diagonal < delta - step) continue
      if (diagonal > delta + step) continue
      if (backward[index] + forward[offset + delta - diagonal] < leftLength) continue
      return {
        leftStart: leftEnd - x,
        rightStart: rightEnd - y,
        leftEnd: leftEnd - snakeLeftEnd,
        rightEnd: rightEnd - snakeRightEnd,
      }
    }
  }

  throw new Error('middle snake not found')
}

function appendSuffix(steps: EditStep[], suffix: readonly EditStep[]): void {
  for (let index = suffix.length - 1; index >= 0; index -= 1) {
    steps.push(suffix[index])
  }
}

function emitSteps(
  before: readonly string[],
  after: readonly string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  steps: EditStep[],
): void {
  while (leftStart < leftEnd && rightStart < rightEnd && before[leftStart] === after[rightStart]) {
    steps.push({ kind: 'same', leftIndex: leftStart, rightIndex: rightStart })
    leftStart += 1
    rightStart += 1
  }

  const suffix: EditStep[] = []
  while (
    leftStart < leftEnd &&
    rightStart < rightEnd &&
    before[leftEnd - 1] === after[rightEnd - 1]
  ) {
    leftEnd -= 1
    rightEnd -= 1
    suffix.push({ kind: 'same', leftIndex: leftEnd, rightIndex: rightEnd })
  }

  if (leftStart === leftEnd) {
    for (let index = rightStart; index < rightEnd; index += 1) {
      steps.push({ kind: 'added', leftIndex: -1, rightIndex: index })
    }
    appendSuffix(steps, suffix)
    return
  }

  if (rightStart === rightEnd) {
    for (let index = leftStart; index < leftEnd; index += 1) {
      steps.push({ kind: 'removed', leftIndex: index, rightIndex: -1 })
    }
    appendSuffix(steps, suffix)
    return
  }

  const snake = findMiddleSnake(before, after, leftStart, leftEnd, rightStart, rightEnd)
  const progressed =
    snake.leftStart > leftStart || snake.rightStart > rightStart || snake.leftEnd > snake.leftStart

  if (!progressed) {
    steps.push({ kind: 'removed', leftIndex: leftStart, rightIndex: -1 })
    emitSteps(before, after, leftStart + 1, leftEnd, rightStart, rightEnd, steps)
    appendSuffix(steps, suffix)
    return
  }

  emitSteps(before, after, leftStart, snake.leftStart, rightStart, snake.rightStart, steps)
  for (let index = 0; index < snake.leftEnd - snake.leftStart; index += 1) {
    steps.push({
      kind: 'same',
      leftIndex: snake.leftStart + index,
      rightIndex: snake.rightStart + index,
    })
  }
  emitSteps(before, after, snake.leftEnd, leftEnd, snake.rightEnd, rightEnd, steps)
  appendSuffix(steps, suffix)
}

function rowFromStep(step: EditStep, before: readonly string[], after: readonly string[]): DiffRow {
  if (step.kind === 'same') {
    return {
      kind: 'same',
      leftNo: step.leftIndex + 1,
      rightNo: step.rightIndex + 1,
      leftText: before[step.leftIndex],
      rightText: after[step.rightIndex],
    }
  }
  if (step.kind === 'removed') {
    return {
      kind: 'removed',
      leftNo: step.leftIndex + 1,
      rightNo: null,
      leftText: before[step.leftIndex],
      rightText: null,
    }
  }
  return {
    kind: 'added',
    leftNo: null,
    rightNo: step.rightIndex + 1,
    leftText: null,
    rightText: after[step.rightIndex],
  }
}

function normalizeSteps(steps: EditStep[]): void {
  let index = 0
  while (index < steps.length) {
    if (steps[index].kind === 'same') {
      index += 1
      continue
    }
    const start = index
    while (index < steps.length && steps[index].kind !== 'same') {
      index += 1
    }
    const block = steps.slice(start, index)
    const removals = block.filter((step) => step.kind === 'removed')
    const additions = block.filter((step) => step.kind === 'added')
    steps.splice(start, block.length, ...removals, ...additions)
  }
}

export function diffLines(before: readonly string[], after: readonly string[]): DiffRow[] {
  const steps: EditStep[] = []
  emitSteps(before, after, 0, before.length, 0, after.length, steps)
  normalizeSteps(steps)
  return steps.map((step) => rowFromStep(step, before, after))
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
