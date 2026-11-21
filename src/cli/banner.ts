export type DaemonState = 'started' | 'running'

export type BannerOptions = {
  name: string
  port: number
  daemonState: DaemonState
  columns: number
  unicode: boolean
  color: boolean
}

const ACCENT = '\u001b[38;2;74;138;214m'
const RESET = '\u001b[0m'
const NARROW_COLUMNS = 62

function mark(unicode: boolean, color: boolean): string {
  const glyph = unicode ? '▌' : '|'
  if (!color) return glyph
  return `${ACCENT}${glyph}${RESET}`
}

function separator(unicode: boolean): string {
  return unicode ? '  ·  ' : '  -  '
}

export function formatStreamBanner(options: BannerOptions): string[] {
  const url = `http://127.0.0.1:${String(options.port)}`
  const badge = mark(options.unicode, options.color)
  const stop = `Ctrl+C stop${separator(options.unicode)}logdeck stop all`

  if (options.columns < NARROW_COLUMNS) {
    return [`${badge} logdeck  ${options.name}`, `  ${url}`, `  ${stop}`]
  }

  const daemon = options.daemonState === 'started' ? 'started' : 'already running'
  return [
    `${badge} logdeck  ${options.name}`,
    `  streaming   ${url}`,
    `  daemon      ${daemon} on port ${String(options.port)}`,
    `  stop        Ctrl+C this stream${separator(options.unicode)}logdeck stop all`,
  ]
}

export function detectBannerColumns(): number {
  const stderr = process.stderr as NodeJS.WriteStream & { columns?: number }
  const stdout = process.stdout as NodeJS.WriteStream & { columns?: number }
  return stderr.columns ?? stdout.columns ?? 80
}

export function detectBannerUnicode(): boolean {
  if (process.env.TERM === 'dumb') return false
  const locale = process.env.LC_ALL ?? process.env.LC_CTYPE ?? process.env.LANG
  if (locale === undefined) return process.platform !== 'win32'
  return /utf-?8/i.test(locale)
}

export function detectBannerColor(): boolean {
  return (
    process.stderr.isTTY === true &&
    process.env.NO_COLOR === undefined &&
    process.env.TERM !== 'dumb'
  )
}
