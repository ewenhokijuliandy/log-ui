import { writeSync } from 'node:fs'

export type CliStatus = {
  enabled: boolean
  info: (message: string) => void
}

export function createStatus(quiet: boolean): CliStatus {
  const enabled = !quiet && (process.stderr.isTTY === true || process.env.LOGDECK_STATUS === '1')
  return {
    enabled,
    info: (message) => {
      if (!enabled) return
      try {
        writeSync(2, `logdeck: ${message}\n`)
      } catch {}
    },
  }
}
