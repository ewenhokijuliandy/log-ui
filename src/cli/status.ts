import { writeSync } from 'node:fs'

export type CliStatus = {
  enabled: boolean
  info: (message: string) => void
}

function writeStatusLine(line: string): boolean {
  try {
    writeSync(2, `${line}\n`)
    return true
  } catch {
    return false
  }
}

export function createStatus(quiet: boolean): CliStatus {
  const enabled = !quiet && (process.stderr.isTTY === true || process.env.LOGDECK_STATUS === '1')
  return {
    enabled,
    info: (message) => {
      if (!enabled) return
      writeStatusLine(`logdeck: ${message}`)
    },
  }
}
