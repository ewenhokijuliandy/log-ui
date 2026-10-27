import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import open from 'open'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'dist/cli.js')
const generator = resolve(root, 'scripts/generate-logs.mjs')
const port = Number(process.env.PORT ?? 3334)
const base = `http://127.0.0.1:${String(port)}`
const shouldOpen = !process.argv.includes('--no-open')

if (!existsSync(cli) || !existsSync(resolve(root, 'dist/web/index.html'))) {
  console.error('dist/cli.js or dist/web is missing. Run `npm run build` first.')
  process.exit(1)
}

const children = new Set()
let daemon = null
let stopping = false

async function healthy() {
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })
    return response.ok
  } catch {
    return false
  }
}

function launch(name, interval) {
  const producer = spawn(process.execPath, [generator, name, String(interval)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const pipe = spawn(process.execPath, [cli, '--port', String(port), '--name', name, '--no-open'], {
    cwd: root,
    stdio: ['pipe', 'inherit', 'inherit'],
  })

  children.add(producer)
  children.add(pipe)
  producer.stdout.pipe(pipe.stdin)

  producer.on('exit', () => {
    pipe.stdin.end()
  })
  pipe.on('exit', () => {
    if (!producer.killed) producer.kill('SIGTERM')
  })
}

async function stop() {
  if (stopping) return
  stopping = true
  console.log('\n[demo] stopping streams and daemon...')
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  await delay(300)
  for (const child of children) {
    if (!child.killed) child.kill('SIGKILL')
  }
  if (daemon !== null && !daemon.killed) daemon.kill('SIGTERM')
  try {
    await fetch(`${base}/api/shutdown`, { method: 'POST', signal: AbortSignal.timeout(1000) })
  } catch {}
  process.exit(0)
}

process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())

if (await healthy()) {
  console.error(`[demo] Something already answers on ${base}. Set PORT to a free port.`)
  process.exit(1)
}

daemon = spawn(process.execPath, [cli, '__daemon', '--port', String(port)], {
  cwd: root,
  stdio: 'ignore',
})

for (let attempt = 0; attempt < 50; attempt += 1) {
  if (await healthy()) break
  if (attempt === 49) {
    console.error(`[demo] log-ui did not become ready on ${base}.`)
    daemon.kill('SIGTERM')
    process.exit(1)
  }
  await delay(100)
}

console.log(`
log-ui demo
  URL      ${base}
  streams  api (500 ms), worker (900 ms)
  try      Error/Warn chips, search "payment", click a { } row, isolate a trace,
           Export, Manual mode, custom range, and closing a tab
  stop     Ctrl+C
`)

launch('api', 500)
launch('worker', 900)

if (shouldOpen) {
  try {
    await open(base)
  } catch {
    console.log(`[demo] open the URL manually: ${base}`)
  }
}

await new Promise(() => {})
