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

test.beforeEach(async () => {
  await clearStreams()
})

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('100k ingested lines keep a 10k buffer and a bounded DOM', async ({ page }) => {
  test.setTimeout(120_000)
  const pipe = startPipe('memory')
  pipes.push(pipe)
  await waitForStream('memory')

  for (let start = 0; start < 100_000; start += 10_000) {
    const chunk = Array.from({ length: 10_000 }, (_, index) => line(start + index))
    await pipe.write(chunk)
  }

  const consoleWatch = watchConsole(page)
  await page.goto('/')
  await expect(page.getByRole('tab', { name: /memory/ })).toBeVisible()
  await expect(page.locator('.title-meta')).toContainText('90,000 dropped', { timeout: 60_000 })
  await expect(page.locator('.title-meta')).toContainText('10,000 retained')
  await expect(page.getByRole('tab', { name: /memory 10,000/ })).toBeVisible()

  const rows = await page.locator('.log-row').count()
  expect(rows).toBeGreaterThan(0)
  expect(rows).toBeLessThan(100)
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
