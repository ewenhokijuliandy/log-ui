import { createInterface } from 'node:readline'
import { openBrowser } from './browser.ts'

type StreamCreation = {
  id: string
  name: string
  ingestToken: string
  shouldOpenBrowser: boolean
}

const FLUSH_MS = 50
const FLUSH_LINES = 500
const BACKPRESSURE_BYTES = 4 * 1024 * 1024
const CONNECT_TIMEOUT_MS = 5000
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

export type PipeOptions = {
  port: number
  name: string | null
  openInBrowser: boolean
}

export async function runPipe(options: PipeOptions): Promise<void> {
  const created = await createStream(options.port, options.name)

  const rest = new WebSocket(
    `ws://127.0.0.1:${options.port}/ingest?stream=${created.id}&token=${created.ingestToken}`,
  )

  let opened = false
  let running = true
  let connectedResolve: (() => void) | null = null
  let connectedReject: ((error: Error) => void) | null = null
  const connected = new Promise<void>((resolve, reject) => {
    connectedResolve = resolve
    connectedReject = reject
  })
  const guard = setTimeout(() => {
    connectedReject?.(new Error(`daemon did not accept the stream on port ${options.port}`))
  }, CONNECT_TIMEOUT_MS)

  let readline: ReturnType<typeof createInterface> | null = null
  let watchdog: ReturnType<typeof setInterval> | null = null

  function stopSocketHandling(): void {
    running = false
    if (watchdog !== null) {
      clearInterval(watchdog)
      watchdog = null
    }
  }

  function exitQuietly(): void {
    if (!running) return
    stopSocketHandling()
    readline?.close()
    process.exit(0)
  }

  const openFuture = new Promise<void>((resolve, reject) => {
    rest.addEventListener(
      'open',
      () => {
        opened = true
        resolve()
      },
      { once: true },
    )
    rest.addEventListener('error', () => {
      if (opened) {
        exitQuietly()
        return
      }
      clearTimeout(guard)
      reject(new Error('could not connect to the log-ui daemon'))
    })
    rest.addEventListener('close', () => {
      if (opened) exitQuietly()
    })
  })

  void openFuture.then(() => {
    clearTimeout(guard)
    connectedResolve?.()
  })
  void openFuture.catch((error) => {
    connectedReject?.(error instanceof Error ? error : new Error(String(error)))
  })

  await connected
  connectedReject = null

  let chain = Promise.resolve()
  let batch: string[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function ship(text: string): Promise<void> {
    if (rest.readyState !== 1) return Promise.resolve()
    return (async () => {
      while (rest.readyState === 1 && rest.bufferedAmount > BACKPRESSURE_BYTES) await sleep(10)
      if (rest.readyState === 1) rest.send(text)
    })()
  }

  function enqueue(text: string): void {
    chain = chain.then(() => ship(text))
  }

  function drain(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (batch.length === 0) return
    const lines = batch
    batch = []
    enqueue(JSON.stringify({ t: 'lines', lines }))
  }

  function schedule(): void {
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      drain()
    }, FLUSH_MS)
  }

  function finish(exitCode: number): void {
    if (!running) return
    stopSocketHandling()
    readline?.close()
    drain()
    chain = chain.then(async () => {
      if (rest.readyState === 1) rest.send(JSON.stringify({ t: 'end' }))
      rest.close(1000)
      await sleep(30)
      process.exit(exitCode)
    })
  }

  readline = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  })

  readline.on('line', (line) => {
    if (!running) return
    batch.push(line)
    if (batch.length >= FLUSH_LINES) drain()
    else schedule()
  })

  readline.on('close', () => finish(0))
  process.stdin.on('error', () => finish(0))
  process.on('SIGINT', () => finish(0))

  watchdog = setInterval(() => {
    if (running && rest.readyState === 3) exitQuietly()
  }, WATCHDOG_MS)

  if (created.shouldOpenBrowser && options.openInBrowser) {
    await openBrowser(`http://127.0.0.1:${options.port}`)
  }

  await chain
}
