export type UptimeUnit = 'just now' | 'minutes' | 'hours' | 'days'

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export function formatUptime(startedAt: number, now: number): string {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 'just now'
  const elapsed = Math.max(0, now - startedAt)
  if (elapsed < MINUTE_MS) return 'just now'
  if (elapsed < HOUR_MS) return `${String(Math.floor(elapsed / MINUTE_MS))}m`
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS)
    return minutes === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(minutes)}m`
  }
  const days = Math.floor(elapsed / DAY_MS)
  const hours = Math.floor((elapsed % DAY_MS) / HOUR_MS)
  return hours === 0 ? `${String(days)}d` : `${String(days)}d ${String(hours)}h`
}
