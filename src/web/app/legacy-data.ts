export const PIPE_EXAMPLES: readonly string[] = [
  'tail -f file.log | logdeck',
  'docker logs -f api | logdeck',
  'oc logs pod-name -f --tail=100 | logdeck',
  'npm run start | logdeck',
]

export const MANUAL_SAMPLE: string = [
  '{"level":"info","time":"2026-10-22T14:12:03.221Z","msg":"request completed","method":"GET","url":"/v1/orders","status":200,"duration_ms":18,"request_id":"c3d8a1f2"}',
  '2026-10-22 14:12:04,118 INFO  http-nio-8080-exec-3 c.v.orders.OrderService - order 4471 persisted in 12 ms',
  '2026-10-22 14:12:05,004 WARNING asyncio billing.sync - slow handler took 812 ms (threshold 500 ms)',
  '2026-10-22T14:12:06.482Z 1 events.go:389] Event(v1.ObjectReference{Kind:"Pod", Namespace:"shop", Name:"orders-7d9f"}): type: \'Warning\' reason: \'BackOff\' Back-off restarting failed container',
  'worker-3 drained and replaced by worker-11',
  '{"level":"error","time":"2026-10-22T14:12:08.771Z","msg":"payment declined","service":"payments","trace_id":"5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d","span_id":"c41e09","error":{"type":"CardDeclined","code":"card_declined"}}',
  '2026-10-22 14:12:09,335 ERROR http-nio-8080-exec-7 c.v.orders.CheckoutController - checkout failed for order 4472',
  '2026-10-22T14:12:10.914Z  INFO  zap/logger.go:98  msg="cache refreshed"  keys=1842  took_ms=47',
  '10.24.8.19 - - [22/Oct/2026:14:12:11 +0000] "POST /v1/checkout HTTP/1.1" 504 213 "-" "okhttp/4.12"',
  'Traceback (most recent call last):',
  '  File "/srv/shop/billing/sync.py", line 88, in run',
  '    self.flush(batch)',
  '  File "/srv/shop/billing/sync.py", line 121, in flush',
  '    raise TimeoutError("billing gateway did not respond")',
  'TimeoutError: billing gateway did not respond',
  '2026-10-22 14:12:14,502 CRITICAL root shop.billing - sync halted after 3 attempts',
  'deploy 8c2f41b rolled out to 3 pods in 42s',
].join('\n')

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: '/', label: 'Focus the search field' },
  { keys: 'Esc', label: 'Clear the search, or close a sheet' },
  { keys: 'j / k', label: 'Move down and up the visible rows' },
  { keys: 'Enter', label: 'Open the selected row in the inspector' },
  { keys: 't', label: 'Switch between dark and light' },
  { keys: '?', label: 'Open this shortcut list' },
]
