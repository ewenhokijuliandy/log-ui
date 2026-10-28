import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const port = process.env.LOGDECK_E2E_PORT ?? '4173'

try {
  execFileSync(process.execPath, ['dist/cli.js', 'stop', '--port', port], { stdio: 'ignore' })
} catch {}

try {
  rmSync(join(homedir(), '.logdeck', `daemon-${port}.json`), { force: true })
} catch {}
