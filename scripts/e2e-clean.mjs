import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function tryRun(action) {
  try {
    action()
    return true
  } catch {
    return false
  }
}

const port = process.env.LOGDECK_E2E_PORT ?? '4173'

tryRun(() => {
  execFileSync(process.execPath, ['dist/cli.js', 'stop', '--port', port], { stdio: 'ignore' })
})

tryRun(() => {
  rmSync(join(homedir(), '.logdeck', `daemon-${port}.json`), { force: true })
})
