export function allocateStreamName(existing: readonly string[], prefix = 'log-viewer'): string {
  const taken = new Set(existing)
  let suffix = 1
  while (taken.has(`${prefix}-${String(suffix)}`)) suffix += 1
  return `${prefix}-${String(suffix)}`
}
