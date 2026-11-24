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

test('show all lines clears the filter and keeps the selected line in view', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('trace-target')
  pipes.push(pipe)
  const lines = Array.from({ length: 120 }, (_, index) =>
    line(index + 1, index + 1 === 100 ? 'ERROR' : 'INFO', `request ${String(index + 1)}`),
  )
  await pipe.write(lines)
  await waitForStream('trace-target')

  await page.goto('/')
  await page.keyboard.press('Escape')
  const view = page.locator('.view-slot:not([hidden])')

  await view.getByLabel('Search logs').fill('request 100')
  await expect(view.locator('.log-row')).toHaveCount(1)
  await expect(view.getByRole('button', { name: /Show all/ })).toHaveCount(0)

  await view.locator('.log-row').first().click()
  await expect(view.locator('.inspector-head h2')).toHaveText('Line 100')

  const reveal = view.getByRole('button', { name: /Show all/ })
  await expect(reveal).toBeVisible()
  await reveal.click()

  await expect(view.getByLabel('Search logs')).toHaveValue('')
  await expect(view.locator('.inspector-head h2')).toHaveText('Line 100')

  const geometry = await view.evaluate((root) => {
    const selected = root.querySelector('.log-row[aria-current="true"]')
    const list = root.querySelector('.log-list')
    if (selected === null || list === null) return null
    const row = selected.getBoundingClientRect()
    const box = list.getBoundingClientRect()
    return {
      seq: selected.querySelector('.seq')?.textContent,
      inView: row.top >= box.top - 1 && row.bottom <= box.bottom + 1,
      neighbours: root.querySelectorAll('.log-row').length,
    }
  })
  expect(geometry).not.toBeNull()
  expect(geometry?.seq).toBe('100')
  expect(geometry?.inView).toBe(true)
  expect(geometry?.neighbours ?? 0).toBeGreaterThan(1)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
