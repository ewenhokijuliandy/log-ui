import { describe, expect, test } from 'vitest'
import type { DiffRow } from './json-line-diff.ts'
import { diffLines, diffRowsToText, diffStats, pairChanged, prettyLines } from './json-line-diff.ts'
import { prettyJson } from './json-pretty.ts'

function kinds(rows: readonly DiffRow[]): string[] {
  return rows.map((row) => row.kind)
}

function minimalEdits(before: readonly string[], after: readonly string[]): number {
  const rows = before.length + 1
  const columns = after.length + 1
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0))
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const match = before[row - 1] === after[column - 1]
      table[row][column] = match
        ? table[row - 1][column - 1] + 1
        : Math.max(table[row - 1][column], table[row][column - 1])
    }
  }
  return before.length + after.length - 2 * table[before.length][after.length]
}

function makeRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function randomLines(random: () => number, length: number): string[] {
  const alphabet = ['a', 'b', 'c', 'd']
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)])
}

describe('pretty lines', () => {
  test('splits nested pretty JSON into indented lines', () => {
    const value = { a: 1, b: { c: 2 }, d: [true, null] }
    const lines = prettyLines(value)
    expect(lines).toEqual(prettyJson(value).split('\n'))
    expect(lines[0]).toBe('{')
    expect(lines[1]).toBe('  "a": 1,')
    expect(lines[2]).toBe('  "b": {')
    expect(lines[3]).toBe('    "c": 2')
    expect(lines[4]).toBe('  },')
    expect(lines).toContain('  "d": [')
    expect(lines.at(-1)).toBe('}')
  })

  test('keeps a single line for scalar values', () => {
    expect(prettyLines(42)).toEqual(['42'])
    expect(prettyLines(undefined)).toEqual([''])
  })
})

describe('line diff', () => {
  test('identical input yields same rows with 1-based numbers', () => {
    const rows = diffLines(['a', 'b', 'c'], ['a', 'b', 'c'])
    expect(rows).toEqual([
      { kind: 'same', leftNo: 1, rightNo: 1, leftText: 'a', rightText: 'a' },
      { kind: 'same', leftNo: 2, rightNo: 2, leftText: 'b', rightText: 'b' },
      { kind: 'same', leftNo: 3, rightNo: 3, leftText: 'c', rightText: 'c' },
    ])
  })

  test('a single changed line becomes one removed and one added', () => {
    const rows = diffLines(['a', 'b', 'c'], ['a', 'B', 'c'])
    expect(kinds(rows)).toEqual(['same', 'removed', 'added', 'same'])
    expect(rows[1]).toEqual({
      kind: 'removed',
      leftNo: 2,
      rightNo: null,
      leftText: 'b',
      rightText: null,
    })
    expect(rows[2]).toEqual({
      kind: 'added',
      leftNo: null,
      rightNo: 2,
      leftText: null,
      rightText: 'B',
    })
    const paired = pairChanged(rows)
    expect(kinds(paired)).toEqual(['same', 'changed', 'same'])
    expect(paired[1]).toEqual({
      kind: 'changed',
      leftNo: 2,
      rightNo: 2,
      leftText: 'b',
      rightText: 'B',
    })
  })

  test('a pure insertion yields one added row and no removed rows', () => {
    const rows = diffLines(['a', 'c'], ['a', 'b', 'c'])
    expect(kinds(rows)).toEqual(['same', 'added', 'same'])
    expect(rows.filter((row) => row.kind === 'removed')).toHaveLength(0)
    expect(rows[1]).toEqual({
      kind: 'added',
      leftNo: null,
      rightNo: 2,
      leftText: null,
      rightText: 'b',
    })
  })

  test('a pure deletion yields one removed row and no added rows', () => {
    const rows = diffLines(['a', 'b', 'c'], ['a', 'c'])
    expect(kinds(rows)).toEqual(['same', 'removed', 'same'])
    expect(rows.filter((row) => row.kind === 'added')).toHaveLength(0)
    expect(rows[1]).toEqual({
      kind: 'removed',
      leftNo: 2,
      rightNo: null,
      leftText: 'b',
      rightText: null,
    })
  })

  test('empty arrays on both sides yield no rows', () => {
    expect(diffLines([], [])).toEqual([])
    expect(pairChanged([])).toEqual([])
    expect(diffRowsToText([])).toBe('')
    expect(diffStats([])).toEqual({ added: 0, removed: 0, changed: 0 })
  })

  test('one empty side yields only added or only removed rows', () => {
    expect(kinds(diffLines([], ['a', 'b']))).toEqual(['added', 'added'])
    expect(kinds(diffLines(['a', 'b'], []))).toEqual(['removed', 'removed'])
    expect(diffLines([], ['a', 'b']).map((row) => row.rightNo)).toEqual([1, 2])
    expect(diffLines(['a', 'b'], []).map((row) => row.leftNo)).toEqual([1, 2])
  })

  test('diffs every row of a 3000-line input without truncating', () => {
    const before = Array.from({ length: 3000 }, (_, index) => `left ${index}`)
    const after = Array.from({ length: 3000 }, (_, index) => `right ${index}`)
    const rows = diffLines(before, after)
    expect(rows).toHaveLength(6000)
    expect(rows.filter((row) => row.kind === 'removed')).toHaveLength(3000)
    expect(rows.filter((row) => row.kind === 'added')).toHaveLength(3000)
    expect(rows[rows.length - 1].rightNo).toBe(3000)
  })

  test('keeps every identical row of a 3000-line input', () => {
    const lines = Array.from({ length: 3000 }, (_, index) => `line ${index}`)
    const rows = diffLines(lines, lines)
    expect(rows).toHaveLength(3000)
    expect(rows.every((row) => row.kind === 'same')).toBe(true)
    expect(rows[rows.length - 1].leftNo).toBe(3000)
  })

  test('reports a single change in a 3000-line input at its real line number', () => {
    const before = Array.from({ length: 3000 }, (_, index) => `  "key_${index}": ${index},`)
    const after = [...before]
    after[1500] = '  "changed": true,'
    const rows = diffLines(before, after)
    expect(rows).toHaveLength(3001)
    const changed = rows.filter((row) => row.kind !== 'same')
    expect(changed).toHaveLength(2)
    expect(changed[0].leftNo).toBe(1501)
    expect(changed[1].rightNo).toBe(1501)
  })

  test('matches the minimal edit distance and reconstructs both sides', () => {
    const random = makeRandom(20261122)
    for (let round = 0; round < 200; round += 1) {
      const before = randomLines(random, Math.floor(random() * 12))
      const after = randomLines(random, Math.floor(random() * 12))
      const rows = diffLines(before, after)
      const edits = rows.filter((row) => row.kind !== 'same')
      expect(edits).toHaveLength(minimalEdits(before, after))
      expect(rows.filter((row) => row.leftNo !== null).map((row) => row.leftText)).toEqual(before)
      expect(rows.filter((row) => row.rightNo !== null).map((row) => row.rightText)).toEqual(after)
      expect(rows.filter((row) => row.leftNo !== null).map((row) => row.leftNo)).toEqual(
        before.map((_, index) => index + 1),
      )
      expect(rows.filter((row) => row.rightNo !== null).map((row) => row.rightNo)).toEqual(
        after.map((_, index) => index + 1),
      )
    }
  })
})

describe('pair changed', () => {
  test('pairs removed and added runs line by line', () => {
    const rows: DiffRow[] = [
      { kind: 'same', leftNo: 1, rightNo: 1, leftText: 'a', rightText: 'a' },
      { kind: 'removed', leftNo: 2, rightNo: null, leftText: 'b', rightText: null },
      { kind: 'removed', leftNo: 3, rightNo: null, leftText: 'c', rightText: null },
      { kind: 'added', leftNo: null, rightNo: 2, leftText: null, rightText: 'B' },
      { kind: 'added', leftNo: null, rightNo: 3, leftText: null, rightText: 'C' },
      { kind: 'same', leftNo: 4, rightNo: 4, leftText: 'd', rightText: 'd' },
    ]
    const paired = pairChanged(rows)
    expect(kinds(paired)).toEqual(['same', 'changed', 'changed', 'same'])
    expect(paired[1]).toEqual({
      kind: 'changed',
      leftNo: 2,
      rightNo: 2,
      leftText: 'b',
      rightText: 'B',
    })
    expect(paired[2]).toEqual({
      kind: 'changed',
      leftNo: 3,
      rightNo: 3,
      leftText: 'c',
      rightText: 'C',
    })
  })

  test('leaves an unpaired removed row as removed when the added run is shorter', () => {
    const rows: DiffRow[] = [
      { kind: 'removed', leftNo: 1, rightNo: null, leftText: 'a', rightText: null },
      { kind: 'removed', leftNo: 2, rightNo: null, leftText: 'b', rightText: null },
      { kind: 'added', leftNo: null, rightNo: 1, leftText: null, rightText: 'A' },
    ]
    const paired = pairChanged(rows)
    expect(kinds(paired)).toEqual(['changed', 'removed'])
    expect(paired[0]).toEqual({
      kind: 'changed',
      leftNo: 1,
      rightNo: 1,
      leftText: 'a',
      rightText: 'A',
    })
    expect(paired[1]).toEqual({
      kind: 'removed',
      leftNo: 2,
      rightNo: null,
      leftText: 'b',
      rightText: null,
    })
  })

  test('leaves an unpaired added row as added when the removed run is shorter', () => {
    const rows: DiffRow[] = [
      { kind: 'added', leftNo: null, rightNo: 1, leftText: null, rightText: 'A' },
      { kind: 'added', leftNo: null, rightNo: 2, leftText: null, rightText: 'B' },
      { kind: 'removed', leftNo: 1, rightNo: null, leftText: 'a', rightText: null },
    ]
    const paired = pairChanged(rows)
    expect(kinds(paired)).toEqual(['added', 'added', 'removed'])
  })

  test('does not pair across a same row', () => {
    const rows: DiffRow[] = [
      { kind: 'removed', leftNo: 1, rightNo: null, leftText: 'a', rightText: null },
      { kind: 'same', leftNo: 2, rightNo: 1, leftText: 'b', rightText: 'b' },
      { kind: 'added', leftNo: null, rightNo: 2, leftText: null, rightText: 'c' },
    ]
    expect(kinds(pairChanged(rows))).toEqual(['removed', 'same', 'added'])
  })
})

describe('diff rows to text', () => {
  test('formats a small mixed diff exactly', () => {
    const rows = pairChanged(diffLines(['a', 'b', 'c'], ['a', 'B', 'c', 'd']))
    expect(diffRowsToText(rows)).toBe('  1 a\n~ 2 b -> B\n  3 c\n+ 4 d')
  })

  test('renders null numbers and null text as empty strings', () => {
    const rows: DiffRow[] = [
      { kind: 'added', leftNo: null, rightNo: 7, leftText: null, rightText: 'x' },
      { kind: 'removed', leftNo: 3, rightNo: null, leftText: 'y', rightText: null },
      { kind: 'changed', leftNo: 4, rightNo: 5, leftText: 'p', rightText: 'q' },
    ]
    expect(diffRowsToText(rows)).toBe('+ 7 x\n- 3 y\n~ 4 p -> q')
    const blank: DiffRow[] = [
      { kind: 'same', leftNo: null, rightNo: null, leftText: null, rightText: null },
    ]
    expect(diffRowsToText(blank)).toBe('   ')
  })
})

describe('diff stats', () => {
  test('counts added, removed and changed rows', () => {
    const rows = pairChanged(diffLines(['a', 'b', 'c', 'd'], ['a', 'B', 'd', 'e']))
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1, changed: 1 })
    expect(diffStats(diffLines(['a'], ['a']))).toEqual({ added: 0, removed: 0, changed: 0 })
    expect(diffStats(diffLines([], ['a', 'b']))).toEqual({ added: 2, removed: 0, changed: 0 })
    expect(diffStats(diffLines(['a', 'b'], []))).toEqual({ added: 0, removed: 2, changed: 0 })
  })
})
