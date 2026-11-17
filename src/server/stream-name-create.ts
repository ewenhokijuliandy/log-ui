import { allocateStreamName } from '../shared/name-allocator.ts'
import { MAX_STREAM_NAME } from '../shared/stream-name.ts'

function withSuffix(base: string, suffix: number): string {
  const marker = ` (${String(suffix)})`
  const room = MAX_STREAM_NAME - marker.length
  return `${base.slice(0, room)}${marker}`
}

function uniqueName(base: string, taken: readonly string[]): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(withSuffix(base, suffix))) suffix += 1
  return withSuffix(base, suffix)
}

export function resolveCreatedName(requested: string | null, taken: readonly string[]): string {
  const clean = requested?.trim() ?? ''
  if (clean.length === 0) return allocateStreamName(taken)
  return uniqueName(clean.slice(0, MAX_STREAM_NAME), taken)
}
