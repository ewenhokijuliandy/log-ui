import { expect, test } from '@playwright/test'
import {
  clearStreams,
  line,
  type Pipe,
  startPipe,
  unexpectedConsole,
  waitForStream,
  watchConsole,
} from './helpers.ts'

const pipes: Pipe[] = []

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('pretty JSON keeps a long minified line inside its card', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('pretty-long')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('pretty-long')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Pretty JSON' }).click()
  const view = page.locator('.view-slot:not([hidden])')

  const longJson = JSON.stringify({
    items: Array.from({ length: 40 }, (_, index) => ({
      sku: `SKU-${String(4000 + index)}`,
      qty: index,
    })),
  })
  await view.getByLabel('JSON in').fill(longJson)
  await view.getByRole('button', { name: 'Minify' }).click()
  await view.getByRole('button', { name: 'Prettify' }).click()

  const output = view.locator('.diff-output')
  await expect(output).toContainText('SKU-4000')

  const box = await output.boundingBox()
  const card = await view.locator('.diff-input-card').nth(1).boundingBox()
  expect(box).not.toBeNull()
  expect(card).not.toBeNull()
  if (box === null || card === null) throw new Error('missing boxes')
  expect(box.width).toBeLessThanOrEqual(card.width)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('compare diffs every line of a 3000-line input', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('compare-long')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('compare-long')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Compare JSON' }).click()
  const view = page.locator('.view-slot:not([hidden])')

  const build = (mutate: boolean): string =>
    JSON.stringify(
      Object.fromEntries(
        Array.from({ length: 3000 }, (_, index) => [
          `key_${String(index)}`,
          mutate && index === 1500 ? 'CHANGED' : index,
        ]),
      ),
    )

  await view.getByLabel('A · before').fill(build(false))
  await view.getByLabel('B · after').fill(build(true))
  await view.getByRole('button', { name: 'Compare', exact: true }).click()

  await expect(view.locator('.diff-row')).toHaveCount(3002)
  await expect(view.locator('.diff-row.changed')).toHaveCount(1)
  await expect(view.locator('.diff-summary')).toContainText('3002 lines compared')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('JSON syntax colouring renders and clears contrast targets', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('colours')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('colours')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Compare JSON' }).click()
  const view = page.locator('.view-slot:not([hidden])')
  await view.getByRole('button', { name: 'Load sample' }).click()
  await view.getByRole('button', { name: 'Compare', exact: true }).click()

  await expect(view.locator('.diff-cell .json-key').first()).toBeVisible()
  await expect(view.locator('.diff-cell .val-string').first()).toBeVisible()
  await expect(view.locator('.diff-cell .val-number').first()).toBeVisible()

  const report = await view.evaluate((root) => {
    const parse = (value: string): number[] => {
      const match = value.match(/rgba?\(([^)]+)\)/)
      if (match === null) return [0, 0, 0]
      return match[1]
        .split(',')
        .slice(0, 3)
        .map((part) => Number(part.trim()))
    }
    const channel = (value: number): number => {
      const unit = value / 255
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
    }
    const luminance = (rgb: number[]): number =>
      0.2126 * channel(rgb[0] ?? 0) + 0.7152 * channel(rgb[1] ?? 0) + 0.0722 * channel(rgb[2] ?? 0)
    const ratio = (a: number[], b: number[]): number => {
      const first = luminance(a)
      const second = luminance(b)
      const high = Math.max(first, second)
      const low = Math.min(first, second)
      return (high + 0.05) / (low + 0.05)
    }
    const backgroundOf = (node: Element): number[] => {
      let current: Element | null = node
      while (current !== null) {
        const value = getComputedStyle(current).backgroundColor
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return parse(value)
        current = current.parentElement
      }
      return parse(getComputedStyle(document.documentElement).backgroundColor)
    }
    const rows = [...root.querySelectorAll('.diff-row')]
    const samples: Array<{ cls: string; ratio: number }> = []
    for (const row of rows) {
      const spans = [...row.querySelectorAll('.diff-cell span')]
      if (spans.length === 0) continue
      const background = backgroundOf(row)
      for (const span of spans) {
        const cls = span.className
        if (cls.length === 0) continue
        samples.push({ cls, ratio: ratio(parse(getComputedStyle(span).color), background) })
      }
      if (samples.length > 40) break
    }
    const worst: Record<string, number> = {}
    for (const sample of samples) {
      worst[sample.cls] = Math.min(worst[sample.cls] ?? Number.POSITIVE_INFINITY, sample.ratio)
    }
    const rowHeight =
      rows[0] === undefined ? null : Math.round(rows[0].getBoundingClientRect().height)
    return { worst, rowHeight, sampled: samples.length }
  })

  expect(report.sampled).toBeGreaterThan(0)
  expect(report.rowHeight).toBe(22)
  for (const [cls, value] of Object.entries(report.worst)) {
    expect(value, `contrast for ${cls}`).toBeGreaterThanOrEqual(4.5)
  }

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
