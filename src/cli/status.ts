import { writeSync } from 'node:fs'

export type CliStatus = {
  enabled: boolean
  tty: boolean
  info: (message: string) => void
  block: (lines: readonly string[]) => void
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
  const tty = process.stderr.isTTY === true
  const enabled = !quiet && (tty || process.env.LOGDECK_STATUS === '1')
  return {
    enabled,
    tty,
    info: (message) => {
      if (!enabled) return
      writeStatusLine(`logdeck: ${message}`)
    },
    block: (lines) => {
      if (!enabled) return
      for (const line of lines) writeStatusLine(line)
    },
  }
}
