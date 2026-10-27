const name = process.argv[2] ?? 'api'
const interval = Math.max(50, Number(process.argv[3] ?? 500))
const trace = '5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d'
const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'DEBUG', 'ERROR']

let tick = 0

function line() {
  tick += 1
  const ts = new Date().toISOString()

  if (tick % 37 === 0) {
    return [
      `${ts} ERROR [${name}] unhandled exception while saving order`,
      `  at persist (/srv/${name}/orders.js:88:13)`,
      `  at async handleRequest (/srv/${name}/server.js:41:7)`,
      '  at processTicksAndRejections (node:internal/process/task_queues:95:5)',
    ].join('\n')
  }

  if (tick % 13 === 0) {
    return `${ts} ${JSON.stringify({
      level: 'error',
      time: ts,
      msg: 'payment declined',
      service: 'payments',
      trace_id: trace,
      request_id: `req-${String(tick)}`,
      payload: {
        order: `ord_${String(8000 + tick)}`,
        items: [{ sku: 'SKU-4471', qty: 2, tags: ['linen', 'stone'] }],
        amount: 128.4,
      },
    })}`
  }

  const level = tick % 17 === 0 ? 'ERROR' : levels[tick % levels.length]
  const id = tick % 9 === 0 ? ` trace_id=${trace}` : ''
  const status = level === 'ERROR' ? '500' : level === 'WARN' ? '429' : '200'
  return `${ts} ${level} [${name}] request ${String(tick)} status=${status} latency=${String(10 + (tick % 90))}ms${id}`
}

function emit() {
  process.stdout.write(`${line()}\n`)
}

emit()
const timer = setInterval(emit, interval)

process.on('SIGINT', () => {
  clearInterval(timer)
  process.exit(0)
})
process.on('SIGTERM', () => {
  clearInterval(timer)
  process.exit(0)
})
