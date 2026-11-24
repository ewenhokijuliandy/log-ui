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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayIndex(ts: number, zone: Zone): number {
  const date = new Date(ts)
  const year = zone === 'utc' ? date.getUTCFullYear() : date.getFullYear()
  const month = zone === 'utc' ? date.getUTCMonth() : date.getMonth()
  const day = zone === 'utc' ? date.getUTCDate() : date.getDate()
  return Math.floor(Date.UTC(year, month, day) / 86_400_000)
}

export function formatSavedAt(ts: number | null, zone: Zone, now = Date.now()): string {
  if (ts === null) return '-'
  const date = new Date(ts)
  const hours = zone === 'utc' ? date.getUTCHours() : date.getHours()
  const minutes = zone === 'utc' ? date.getUTCMinutes() : date.getMinutes()
  const clock = `${pad2(hours)}:${pad2(minutes)}`
  const day = dayIndex(ts, zone)
  const today = dayIndex(now, zone)
  if (day === today) return `Today ${clock}`
  if (day === today - 1) return `Yesterday ${clock}`
  const month = MONTHS[zone === 'utc' ? date.getUTCMonth() : date.getMonth()] ?? 'Jan'
  const dayOfMonth = zone === 'utc' ? date.getUTCDate() : date.getDate()
  const year = zone === 'utc' ? date.getUTCFullYear() : date.getFullYear()
  const thisYear = zone === 'utc' ? new Date(now).getUTCFullYear() : new Date(now).getFullYear()
  if (year === thisYear) return `${dayOfMonth} ${month} ${clock}`
  return `${dayOfMonth} ${month} ${year}`
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
