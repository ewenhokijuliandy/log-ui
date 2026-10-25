import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { Hono } from 'hono'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

export function registerStaticRoutes(app: Hono, webRoot: string): void {
  const root = resolve(webRoot)

  app.get('*', async (c) => {
    const requestPath = c.req.path
    if (requestPath.startsWith('/api') || requestPath === '/ws' || requestPath === '/ingest') {
      return c.text('not found', 404)
    }

    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\//, '')
    const absolute = resolve(root, relative)
    if (!absolute.startsWith(root + sep)) return c.text('forbidden', 403)
    if (!existsSync(absolute)) return c.text('not found', 404)

    const data = await readFile(absolute)
    const mime = MIME_TYPES[extname(absolute).toLowerCase()] ?? 'application/octet-stream'
    return c.body(new Uint8Array(data), 200, { 'Content-Type': mime })
  })
}
