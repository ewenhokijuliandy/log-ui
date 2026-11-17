import type { Context } from 'hono'

export async function readStreamNameBody(context: Context): Promise<string | null> {
  const raw = await context.req.text()
  if (raw === '') return null
  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const name = (parsed as { name?: unknown } | null)?.name
  if (typeof name !== 'string') return null
  return name
}
