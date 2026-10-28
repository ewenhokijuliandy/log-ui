import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '../server/index.ts'
import { type PidFilePayload, readPidFile, removePidFile, writePidFile } from '../server/pidfile.ts'
import { readVersion } from '../server/version.ts'

export const DEFAULT_PORT = 3333
export const DEFAULT_STATE_DIR = join(homedir(), '.logdeck')
const READY_WAIT_MS = 3000
const PROBE_TIMEOUT_MS = 600

export type HealthPayload = {
  ok: boolean
  pid: number
  version: string
  startedAt: number
  port: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function probeHealth(port: number): Promise<HealthPayload | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!response.ok) return null
    return (await response.json()) as HealthPayload
  } catch {
    return null
  }
}

export function cliScriptPath(): string {
  const executable = process.argv[1]
  if (executable !== undefined) return executable
  return fileURLToPath(new URL('../../dist/cli.js', import.meta.url))
}

export async function ensureDaemon(port: number): Promise<HealthPayload> {
  const existing = await probeHealth(port)
  if (existing !== null) {
    const ours = readVersion()
    if (existing.version !== ours) {
      process.stderr.write(
        `logdeck: daemon on port ${port} is v${existing.version} while the CLI is v${ours} — run "logdeck stop" to refresh\n`,
      )
    }
    return existing
  }

  spawn(process.execPath, [cliScriptPath(), '__daemon', `--port=${String(port)}`], {
    detached: true,
    stdio: 'ignore',
  }).unref()

  const deadline = Date.now() + READY_WAIT_MS
  for (;;) {
    const health = await probeHealth(port)
    if (health !== null) return health
    if (Date.now() > deadline) {
      throw new Error(
        `daemon failed to start on port ${port} — is another process holding the port?`,
      )
    }
    await sleep(100)
  }
}

export async function stopDaemon(port: number, stateDir: string): Promise<void> {
  const health = await probeHealth(port)
  if (health === null) {
    const stale = await readPidFile(stateDir, port)
    if (stale !== null) {
      await removePidFile(stateDir, port)
      throw new Error(`no daemon is listening on port ${port} — stale state file removed`)
    }
    throw new Error(`no logdeck daemon on port ${port}`)
  }

  const response = await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: 'POST' })
  if (!response.ok) throw new Error(`shutdown failed with HTTP ${String(response.status)}`)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const stillUp = await probeHealth(port)
    if (stillUp === null) return
    await sleep(50)
  }
}

export async function runDaemon(
  port: number,
  idleMinutes: number,
  stateDir: string,
  exit: (code: number) => void,
): Promise<void> {
  let exitCode: number | null = null

  const finalize = async (code: number): Promise<void> => {
    if (exitCode !== null) return
    exitCode = code
    await removePidFile(stateDir, port).catch(() => undefined)
    exit(code)
  }

  try {
    const server = await startServer({
      port,
      idleTimeoutMs: Math.max(0, Math.round(idleMinutes * 60_000)),
      onExit: (code) => {
        void finalize(code)
      },
    })

    const payload: PidFilePayload = {
      pid: process.pid,
      port: server.port,
      version: readVersion(),
      startedAt: Date.now(),
    }
    await writePidFile(stateDir, port, payload)

    const requestShutdown = () => server.shutdown()
    process.on('SIGINT', requestShutdown)
    process.on('SIGTERM', requestShutdown)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`logdeck: ${message}\n`)
    exit(1)
  }
}
