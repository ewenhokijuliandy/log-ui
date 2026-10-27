import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createStreamSocket } from './ws-client.ts'

class FakeSocket {
  static instances: FakeSocket[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  open(): void {
    this.readyState = 1
    this.onopen?.()
  }

  close(): void {
    this.readyState = 3
    this.onclose?.()
  }
}

describe('stream socket lifecycle', () => {
  beforeEach(() => {
    FakeSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('window', { location: { protocol: 'http:', host: '127.0.0.1:4173' } })
    vi.stubGlobal('WebSocket', FakeSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('reconnect dials immediately and clears the scheduled backoff', () => {
    const phases: string[] = []
    const socket = createStreamSocket(
      () => {},
      (phase) => phases.push(phase),
    )
    const first = FakeSocket.instances[0]
    expect(first).toBeDefined()
    first?.open()
    expect(phases).toEqual(['connecting', 'connected'])

    first?.close()
    expect(phases).toEqual(['connecting', 'connected', 'reconnecting'])
    vi.advanceTimersByTime(499)
    expect(FakeSocket.instances).toHaveLength(1)

    socket.reconnect()
    expect(FakeSocket.instances).toHaveLength(2)
    expect(phases.at(-1)).toBe('connecting')

    const second = FakeSocket.instances[1]
    second?.open()
    expect(phases.at(-1)).toBe('connected')

    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(2)
  })

  test('reconnect replaces an open socket without a reconnect phase', () => {
    const phases: string[] = []
    const socket = createStreamSocket(
      () => {},
      (phase) => phases.push(phase),
    )
    FakeSocket.instances[0]?.open()
    socket.reconnect()
    expect(FakeSocket.instances).toHaveLength(2)
    expect(phases).toEqual(['connecting', 'connected', 'connecting'])
  })

  test('close stops future dials', () => {
    const socket = createStreamSocket(
      () => {},
      () => {},
    )
    FakeSocket.instances[0]?.close()
    socket.close()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
