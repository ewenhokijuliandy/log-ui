import { describe, expect, test } from 'vitest'
import {
  clampInspectorWidth,
  defaultInspectorWidth,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from './prefs.ts'

describe('inspector width', () => {
  test('defaults to the design width at desktop and 320 below 1180', () => {
    expect(defaultInspectorWidth(1440)).toBe(356)
    expect(defaultInspectorWidth(1180)).toBe(320)
    expect(defaultInspectorWidth(1024)).toBe(320)
  })

  test('clamps within bounds and keeps room for the log list', () => {
    expect(clampInspectorWidth(100, 1440)).toBe(INSPECTOR_MIN_WIDTH)
    expect(clampInspectorWidth(1000, 1440)).toBe(INSPECTOR_MAX_WIDTH)
    expect(clampInspectorWidth(600, 1000)).toBe(520)
    expect(clampInspectorWidth(Number.NaN, 1440)).toBe(356)
  })

  test('rounds fractional widths', () => {
    expect(clampInspectorWidth(400.6, 1440)).toBe(401)
  })
})
