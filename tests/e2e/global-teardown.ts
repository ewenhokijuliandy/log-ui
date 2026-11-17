import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function tryRun(action: () => void): boolean {
  try {
    action()
    return true
  } catch {
    return false
  }
}

export default function globalTeardown(): void {
  const port = process.env.LOGDECK_E2E_PORT ?? '4173'
  tryRun(() => {
    execFileSync(process.execPath, ['dist/cli.js', 'stop', '--port', port], {
      cwd: process.cwd(),
      stdio: 'ignore',
    })
  })
  tryRun(() => {
    rmSync(join(homedir(), '.logdeck', `daemon-${port}.json`), { force: true })
  })
}
