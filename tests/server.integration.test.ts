import { request as httpRequest, type IncomingMessage } from 'node:http'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type StartedServer, startServer } from '../src/server/index'

type RestFetch = { status: number; text: string }

const spawned: StartedServer[] = []

afterEach(async () => {
  const servers = spawned.splice(0)
  await Promise.all(servers.map((entry) => entry.close()))
})

async function boot(options?: { idleTimeoutMs?: number }): Promise<StartedServer> {
  const exits: number[] = []
  const server = await startServer({
    port: 0,
    idleTimeoutMs: options?.idleTimeoutMs ?? 0,
    onExit: (code) => exits.push(code),
    webRoot: '/nonexistent-web-root',
  })
  spawned.push(server)
  void exits
  return server
}

function fetchJson(
  server: StartedServer,
  path: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<RestFetch> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port: server.port,
        path,
        method: init?.method ?? 'GET',
        headers: init?.headers,
      },
      (response: IncomingMessage) => {
        let raw = ''
        response.on('data', (chunk) => {
          raw += String(chunk)
        })
        response.on('end', () => resolve({ status: response.statusCode ?? 0, text: raw }))
      },
    )
    req.on('error', reject)
    if (init?.body !== undefined) req.write(init.body)
    req.end()
  })
}

async function createStream(
  server: StartedServer,
  name: string | null,
): Promise<{ id: string; name: string; ingestToken: string; shouldOpenBrowser: boolean }> {
  const body = name === null ? '' : JSON.stringify({ name })
  const res = await fetchJson(server, '/api/streams', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  })
  return JSON.parse(res.text) as {
    id: string
    name: string
    ingestToken: string
    shouldOpenBrowser: boolean
  }
}

type SnapshotResult = {
  records: Array<Record<string, unknown>>
  dropped: number
  firstSeq: number | null
  lastSeq: number | null
  gap: boolean
  status: string
}

async function snapshot(
  server: StartedServer,
  id: string,
  since?: number,
): Promise<SnapshotResult> {
  const suffix = since === undefined ? '' : `?since=${String(since)}`
  const res = await fetchJson(server, `/api/streams/${id}/logs${suffix}`)
  return JSON.parse(res.text) as SnapshotResult
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function openSocket(socket: WebSocket): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(socket), { once: true })
    socket.addEventListener('error', () => reject(new Error('socket failed to open')), {
      once: true,
    })
  })
}

function closeInfo(socket: WebSocket, timeoutMs = 4000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('close timeout')), timeoutMs)
    socket.addEventListener(
      'close',
      (event) => {
        clearTimeout(timer)
        resolve({ code: event.code, reason: event.reason })
      },
      { once: true },
    )
  })
}

type ServerEvent = { type: string; [key: string]: unknown }

function messageQueue(socket: WebSocket): { next: (timeoutMs?: number) => Promise<ServerEvent> } {
  const pending: string[] = []
  const waiters: Array<(value: string) => void> = []

  socket.addEventListener('message', (event: MessageEvent) => {
    const text = typeof event.data === 'string' ? event.data : ''
    const waiter = waiters.shift()
    if (waiter !== undefined) waiter(text)
    else pending.push(text)
  })

  return {
    next: (timeoutMs = 4000) =>
      new Promise((resolve, reject) => {
        const found = pending.shift()
        if (found !== undefined) return resolve(JSON.parse(found) as ServerEvent)
        waiters.push((value) => resolve(JSON.parse(value) as ServerEvent))
        setTimeout(() => reject(new Error('message timeout')), timeoutMs)
      }),
  }
}

function makeLines(from: number, count: number): string[] {
  const lines: string[] = []
  for (let i = 0; i < count; i += 1) {
    lines.push(
      `2026-10-25 11:47:03,${String(100 + (i % 800)).padStart(3, '0')} INFO perf line ${from + i} {"k":${i}}`,
    )
  }
  return lines
}

async function sendLines(socket: WebSocket, lines: string[]): Promise<void> {
  socket.send(JSON.stringify({ t: 'lines', lines }))
  await sleep(2)
}

async function waitForDepth(server: StartedServer, id: string, count: number): Promise<void> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const result = await snapshot(server, id)
    if (result.records.length >= count) return
    await sleep(20)
  }
  throw new Error('buffer depth not reached')
}

async function waitForMessage(
  queue: ReturnType<typeof messageQueue>,
  type: string,
): Promise<ServerEvent> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const event = await queue.next(3000)
    if (event.type === type) return event
  }
  throw new Error(`no ${type} event`)
}

describe('daemon server', () => {
  test('health reports pid, version and resolved port', async () => {
    const server = await boot()
    const res = await fetchJson(server, '/api/health')
    expect(res.status).toBe(200)
    const info = JSON.parse(res.text) as Record<string, unknown>
    expect(info.ok).toBe(true)
    expect(info.pid).toBe(process.pid)
    expect(info.version).toBe('1.0.0')
    expect(info.port).toBe(server.port)
  })

  test('12k ingest yields 10k retained with dropped count and gap policy', async () => {
    const server = await boot()
    const created = await createStream(server, 'perf-stream')
    expect(created.name).toBe('perf-stream')
    expect(created.shouldOpenBrowser).toBe(true)

    const ingest = await openSocket(
      new WebSocket(
        `ws://127.0.0.1:${server.port}/ingest?stream=${created.id}&token=${created.ingestToken}`,
      ),
    )
    for (let chunk = 0; chunk < 12; chunk += 1) {
      await sendLines(ingest, makeLines(chunk * 1000, 1000))
    }
    await waitForDepth(server, created.id, 10_000)

    const full = await snapshot(server, created.id)
    expect(full.records.length).toBe(10_000)
    expect(full.dropped).toBe(2000)
    expect(full.gap).toBe(false)
    expect(full.firstSeq).toBe(2001)
    expect(full.lastSeq).toBe(12_000)
    expect(full.status).toBe('active')

    const gapped = await snapshot(server, created.id, 0)
    expect(gapped.gap).toBe(true)
    expect(gapped.records.length).toBe(10_000)

    const delta = await snapshot(server, created.id, 11_500)
    expect(delta.gap).toBe(false)
    expect(delta.records.length).toBe(500)
    expect(delta.firstSeq).toBe(2001)
    expect(delta.lastSeq).toBe(12_000)
    expect(delta.records[0]?.seq).toBe(11_501)
  })

  test('browser events: created, appended, updated on end', async () => {
    const server = await boot()
    const browser = await openSocket(new WebSocket(`ws://127.0.0.1:${server.port}/ws`))
    const events = messageQueue(browser)

    const created = await createStream(server, null)
    const first = await events.next()
    expect(first.type).toBe('stream:created')
    expect(first.meta).toMatchObject({ id: created.id, name: 'log-viewer-1', status: 'active' })

    const info = await createStream(server, 'worker')
    const ingested = await openSocket(
      new WebSocket(
        `ws://127.0.0.1:${server.port}/ingest?stream=${info.id}&token=${info.ingestToken}`,
      ),
    )
    await sendLines(ingested, makeLines(0, 5))

    const appended = await waitForMessage(events, 'logs:appended')
    expect(appended.streamId).toBe(info.id)
    expect(Array.isArray(appended.records)).toBe(true)

    ingested.send(JSON.stringify({ t: 'end' }))
    const updated = await waitForMessage(events, 'stream:updated')
    expect(updated.payload).toMatchObject({ id: info.id, status: 'stopped' })
  })

  test('clear empties the buffer and drops counters', async () => {
    const server = await boot()
    const meta = await createStream(server, 'clearme')
    const ingest = await openSocket(
      new WebSocket(
        `ws://127.0.0.1:${server.port}/ingest?stream=${meta.id}&token=${meta.ingestToken}`,
      ),
    )
    await sendLines(ingest, makeLines(0, 10))
    await waitForDepth(server, meta.id, 10)

    const clear = await fetchJson(server, `/api/streams/${meta.id}/clear`, { method: 'POST' })
    expect(clear.status).toBe(200)
    const after = await snapshot(server, meta.id)
    expect(after.records.length).toBe(0)
    expect(after.firstSeq).toBeNull()
    expect(after.dropped).toBe(0)
  })

  test('delete removes the stream and closes the ingest socket', async () => {
    const server = await boot()
    const meta = await createStream(server, 'deleteme')
    const ingest = await openSocket(
      new WebSocket(
        `ws://127.0.0.1:${server.port}/ingest?stream=${meta.id}&token=${meta.ingestToken}`,
      ),
    )
    await sendLines(ingest, makeLines(0, 3))

    const removed = await fetchJson(server, `/api/streams/${meta.id}`, { method: 'DELETE' })
    expect(removed.status).toBe(204)

    const closed = await closeInfo(ingest)
    expect(closed.code).toBe(1000)

    const listing = await fetchJson(server, '/api/streams')
    expect(listing.text).toBe('[]')
    const gone = await fetchJson(server, `/api/streams/${meta.id}/logs`)
    expect(gone.status).toBe(404)
  })

  test('ingest rejects invalid tokens and unknown streams', async () => {
    const server = await boot()
    const unknown = await closeInfo(
      new WebSocket(`ws://127.0.0.1:${server.port}/ingest?stream=does-not-exist&token=wrong`),
    )
    expect(unknown.code).toBe(1008)

    const meta = await createStream(server, null)
    const badToken = await closeInfo(
      new WebSocket(`ws://127.0.0.1:${server.port}/ingest?stream=${meta.id}&token=not-the-token`),
    )
    expect(badToken.code).toBe(1008)
  })

  test('mutating routes reject forged host and origin headers', async () => {
    const server = await boot()
    const forgedHost = await fetchJson(server, '/api/streams', {
      method: 'POST',
      body: '',
      headers: { host: 'evil.example:4444' },
    })
    expect(forgedHost.status).toBe(403)

    const forgedOrigin = await fetchJson(server, '/api/shutdown', {
      method: 'POST',
      headers: { origin: 'http://evil.example:1' },
    })
    expect(forgedOrigin.status).toBe(403)
  })

  test('end keeps the snapshot with stopped status', async () => {
    const server = await boot()
    const meta = await createStream(server, 'stopme')
    const ingest = await openSocket(
      new WebSocket(
        `ws://127.0.0.1:${server.port}/ingest?stream=${meta.id}&token=${meta.ingestToken}`,
      ),
    )
    await sendLines(ingest, makeLines(0, 3))
    await waitForDepth(server, meta.id, 3)

    ingest.send(JSON.stringify({ t: 'end' }))
    await closeInfo(ingest)

    const state = await snapshot(server, meta.id)
    expect(state.status).toBe('stopped')
  })

  test('rename persists, broadcasts and rejects duplicates', async () => {
    const server = await boot()
    const browser = await openSocket(new WebSocket(`ws://127.0.0.1:${server.port}/ws`))
    const events = messageQueue(browser)
    const first = await createStream(server, 'api')
    const second = await createStream(server, 'worker')

    const renamed = await fetchJson(server, `/api/streams/${first.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '  orders  ' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(renamed.status).toBe(200)
    expect(JSON.parse(renamed.text)).toMatchObject({ id: first.id, name: 'orders' })

    const event = await waitForMessage(events, 'stream:updated')
    expect(event.payload).toMatchObject({ id: first.id, name: 'orders' })

    const listing = await fetchJson(server, '/api/streams')
    const metas = JSON.parse(listing.text) as Array<{ id: string; name: string }>
    expect(metas.find((meta) => meta.id === first.id)?.name).toBe('orders')

    const duplicate = await fetchJson(server, `/api/streams/${second.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'orders' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(duplicate.status).toBe(409)

    const empty = await fetchJson(server, `/api/streams/${second.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(empty.status).toBe(400)

    const long = await fetchJson(server, `/api/streams/${second.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x'.repeat(65) }),
      headers: { 'content-type': 'application/json' },
    })
    expect(long.status).toBe(400)

    const missing = await fetchJson(server, '/api/streams/does-not-exist', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'ghost' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(missing.status).toBe(404)
  })

  test('shutdown endpoint exits with code 0 under a second', async () => {
    const exits: number[] = []
    const server = await startServer({
      port: 0,
      idleTimeoutMs: 0,
      onExit: (code) => exits.push(code),
      webRoot: '/nonexistent-web-root',
    })
    spawned.push(server)

    const started = performance.now()
    const res = await fetchJson(server, '/api/shutdown', { method: 'POST' })
    expect(res.status).toBe(204)
    await vi.waitFor(() => expect(exits.length).toBe(1), { timeout: 2000, interval: 20 })
    expect(exits[0]).toBe(0)
    expect(performance.now() - started).toBeLessThan(1000)
  })

  test('idle exit fires when no streams and no browsers', async () => {
    const exits: number[] = []
    const server = await startServer({
      port: 0,
      idleTimeoutMs: 120,
      onExit: (code) => exits.push(code),
      webRoot: '/nonexistent-web-root',
    })
    spawned.push(server)

    await vi.waitFor(() => expect(exits.length).toBe(1), { timeout: 3000, interval: 40 })
    expect(exits[0]).toBe(0)
  })

  test('idle exit does not fire while a stream is active', async () => {
    const exits: number[] = []
    const server = await startServer({
      port: 0,
      idleTimeoutMs: 100,
      onExit: (code) => exits.push(code),
      webRoot: '/nonexistent-web-root',
    })
    spawned.push(server)

    const meta = await createStream(server, 'busy')
    const ingest = await openSocket(
      new WebSocket(
        `ws://127.0.0.1:${server.port}/ingest?stream=${meta.id}&token=${meta.ingestToken}`,
      ),
    )
    await sleep(240)
    expect(exits.length).toBe(0)

    ingest.close(1000)
    await closeInfo(ingest)
    await vi.waitFor(() => expect(exits.length).toBe(1), { timeout: 3000, interval: 40 })
    expect(exits[0]).toBe(0)
  })
})
