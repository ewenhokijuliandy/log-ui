export function allocateStreamName(existing: readonly string[], prefix = 'log-viewer'): string {
  const taken = new Set(existing)
  let suffix = 1
  while (taken.has(`${prefix}-${String(suffix)}`)) suffix += 1
  return `${prefix}-${String(suffix)}`
}

export function uniqueStreamName(existing: readonly string[], preferred: string): string {
  const taken = new Set(existing)
  if (!taken.has(preferred)) return preferred
  let suffix = 2
  while (taken.has(`${preferred}-${String(suffix)}`)) suffix += 1
  return `${preferred}-${String(suffix)}`
}
