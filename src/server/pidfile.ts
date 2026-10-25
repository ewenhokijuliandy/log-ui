import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type PidFilePayload = {
  pid: number
  port: number
  version: string
  startedAt: number
}

export function daemonStatePath(stateDir: string, port: number): string {
  return join(stateDir, `daemon-${port}.json`)
}

export async function writePidFile(
  stateDir: string,
  port: number,
  payload: PidFilePayload,
): Promise<void> {
  await mkdir(stateDir, { recursive: true })
  await writeFile(daemonStatePath(stateDir, port), JSON.stringify(payload, null, 2), 'utf8')
}

export async function readPidFile(stateDir: string, port: number): Promise<PidFilePayload | null> {
  try {
    const raw = await readFile(daemonStatePath(stateDir, port), 'utf8')
    const parsed = JSON.parse(raw) as Partial<PidFilePayload>
    if (typeof parsed.pid !== 'number' || typeof parsed.port !== 'number') return null
    return {
      pid: parsed.pid,
      port: parsed.port,
      version: parsed.version ?? '0.0.0',
      startedAt: parsed.startedAt ?? 0,
    }
  } catch {
    return null
  }
}

export async function removePidFile(stateDir: string, port: number): Promise<void> {
  await rm(daemonStatePath(stateDir, port), { force: true })
}
