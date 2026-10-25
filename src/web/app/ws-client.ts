export type ServerEvent = {
  type: string
  [key: string]: unknown
}

export type ConnectionPhase = 'connecting' | 'connected' | 'reconnecting'

const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 15_000

export function socketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws`
}

export function createStreamSocket(
  onEvent: (event: ServerEvent) => void,
  onPhase: (phase: ConnectionPhase) => void,
): { close: () => void } {
  let socket: WebSocket | null = null
  let stopped = false
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const connect = (): void => {
    if (stopped) return
    onPhase('connecting')
    const ws = new WebSocket(socketUrl())
    socket = ws

    ws.onopen = () => {
      attempt = 0
      onPhase('connected')
    }

    ws.onmessage = (message: MessageEvent) => {
      if (typeof message.data !== 'string') return
      let parsed: unknown = null
      try {
        parsed = JSON.parse(message.data)
      } catch {
        return
      }
      if (parsed === null || typeof parsed !== 'object') return
      onEvent(parsed as ServerEvent)
    }

    ws.onclose = () => {
      socket = null
      if (stopped) return
      onPhase('reconnecting')
      const backoff = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
      const jitter = Math.floor(Math.random() * 250)
      attempt += 1
      timer = setTimeout(connect, backoff + jitter)
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  connect()

  return {
    close: () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      if (socket !== null) socket.close()
    },
  }
}
