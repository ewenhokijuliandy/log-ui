import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { existsSync, openSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { DEFAULT_STATE_DIR } from '../src/cli/daemon'

const CLI_PATH = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url))
const PID_DIR = DEFAULT_STATE_DIR

type StreamMeta = { id: string; name: string; status: string }
type Snapshot = {
  records: Array<Record<string, unknown>>
  dropped: number
  firstSeq: number | null
  lastSeq: number | null
  gap: boolean
  status: string
}

const children: ChildProcessWithoutNullStreams[] = []

afterEach(async () => {
  const list = children.splice(0)
  for (const child of list) child.kill('SIGKILL')
})

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

type Exit = { code: number | null; stdout: string; stderr: string }

const exitRecords = new WeakMap<ChildProcessWithoutNullStreams, Promise<Exit>>()

function spawnCli(args: string[], stderrTo?: string): ChildProcessWithoutNullStreams {
  const stdio: Array<'pipe' | number> = ['pipe', 'pipe', 'pipe']
  if (stderrTo !== undefined) {
    stdio[2] = openSync(stderrTo, 'w')
  }
  const child = spawn(process.execPath, [CLI_PATH, '--no-open', ...args], {
    stdio,
  }) as ChildProcessWithoutNullStreams
  children.push(child)

  let stdout = ''
  let stderr = ''
  let rejectRecord: ((error: Error) => void) | null = null
  child.stdout?.on('data', (chunk) => {
    stdout += String(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk)
  })
  const record = new Promise<Exit>((resolve, reject) => {
    rejectRecord = reject
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
  child.on('error', (error) => {
    rejectRecord?.(error instanceof Error ? error : new Error(String(error)))
  })
  exitRecords.set(child, record)
  return child
}

function collect(child: ChildProcessWithoutNullStreams, timeoutMs = 8000): Promise<Exit> {
  const record = exitRecords.get(child)
  if (record === undefined) throw new Error('collect: child was not spawned through spawnCli')
  return new Promise<Exit>((resolve, reject) => {
    let finished = false
    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      reject(new Error(`collect timeout: child exit pending`))
    }, timeoutMs)
    record.then(
      (value) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

async function getJson(path: string, port: number): Promise<unknown> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(2000),
  })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)} from ${path}`)
  return (await response.json()) as unknown
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function streamMeta(port: number, wantedCount: number): Promise<StreamMeta[]> {
  const deadline = Date.now() + 8000
  for (;;) {
    let streams: unknown = []
    try {
      streams = await getJson('/api/streams', port)
    } catch {
      streams = []
    }
    if (Array.isArray(streams) && streams.length >= wantedCount) return streams as StreamMeta[]
    if (Date.now() > deadline) throw new Error('streams did not appear in time')
    await sleep(80)
  }
}

async function waitForDepth(port: number, id: string, depth: number): Promise<Snapshot> {
  const deadline = Date.now() + 8000
  for (;;) {
    let snapshot: Snapshot | null = null
    try {
      snapshot = (await getJson(`/api/streams/${id}/logs`, port)) as Snapshot
    } catch {
      snapshot = null
    }
    if (snapshot !== null && snapshot.records.length >= depth) return snapshot
    if (Date.now() > deadline) throw new Error(`buffer depth ${depth} never reached`)
    await sleep(60)
  }
}

function makeLines(count: number): string {
  const lines: string[] = []
  for (let i = 0; i < count; i += 1) {
    lines.push(`2026-10-25 15:24:0${String(i % 10)},112 INFO perf line ${i} {"n":${i}}`)
  }
  return `${lines.join('\n')}\n`
}

function pidFileFor(port: number): string {
  return join(PID_DIR, `daemon-${port}.json`)
}

describe('log-ui cli', () => {
  test('piped stdin streams into the daemon and exits 0 on EOF', async () => {
    const port = await pickFreePort()
    const cli = spawnCli([`--port=${String(port)}`, '--name=api'])

    const [entry] = await streamMeta(port, 1)
    expect(entry.name).toBe('api')
    expect(entry.status).toBe('active')

    cli.stdin.write(makeLines(400))
    await sleep(120)
    cli.stdin.write(makeLines(100))
    await waitForDepth(port, entry.id, 500)

    const snapshot = await waitForDepth(port, entry.id, 500)
    expect(snapshot.status).toBe('active')
    expect(snapshot.gap).toBe(false)

    cli.stdin.end()
    const exit = await collect(cli)
    expect(exit.code).toBe(0)

    const finished = (await getJson(`/api/streams/${entry.id}/logs`, port)) as Snapshot
    expect(finished.status).toBe('stopped')
    expect(finished.records.length).toBe(500)
    expect(pidFileFor(port) ? existsSync(pidFileFor(port)) : true).toBe(true)
  })

  test('two concurrent pipes get unique default names', async () => {
    const port = await pickFreePort()
    const first = spawnCli([`--port=${String(port)}`])
    const second = spawnCli([`--port=${String(port)}`])

    const entries = await streamMeta(port, 2)
    const names = entries.map((item) => item.name)
    expect(new Set(names).size).toBe(2)
    expect(names).toContain('log-viewer-1')
    expect(names).toContain('log-viewer-2')

    first.stdin.end()
    second.stdin.end()
    await Promise.all([collect(first), collect(second)])
  })

  test('stop shuts the daemon down and removes the pidfile', async () => {
    const port = await pickFreePort()
    const cli = spawnCli([`--port=${String(port)}`])
    await streamMeta(port, 1)

    const stopper = spawnCli(['stop', `--port=${String(port)}`])
    const stopExit = await collect(stopper)
    console.log('stage: stopper exit', stopExit.code, JSON.stringify(stopExit.stdout))
    expect(stopExit.code).toBe(0)
    expect(stopExit.stdout.includes('daemon stopped')).toBe(true)

    let failed = false
    try {
      await getJson('/api/health', port)
    } catch {
      failed = true
    }
    console.log('stage: health check done failed=', String(failed))
    expect(failed).toBe(true)
    expect(existsSync(pidFileFor(port))).toBe(false)

    const streamExit = await collect(cli)
    console.log('stage: stream exit', streamExit.code, JSON.stringify(streamExit.stderr))
    expect(streamExit.code).toBe(0)
  })

  test('SIGINT stops the stream with records intact', async () => {
    const port = await pickFreePort()
    const cli = spawnCli([`--port=${String(port)}`, '--name=bootstrap'])

    const [entry] = await streamMeta(port, 1)
    cli.stdin.write(makeLines(200))
    await waitForDepth(port, entry.id, 200)

    cli.kill('SIGINT')
    const exit = await collect(cli)
    expect(exit.code).toBe(0)

    const snapshot = (await getJson(`/api/streams/${entry.id}/logs`, port)) as Snapshot
    expect(snapshot.status).toBe('stopped')
    expect(snapshot.records.length).toBe(200)
  })
})
