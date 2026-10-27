export function allocateStreamName(existing: readonly string[], prefix = 'log-viewer'): string {
  const taken = new Set(existing)
  let n = 1
  while (taken.has(`${prefix}-${String(n)}`)) n += 1
  return `${prefix}-${String(n)}`
}
