const INGEST_PORT_PATTERN = /^wss?:\/\/[^/:]+:(\d+)/

function ingestPort(url: string): string {
  return INGEST_PORT_PATTERN.exec(url)?.[1] ?? url
}

export function connectIngestSocket(url: string, timeoutMs: number): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const ingestSocket = new WebSocket(url)
    let opened = false
    const connectTimeout = setTimeout(() => {
      reject(new Error(`daemon did not accept the stream on port ${ingestPort(url)}`))
    }, timeoutMs)

    ingestSocket.addEventListener(
      'open',
      () => {
        opened = true
        clearTimeout(connectTimeout)
        resolve(ingestSocket)
      },
      { once: true },
    )

    ingestSocket.addEventListener('error', () => {
      if (opened) return
      clearTimeout(connectTimeout)
      reject(new Error('could not connect to the logdeck daemon'))
    })
  })
}
