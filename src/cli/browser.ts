import open from 'open'

export async function openBrowser(url: string): Promise<void> {
  try {
    await open(url)
  } catch {
    process.stderr.write(`logdeck: could not open a browser — visit ${url} manually\n`)
  }
}
