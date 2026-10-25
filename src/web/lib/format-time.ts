export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function pad3(value: number): string {
  return String(value).padStart(3, '0')
}

export type Zone = 'utc' | 'local'

export function formatClock(ts: number | null, zone: Zone): string {
  if (ts === null) return '-'
  const date = new Date(ts)
  const parts =
    zone === 'utc'
      ? { h: date.getUTCHours(), m: date.getUTCMinutes(), s: date.getUTCSeconds() }
      : { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds() }
  return `${pad2(parts.h)}:${pad2(parts.m)}:${pad2(parts.s)}`
}

export function formatTime(ts: number | null, zone: Zone): string {
  if (ts === null) return '-'
  const date = new Date(ts)
  const millis = zone === 'utc' ? date.getUTCMilliseconds() : date.getMilliseconds()
  return `${formatClock(ts, zone)}.${pad3(millis)}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${String(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function shortId(value: string): string {
  return value.slice(0, 8)
}
