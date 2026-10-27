import { describe, expect, test } from 'vitest'
import { parseLine } from './parse-line.ts'
import { oversizedLine, REQUEST_UUID, SHORT_REQ_ID, TRACE_ID_HEX32 } from './tests/fixtures.ts'

const DECLINED_REQUEST_ID = 'd3e4f5a6'

describe('timestamps', () => {
  test('ISO with Z and milliseconds', () => {
    const parsed = parseLine('2026-10-25T11:47:03.123Z INFO started')
    expect(parsed.ts).toBe(Date.parse('2026-10-25T11:47:03.123Z'))
    expect(parsed.message).toBe('started')
  })

  test('ISO with named offset is UTC-normalized', () => {
    const parsed = parseLine('2026-10-25T09:14:22.311+02:00 INFO offset aware line')
    expect(parsed.ts).toBe(Date.parse('2026-10-25T07:14:22.311Z'))
    expect(parsed.message).toBe('offset aware line')
  })

  test('ISO with compact offset', () => {
    const parsed = parseLine('2026-10-25T09:14:22-0230 INFO line')
    expect(parsed.ts).toBe(Date.parse('2026-10-25T11:44:22Z'))
  })

  test('comma milliseconds and local wall clock', () => {
    const parsed = parseLine(
      '2026-10-22 14:12:05,004 WARNING asyncio billing.sync - slow handler took 812 ms',
    )
    expect(parsed.ts).toBe(new Date(2026, 9, 22, 14, 12, 5, 4).getTime())
    expect(parsed.level).toBe('warn')
  })

  test('sub-millisecond fractions keep three digits', () => {
    const parsed = parseLine('2026-10-22 14:12:06.915823 INFO x')
    expect(parsed.ts).toBe(new Date(2026, 9, 22, 14, 12, 6, 915).getTime())
    expect(parsed.message).toBe('x')
  })

  test('bracketed timestamp is stripped', () => {
    const parsed = parseLine('[2026-10-25 11:47:03,123] [ERROR] boom happened')
    expect(parsed.ts).toBe(new Date(2026, 9, 25, 11, 47, 3, 123).getTime())
    expect(parsed.level).toBe('error')
    expect(parsed.message).toBe('boom happened')
  })

  test('epoch seconds with fraction', () => {
    const parsed = parseLine('1719638400.123 INFO epoch seconds line')
    expect(parsed.ts).toBe(Date.parse('2024-06-29T05:20:00.123Z'))
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('epoch seconds line')
  })

  test('epoch millis', () => {
    const parsed = parseLine('1719638400123 INFO epoch millis line')
    expect(parsed.ts).toBe(Date.parse('2024-06-29T05:20:00.123Z'))
  })

  test('eleven digit epoch is rejected', () => {
    const parsed = parseLine('12345678901 INFO eleven digit epoch is rejected')
    expect(parsed.ts).toBeNull()
    expect(parsed.level).toBe('unknown')
  })

  test('twelve digit epoch is rejected', () => {
    const parsed = parseLine('123456789012 INFO twelve digit epoch is rejected')
    expect(parsed.ts).toBeNull()
  })

  test('date without time is not a timestamp', () => {
    const parsed = parseLine('2026-10-25 maintenance window planned')
    expect(parsed.ts).toBeNull()
    expect(parsed.message).toBe('2026-10-25 maintenance window planned')
  })
})

describe('levels', () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['FATAL', 'fatal', 'pump down'],
    ['CRITICAL', 'fatal', 'sync halted'],
    ['CRIT', 'fatal', 'drive failed'],
    ['ERROR', 'error', 'boom happened'],
    ['ERR', 'error', 'decode problem'],
    ['WARN', 'warn', 'slot nearly full'],
    ['WARNING', 'warn', 'slow handler'],
    ['INFO', 'info', 'warmup done'],
    ['NOTICE', 'info', 'config reloaded'],
    ['DEBUG', 'debug', 'dump state'],
    ['TRACE', 'trace', 'span settled'],
    ['VERBOSE', 'trace', 'path walk'],
  ]

  test.for(cases)('%s maps to %s', ([token, expected, message]) => {
    const parsed = parseLine(`${token} ${message}`)
    expect(parsed.level).toBe(expected)
    expect(parsed.message).toBe(message)
  })

  test('json level key wins before text tokens', () => {
    const parsed = parseLine(
      `{"level":"warn","msg":"retry scheduled","note":"ignore ERROR tokens"}`,
    )
    expect(parsed.level).toBe('warn')
  })

  test('severity json key accepted', () => {
    const parsed = parseLine(`{"severity":"CRITICAL","message":"sync halted"}`)
    expect(parsed.level).toBe('fatal')
  })

  test('bracketed level followed by non-level brackets', () => {
    const parsed = parseLine(
      '2026-10-25 14:02:11,004 ERROR [io-8080-exec-1] o.s.b.web: nested failure',
    )
    expect(parsed.level).toBe('error')
    expect(parsed.message).toBe('[io-8080-exec-1] o.s.b.web: nested failure')
  })

  test('level keyword after a tag bracket is detected', () => {
    const parsed = parseLine(
      '2026-10-25 12:00:00,500 [http-nio-8080-exec-3] INFO c.v.orders - order persisted',
    )
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('c.v.orders - order persisted')
  })

  test('bracket only tag without level keyword stays unknown', () => {
    const parsed = parseLine(
      '2026-10-25 12:00:00,500 [http-nio-8080-exec-3] c.v.orders - checkout fail',
    )
    expect(parsed.level).toBe('unknown')
  })

  test('level keyword away from the line head is not consumed', () => {
    const parsed = parseLine(
      '2026-10-25 12:00:00,500 c.v.orders - order persisted with level info inside text',
    )
    expect(parsed.level).toBe('unknown')
    expect(parsed.message).toBe('c.v.orders - order persisted with level info inside text')
  })

  test('unknown stack lines never get a level', () => {
    const parsed = parseLine(
      '    at com.example.orders.InvoiceService.print(InvoiceService.java:88)',
    )
    expect(parsed.level).toBe('unknown')
    expect(parsed.message).toBe(
      'at com.example.orders.InvoiceService.print(InvoiceService.java:88)',
    )
  })
})

describe('json extraction', () => {
  test('whole-line logrus json', () => {
    const parsed = parseLine(`{"level":"info","msg":"request completed","method":"GET"}`)
    expect(parsed.level).toBe('info')
    expect(parsed.json).toEqual({ level: 'info', msg: 'request completed', method: 'GET' })
    expect(parsed.message).toBe('request completed')
  })

  test('json with trailing prose keeps both', () => {
    const parsed = parseLine(`{"kind":"batch"} queued jobs=4`)
    expect(parsed.json).toEqual({ kind: 'batch' })
    expect(parsed.message).toBe('{"kind":"batch"} queued jobs=4')
  })

  test('skips an invalid candidate and finds the valid one', () => {
    const parsed = parseLine(`{ broken tail {"valid":2} end`)
    expect(parsed.json).toEqual({ valid: 2 })
    expect(parsed.message).toBe('{ broken tail {"valid":2} end')
  })

  test('arrays are extracted', () => {
    const parsed = parseLine(`[1,2,3] flushed`)
    expect(parsed.json).toEqual([1, 2, 3])
  })

  test('nested and escaped strings survive', () => {
    const line = `{"msg":"payment declined","error":{"type":"CardDeclined","code":"card_declined"}}`
    const parsed = parseLine(line)
    expect(parsed.json).toEqual({
      msg: 'payment declined',
      error: { type: 'CardDeclined', code: 'card_declined' },
    })
    expect(parsed.message).toBe('payment declined')
  })

  test('non-object json candidates are ignored', () => {
    const parsed = parseLine(`"just a string" after quote`)
    expect(parsed.json).toBeNull()
  })

  test('ansi codes are stripped before parsing', () => {
    const parsed = parseLine(`\u001B[31mERROR\u001B[0m redis down`)
    expect(parsed.level).toBe('error')
    expect(parsed.message).toBe('redis down')
    expect(parsed.raw.includes('\u001B')).toBe(false)
  })

  test('escaped quote inside json string survives', () => {
    const parsed = parseLine(`{"msg":"brace } inside","note":"quote\\"still"}`)
    expect(parsed.json).toEqual({ msg: 'brace } inside', note: 'quote"still' })
  })

  test('braces inside strings do not break balancing', () => {
    const parsed = parseLine(`{"a":"{","b":"}","c":[1,2]}`)
    expect(parsed.json).toEqual({ a: '{', b: '}', c: [1, 2] })
  })
})

describe('ids', () => {
  test('dashed uuid captured', () => {
    const parsed = parseLine(`2026-10-25T11:47:03Z INFO started request_id=${REQUEST_UUID}`)
    expect(parsed.ids).toContain(REQUEST_UUID.toLowerCase())
  })

  test('trace_id value captured', () => {
    const parsed = parseLine(`traceid: ${TRACE_ID_HEX32} checkout failed`)
    expect(parsed.ids).toContain(TRACE_ID_HEX32)
  })

  test('json request_id captured', () => {
    const parsed = parseLine(
      `{"level":"info","msg":"request completed","request_id":"${SHORT_REQ_ID}"}`,
    )
    expect(parsed.ids).toContain(SHORT_REQ_ID)
  })

  test('json trace_id wins over text noise', () => {
    const parsed = parseLine(
      `{"level":"error","msg":"payment declined","trace_id":"${TRACE_ID_HEX32}","request_id":"${DECLINED_REQUEST_ID}"} fallback ${TRACE_ID_HEX32}`,
    )
    expect(parsed.ids).toEqual([TRACE_ID_HEX32, DECLINED_REQUEST_ID])
  })

  test('ids capped at eight', () => {
    const uuids = Array.from({ length: 10 }, (_, index) => {
      const hex = (index + 1).toString(16).padStart(12, 'f')
      return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4000-8000-${hex.slice(0, 12)}`
    })
    const parsed = parseLine(`INFO ${uuids.join(' ')}`)
    expect(parsed.ids).toHaveLength(8)
    expect(parsed.ids[0]).toBe(uuids[0]?.toLowerCase())
  })
})

describe('line cap', () => {
  test('oversized line truncated with flag', () => {
    const parsed = parseLine(oversizedLine())
    expect(parsed.truncated).toBe(true)
    expect(parsed.raw.length).toBe(100 * 1024)
    expect(parsed.level).toBe('error')
  })

  test('normal line not truncated', () => {
    const parsed = parseLine('hello world')
    expect(parsed.truncated).toBe(false)
    expect(parsed.raw).toBe('hello world')
    expect(parsed.level).toBe('unknown')
    expect(parsed.message).toBe('hello world')
  })

  test('empty line parsed safely', () => {
    const parsed = parseLine('')
    expect(parsed.message).toBe('')
    expect(parsed.ts).toBeNull()
    expect(parsed.ids).toEqual([])
  })
})
