import { existsSync, readFileSync } from 'node:fs'

const FALLBACK_VERSION = '0.0.0'
const CANDIDATES = ['../package.json', '../../package.json']

export function readVersion(): string {
  for (const candidate of CANDIDATES) {
    const url = new URL(candidate, import.meta.url)
    if (!existsSync(url)) continue
    try {
      const metadata = JSON.parse(readFileSync(url, 'utf8')) as { version?: string }
      return metadata.version ?? FALLBACK_VERSION
    } catch {
      break
    }
  }
  return FALLBACK_VERSION
}
