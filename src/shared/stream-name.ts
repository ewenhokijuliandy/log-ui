export const MAX_STREAM_NAME = 64

export type StreamNameProblem = {
  kind: 'empty' | 'long' | 'duplicate'
  message: string
}

export function streamNameProblem(
  name: string,
  existing: readonly string[],
): StreamNameProblem | null {
  if (name.length === 0) return { kind: 'empty', message: 'Name cannot be empty.' }
  if (name.length > MAX_STREAM_NAME) {
    return { kind: 'long', message: `Name must be ${String(MAX_STREAM_NAME)} characters or fewer.` }
  }
  if (existing.includes(name)) return { kind: 'duplicate', message: 'Name already in use.' }
  return null
}
