export type LineBatcher = {
  push: (line: string) => void
  flush: () => void
  cancel: () => void
}

export type LineBatcherOptions = {
  flushMs: number
  maxLines: number
  send: (lines: string[]) => void
}

export function createLineBatcher({ flushMs, maxLines, send }: LineBatcherOptions): LineBatcher {
  let batch: string[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearFlushTimer(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function drain(): void {
    clearFlushTimer()
    if (batch.length === 0) return
    const lines = batch
    batch = []
    send(lines)
  }

  function schedule(): void {
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      drain()
    }, flushMs)
  }

  return {
    push: (line) => {
      batch.push(line)
      if (batch.length >= maxLines) {
        drain()
        return
      }
      schedule()
    },
    flush: drain,
    cancel: () => {
      clearFlushTimer()
      batch = []
    },
  }
}
