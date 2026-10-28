import { type ChildProcess, type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { once } from 'node:events'
import type { Page } from '@playwright/test'

export const E2E_PORT = Number(process.env.LOGDECK_E2E_PORT ?? 4173)
export const E2E_URL = `http://127.0.0.1:${String(E2E_PORT)}`

export type Pipe = {
  child: ChildProcessWithoutNullStreams
  write: (lines: readonly string[]) => Promise<void>
  end: () => void
  exited: Promise<number | null>
}

export function startPipe(name: string): Pipe {
  const child = spawn(
    process.execPath,
    ['dist/cli.js', '--port', String(E2E_PORT), '--no-open', '--name', name],
    { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] },
  ) as ChildProcessWithoutNullStreams
  child.stdout.resume()
  child.stderr.resume()
  const exited = new Promise<number | null>((resolve) => {
    child.once('close', (code) => resolve(code))
  })
  return {
    child,
    write: async (lines) => {
      if (child.stdin.destroyed) return
      const text = `${lines.join('\n')}\n`
      if (!child.stdin.write(text)) await once(child.stdin, 'drain')
    },
    end: () => {
      if (!child.stdin.destroyed) child.stdin.end()
    },
    exited,
  }
}

export async function clearStreams(): Promise<void> {
  try {
    const response = await fetch(`${E2E_URL}/api/streams`)
    if (!response.ok) return
    const metas = (await response.json()) as Array<{ id: string }>
    await Promise.all(
      metas.map((meta) => fetch(`${E2E_URL}/api/streams/${meta.id}`, { method: 'DELETE' })),
    )
  } catch {}
}

export async function waitForStream(name: string, timeoutMs = 10_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${E2E_URL}/api/streams`)
      if (response.ok) {
        const metas = (await response.json()) as Array<{ name: string }>
        if (metas.some((meta) => meta.name === name)) return
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`stream ${name} did not appear`)
}

export async function waitForHealth(timeoutMs = 10_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${E2E_URL}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('logdeck daemon did not become healthy')
}

export async function shutdownDaemon(): Promise<void> {
  try {
    await fetch(`${E2E_URL}/api/shutdown`, { method: 'POST' })
  } catch {}
}

export function startDaemon(): ChildProcess {
  return spawn(
    process.execPath,
    ['dist/cli.js', '__daemon', '--port', String(E2E_PORT), '--idle-timeout', '0'],
    { cwd: process.cwd(), stdio: 'ignore' },
  )
}

export function line(index: number, level = 'INFO', message = `request ${String(index)}`): string {
  return `2026-10-27T12:00:00.${String(index % 1000).padStart(3, '0')}Z ${level} [e2e] ${message}`
}

export function jsonLine(index: number, trace = '5b8e1f0c9a2d4e7f8b1c3d5e7a'): string {
  return JSON.stringify({
    level: 'error',
    time: '2026-10-27T12:00:00.000Z',
    msg: `payment failed for order ${String(index)}`,
    trace_id: trace,
    order: { id: `ord_${String(index)}`, status: 'declined' },
  })
}

export function watchConsole(page: Page): { problems: string[] } {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return
    problems.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  return { problems }
}

export function unexpectedConsole(problems: readonly string[]): string[] {
  return problems.filter((problem) => {
    return (
      !problem.includes('WebSocket connection to') &&
      !problem.includes('net::ERR_CONNECTION_REFUSED')
    )
  })
}
