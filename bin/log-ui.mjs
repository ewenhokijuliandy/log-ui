#!/usr/bin/env node

const cli = new URL('../dist/cli.js', import.meta.url)

try {
  await import(cli)
} catch (error) {
  process.stderr.write(`log-ui: build output missing at ${cli.href}. Run "npm run build".\n`)
  if (error instanceof Error) process.stderr.write(`${error.message}\n`)
  process.exit(1)
}
