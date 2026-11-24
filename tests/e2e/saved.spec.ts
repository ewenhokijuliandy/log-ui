import { expect, type Page, test } from '@playwright/test'
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

async function clearSaved(page: Page): Promise<void> {
  const list = await page.request.get('/api/saved')
  if (!list.ok()) return
  const entries = (await list.json()) as Array<{ id: string }>
  for (const entry of entries) await page.request.delete(`/api/saved/${entry.id}`)
}

test.beforeEach(async ({ page }) => {
  await clearStreams()
  await clearSaved(page)
})

test.afterEach(async ({ page }) => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
  await clearSaved(page)
})

test('saves a stream log, renames it, opens it and deletes it', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('payments')
  pipes.push(pipe)
  await pipe.write([line(1, 'ERROR', 'declined order ord_1')])
  await waitForStream('payments')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: /payments/ }).click()
  await page.getByRole('button', { name: 'Save log' }).click()

  const view = page.locator('.view-slot:not([hidden])')
  await expect(view.locator('.tool-view-title')).toHaveText('Saved logs')
  await expect(view.locator('.saved-row')).toHaveCount(1)
  await expect(view.locator('.saved-row').first()).toContainText('payments')

  await view
    .getByRole('button', { name: /^Rename/ })
    .first()
    .click()
  await view.locator('.saved-rename').fill('payment decline')
  await view.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(view.locator('.saved-open').first()).toHaveText('payment decline')

  await view.locator('.saved-open').first().click()
  await expect(view.locator('.log-row')).toHaveCount(1)
  await expect(view.locator('.log-row').first()).toContainText('declined order ord_1')

  await view.locator('.log-row').first().click()
  await expect(view.locator('.inspector')).toBeVisible()

  await view.getByRole('button', { name: 'Back to saved logs' }).click()
  await view
    .getByRole('button', { name: /^Delete/ })
    .first()
    .click()
  await expect(view.locator('.saved-empty')).toContainText('Nothing saved yet')

  const after = await page.request.get('/api/saved')
  expect((await after.json()) as unknown[]).toHaveLength(0)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('saved logs survive a reload', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('worker')
  pipes.push(pipe)
  await pipe.write([line(2, 'WARN', 'slow job')])
  await waitForStream('worker')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: /worker/ }).click()
  await page.getByRole('button', { name: 'Save log' }).click()
  const view = page.locator('.view-slot:not([hidden])')
  await expect(view.locator('.saved-row')).toHaveCount(1)

  await page.reload()
  await page.getByRole('button', { name: 'Saved logs' }).click()
  await expect(page.locator('.view-slot:not([hidden]) .saved-row')).toHaveCount(1)
  await expect(page.locator('.view-slot:not([hidden]) .saved-row').first()).toContainText('worker')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
