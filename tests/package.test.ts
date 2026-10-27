import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

type PackFile = { path: string; size: number }
type PackResult = { files: PackFile[] }

const built = existsSync('dist/cli.js') && existsSync('dist/web/index.html')

describe.skipIf(!built)('npm package allowlist', () => {
  test('ships only bin, dist, README and package.json', () => {
    const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const [pack] = JSON.parse(raw) as PackResult[]
    expect(pack).toBeDefined()
    const paths = pack?.files.map((file) => file.path) ?? []

    const allowed = paths.filter((path) => {
      return (
        path === 'package.json' ||
        path === 'README.md' ||
        path.startsWith('bin/') ||
        path.startsWith('dist/')
      )
    })
    expect(allowed).toEqual(paths)

    for (const forbidden of ['src/', 'tests/', 'design/', 'mockups/', '.commandcode/']) {
      expect(paths.some((path) => path.startsWith(forbidden))).toBe(false)
    }

    expect(paths).toContain('bin/log-ui.mjs')
    expect(paths).toContain('dist/cli.js')
    expect(paths).toContain('dist/web/index.html')
    expect(paths.some((path) => path.startsWith('dist/web/assets/'))).toBe(true)
    expect(pack?.files.find((file) => file.path === 'README.md')?.size ?? 0).toBeGreaterThan(100)
  })
})
