import { Command } from 'commander'
import { readVersion } from '../server/version.ts'
import { normalizeBufferCap } from '../shared/buffer-cap.ts'
import { openBrowser } from './browser.ts'
import {
  DEFAULT_PORT,
  DEFAULT_STATE_DIR,
  ensureDaemon,
  runDaemon,
  setDaemonBufferCap,
  stopDaemon,
} from './daemon.ts'
import { type PipeOptions, runPipe } from './pipe.ts'
import { createStatus } from './status.ts'

function fail(message: string, exitCode = 1): never {
  process.stderr.write(`logdeck: ${message}\n`)
  process.exit(exitCode)
}

function toNumber(raw: unknown): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new Error(`"${String(raw)}" is not a number`)
  return parsed
}

function parseBufferCap(raw: unknown): number | null {
  if (raw === undefined) return null
  const bufferCap = normalizeBufferCap(Number(raw))
  if (bufferCap === null) {
    fail('--buffer-cap must be a whole number from 1,000 to 50,000')
  }
  return bufferCap
}

const program = new Command()

program
  .name('logdeck')
  .description('Pipe terminal output into a rich local log viewer')
  .version(readVersion(), '-V, --version')
  .option('--port <number>', 'local server port', String(DEFAULT_PORT))
  .option('--name <name>', 'tab name for the piped stream')
  .option('--no-open', 'do not open the browser')
  .option('--idle-timeout <minutes>', 'idle shutdown in minutes (0 disables)', '5')
  .option('--quiet', 'suppress CLI status messages')
  .option('--buffer-cap <number>', 'initial buffer limit (1,000–50,000)')

program
  .command('stop')
  .description('stop the local logdeck daemon')
  .action(async function stopAction(this: Command) {
    const opts = this.optsWithGlobals()
    const status = createStatus(opts.quiet === true)
    try {
      await stopDaemon(toNumber(opts.port), DEFAULT_STATE_DIR)
      status.info(`daemon stopped on port ${String(opts.port)}`)
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error))
    }
  })

program
  .command('__daemon', { hidden: true })
  .description('internal daemon entry')
  .action(async function daemonAction(this: Command) {
    const opts = this.optsWithGlobals()
    const port = toNumber(opts.port)
    const idleMinutes = toNumber(opts.idleTimeout)
    const bufferCap = parseBufferCap(opts.bufferCap)
    await runDaemon(port, idleMinutes, DEFAULT_STATE_DIR, (code) => process.exit(code), bufferCap)
  })

program.action(async (flags) => {
  const port = toNumber(flags.port)
  const name = typeof flags.name === 'string' ? flags.name : null
  const openInBrowser: boolean = flags.open !== false
  const status = createStatus(flags.quiet === true)
  const bufferCap = parseBufferCap(flags.bufferCap)

  let daemonStarted = false
  try {
    const daemon = await ensureDaemon(port, bufferCap)
    daemonStarted = daemon.started
    if (!daemon.started && bufferCap !== null) await setDaemonBufferCap(port, bufferCap)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }

  if (process.stdin.isTTY) {
    const url = `http://127.0.0.1:${String(port)}`
    status.info(`running on ${url}`)
    status.info('pipe a command: command | logdeck')
    status.info('stop: logdeck stop')
    if (openInBrowser) await openBrowser(url)
    return
  }

  const pipeOptions: PipeOptions = {
    port,
    name,
    openInBrowser,
    status,
    daemonState: daemonStarted ? 'started' : 'running',
  }
  void runPipe(pipeOptions).catch((error) => {
    fail(error instanceof Error ? error.message : String(error))
  })
})

try {
  await program.parseAsync(process.argv)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
