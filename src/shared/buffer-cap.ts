export const BUFFER_CAP_DEFAULT = 10_000
export const BUFFER_CAP_MIN = 1_000
export const BUFFER_CAP_MAX = 50_000

export function normalizeBufferCap(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isInteger(value)) return null
  if (value < BUFFER_CAP_MIN || value > BUFFER_CAP_MAX) return null
  return value
}
