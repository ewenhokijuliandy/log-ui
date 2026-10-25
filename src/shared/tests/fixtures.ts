export const TRACE_ID_HEX32 = '5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d'
export const REQUEST_UUID = 'a4f1c0de-62b7-4e2a-9f18-1d7c3a8e50b1'
export const SHORT_REQ_ID = '8f21c0a4'

export const SAMPLE_LINES: string[] = [
  `{"level":"info","time":"2026-10-22T14:36:12.004Z","msg":"request completed","method":"GET","url":"/v1/catalog","status":200,"duration_ms":12,"cached":true,"request_id":"${SHORT_REQ_ID}"}`,
  `time=2026-10-22T14:36:11Z level=info msg="gc pause done" extra=1`,
  `[2026-10-25 11:47:03,123] [ERROR] boom happened`,
  `2026-10-22 14:12:05,004 WARNING asyncio billing.sync - slow handler took 812 ms (threshold 500 ms)`,
  `2026-10-22T14:12:06.482Z 1 events.go:389] Event(v1.ObjectReference{Kind:"Pod"}): reason: 'BackOff'`,
  `java.lang.NullPointerException: invoice is null`,
  `    at com.example.orders.InvoiceService.print(InvoiceService.java:88)`,
  `2026-10-25T09:14:22.311+02:00 INFO offset aware line`,
  `1719638400.123 INFO epoch seconds line`,
  `1719638400123 INFO epoch millis line`,
  `12345678901 INFO eleven digit epoch is rejected`,
  ` worker 7 exited with code 1 signal=SIGKILL`,
  `2026-10-25 12:00:00,500 [http-nio-8080-exec-3] INFO c.v.orders.OrderService - order persisted in 12 ms`,
  `67 WARNING plain python warning line`,
  `deploy 8c2f41b rolled out to 3 pods in 42s`,
  `Thread 1: EXC_BAD_ACCESS (code=1, address=0x0)`,
]

export const MANUAL_SAMPLE_LINES: string[] = [
  `{"level":"info","time":"2026-10-22T14:12:03.221Z","msg":"request completed","method":"GET","url":"/v1/orders","status":200,"duration_ms":18,"request_id":"c3d8a1f2"}`,
  `2026-10-22 14:12:04,118 INFO  http-nio-8080-exec-3 c.v.orders.OrderService - order 4471 persisted in 12 ms`,
  `2026-10-22 14:12:05,004 WARNING asyncio billing.sync - slow handler took 812 ms (threshold 500 ms)`,
  `2026-10-22T14:12:06.482Z 1 events.go:389] Event(v1.ObjectReference{Kind:"Pod", Namespace:"shop", Name:"orders-7d9f"}): type: 'Warning' reason: 'BackOff' Back-off restarting failed container`,
  `worker-3 drained and replaced by worker-11`,
  `{"level":"error","time":"2026-10-22T14:12:08.771Z","msg":"payment declined","service":"payments","trace_id":"${TRACE_ID_HEX32}","span_id":"c41e09","error":{"type":"CardDeclined","code":"card_declined"}}`,
  `2026-10-22 14:12:09,335 ERROR http-nio-8080-exec-7 c.v.orders.CheckoutController - checkout failed for order 4472`,
  `2026-10-22T14:12:10.914Z  INFO  zap/logger.go:98  msg="cache refreshed"  keys=1842  took_ms=47`,
  `10.24.8.19 - - [22/Oct/2026:14:12:11 +0000] "POST /v1/checkout HTTP/1.1" 504 213 "-" "okhttp/4.12"`,
  `Traceback (most recent call last):`,
  `  File "/srv/shop/billing/sync.py", line 88, in run`,
  `    self.flush(batch)`,
  `  File "/srv/shop/billing/sync.py", line 121, in flush`,
  `    raise TimeoutError("billing gateway did not respond")`,
  `TimeoutError: billing gateway did not respond`,
  `2026-10-22 14:12:14,502 CRITICAL root shop.billing - sync halted after 3 attempts`,
  `deploy 8c2f41b rolled out to 3 pods in 42s`,
]

export const SPRING_STACK_LINES: string[] = [
  `2026-10-25 14:02:11,004 ERROR [io-8080-exec-1] o.s.b.web.servlet.support.ExceptionTag: nested failure`,
  `java.lang.NullPointerException`,
  `    at org.springframework.core.OrderComparator.compare(OrderComparator.java:89)`,
  `    at java.util.concurrent.ConcurrentSkipListMap.casSuccessor(ConcurrentSkipListMap.java:2242)`,
  `2026-10-25 14:02:11,010 WARN  o.s.context.support.ThriftService - fallback engaged`,
]

export function bigLogrusLine(): string {
  const payload = {
    level: 'info',
    time: '2026-10-25T11:47:10.000Z',
    msg: 'job payload accepted',
    worker: 'worker-2',
    queue: 'orders',
    retries: 0,
    job: {
      id: 'job_5504',
      type: 'orders.pack',
      priority: 5,
      attempts: 1,
      payload: {
        order_id: 'ord_8838',
        customer: { id: 'cus_20441', tier: 'plus', locale: 'en-GB' },
        items: [
          { sku: 'SKU-4471', name: 'Linen shirt, stone, M', qty: 2, unit_price: 64 },
          { sku: 'SKU-2210', name: 'Canvas tote, natural', qty: 1, unit_price: 18.5 },
        ],
        totals: {
          subtotal: 172,
          tax: 34.4,
          shipping: 4.95,
          discount: 0,
          grand_total: 211.35,
          currency: 'GBP',
        },
        trace_id: TRACE_ID_HEX32,
        debug: {
          ingest_node: 'node-7.eu-west-1.internal',
          checksum: 'sha256:c0ffee00d1ffba5e0000000000000000000000000000000000000000000000',
        },
      },
    },
  }
  return JSON.stringify(payload)
}

export function oversizedLine(): string {
  return `2026-10-25T11:47:11Z ERROR overflowing line ${'x'.repeat(160 * 1024)}`
}

export const THROUGHPUT_POOL: string[] = [
  ...SAMPLE_LINES,
  ...MANUAL_SAMPLE_LINES,
  bigLogrusLine(),
  `{"level":"debug","time":"2026-10-25T11:47:09.900Z","msg":"counter","values":[1,2,3,4,5,6,7,8,9,10],"nested":{"a":{"b":{"c":"x* 100"}}}}`,
  ...SPRING_STACK_LINES,
  `2026-10-25 11:47:12,250 ERROR [http-nio-8080-exec-2] c.v.orders.CheckoutController - 5xx for order 4473 trace_id=${TRACE_ID_HEX32}`,
]
