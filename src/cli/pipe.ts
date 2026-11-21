import { createInterface } from 'node:readline'
import type { DaemonState } from './banner.ts'
import {
  detectBannerColor,
  detectBannerColumns,
  detectBannerUnicode,
  formatStreamBanner,
} from './banner.ts'
import { openBrowser } from './browser.ts'
import { connectIngestSocket } from './ingest-socket.ts'
import { createLineBatcher } from './line-batcher.ts'
import type { CliStatus } from './status.ts'
import { WS_CLOSED, WS_OPEN } from './ws-state.ts'

type StreamCreation = {
  id: string
  name: string
  ingestToken: string
  shouldOpenBrowser: boolean
}

const FLUSH_MS = 50
const FLUSH_LINES = 500
const BACKPRESSURE_BYTES = 4 * 1024 * 1024
const BACKPRESSURE_POLL_MS = 10
const CONNECT_TIMEOUT_MS = 5000
const END_FRAME_DELAY_MS = 30
const WATCHDOG_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createStream(port: number, name: string | null): Promise<StreamCreation> {
  const response = await fetch(`http://127.0.0.1:${port}/api/streams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(name === null ? {} : { name }),
    signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`could not register the stream (HTTP ${String(response.status)})`)
  }
  return (await response.json()) as StreamCreation
}

function ingestUrl(port: number, created: StreamCreation): string {
  return `ws://127.0.0.1:${port}/ingest?stream=${created.id}&token=${created.ingestToken}`
}

export type PipeOptions = {
  port: number
  name: string | null
  openInBrowser: boolean
  status: CliStatus
  daemonState: DaemonState
}

function formatDuration(startedAt: number): string {
  const elapsed = Math.max(0, Date.now() - startedAt)
  const seconds = elapsed / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const totalSeconds = Math.round(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const rest = totalSeconds % 60
  return `${String(minutes)}m ${String(rest)}s`
}

function formatCount(count: number): string {
  return count.toLocaleString('en-US')
}

export async function runPipe(options: PipeOptions): Promise<void> {
  const startedAt = Date.now()
  const created = await createStream(options.port, options.name)
  const ingestSocket = await connectIngestSocket(
    ingestUrl(options.port, created),
    CONNECT_TIMEOUT_MS,
  )

  if (options.status.tty) {
    options.status.block(
      formatStreamBanner({
        name: created.name,
        port: options.port,
        daemonState: options.daemonState,
        columns: detectBannerColumns(),
        unicode: detectBannerUnicode(),
        color: detectBannerColor(),
      }),
    )
  } else {
    options.status.info(
      `streaming "${created.name}" on http://127.0.0.1:${String(options.port)} — Ctrl+C to stop`,
    )
  }

  let running = true
  let lineCount = 0
  let chain = Promise.resolve()
  let watchdog: ReturnType<typeof setInterval> | null = null
  let readline: ReturnType<typeof createInterface> | null = null

  const batcher = createLineBatcher({
    flushMs: FLUSH_MS,
    maxLines: FLUSH_LINES,
    send: (lines) => enqueue(JSON.stringify({ t: 'lines', lines })),
  })

  function stopSocketHandling(): void {
    running = false
    if (watchdog === null) return
    clearInterval(watchdog)
    watchdog = null
  }

  function exitQuietly(): void {
    if (!running) return
    stopSocketHandling()
    batcher.cancel()
    readline?.close()
    process.exit(0)
  }

  function ship(text: string): Promise<void> {
    if (ingestSocket.readyState !== WS_OPEN) return Promise.resolve()
    return (async () => {
      while (
        ingestSocket.readyState === WS_OPEN &&
        ingestSocket.bufferedAmount > BACKPRESSURE_BYTES
      ) {
        await sleep(BACKPRESSURE_POLL_MS)
      }
      if (ingestSocket.readyState === WS_OPEN) ingestSocket.send(text)
    })()
  }

  function enqueue(text: string): void {
    chain = chain.then(() => ship(text))
  }

  function finish(exitCode: number): void {
    if (!running) return
    stopSocketHandling()
    readline?.close()
    batcher.flush()
    chain = chain.then(async () => {
      if (ingestSocket.readyState === WS_OPEN) ingestSocket.send(JSON.stringify({ t: 'end' }))
      ingestSocket.close(1000)
      await sleep(END_FRAME_DELAY_MS)
      options.status.info(
        `"${created.name}" ended — ${formatCount(lineCount)} lines sent in ${formatDuration(startedAt)}`,
      )
      process.exit(exitCode)
    })
  }

  ingestSocket.addEventListener('close', () => {
    if (running) exitQuietly()
  })
  ingestSocket.addEventListener('error', () => {
    if (running) exitQuietly()
  })

  readline = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  })

  readline.on('line', (line) => {
    if (!running) return
    lineCount += 1
    batcher.push(line)
  })

  readline.on('close', () => finish(0))
  process.stdin.on('error', () => finish(0))
  process.on('SIGINT', () => finish(0))

  watchdog = setInterval(() => {
    if (running && ingestSocket.readyState === WS_CLOSED) exitQuietly()
  }, WATCHDOG_MS)

  if (created.shouldOpenBrowser && options.openInBrowser) {
    await openBrowser(`http://127.0.0.1:${options.port}`)
  }

  await chain
}
