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

async function saveCurrentStream(page: Page, name?: string): Promise<void> {
  await page.getByRole('button', { name: 'Save log', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Save log' })
  await expect(dialog).toBeVisible()
  if (name !== undefined) await dialog.getByLabel('Saved log name').fill(name)
  await dialog.getByRole('button', { name: 'Save log' }).click()
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
  await saveCurrentStream(page)

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
  await page
    .getByRole('dialog', { name: /Delete/ })
    .getByRole('button', { name: 'Delete log' })
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
  await saveCurrentStream(page)
  const view = page.locator('.view-slot:not([hidden])')
  await expect(view.locator('.saved-row')).toHaveCount(1)

  await page.reload()
  await page.getByRole('button', { name: 'Saved logs' }).click()
  await expect(page.locator('.view-slot:not([hidden]) .saved-row')).toHaveCount(1)
  await expect(page.locator('.view-slot:not([hidden]) .saved-row').first()).toContainText('worker')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('filters, sorts and guards deletion of saved logs', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const first = startPipe('alpha')
  const second = startPipe('beta')
  pipes.push(first, second)
  await first.write([line(1, 'ERROR', 'boom')])
  await second.write([line(2, 'INFO', 'ok')])
  await waitForStream('alpha')
  await waitForStream('beta')

  await page.goto('/')
  await page.keyboard.press('Escape')
  for (const name of ['alpha', 'beta']) {
    await page
      .getByRole('tab', { name: new RegExp(`^${name}`) })
      .first()
      .click()
    await saveCurrentStream(page)
    await page.waitForTimeout(300)
  }

  const view = page.locator('.view-slot:not([hidden])')
  await expect(view.locator('.saved-row')).toHaveCount(2)

  await view.getByLabel('Search saved logs').fill('alp')
  await expect(view.locator('.saved-row')).toHaveCount(1)
  await expect(view.locator('.saved-open').first()).toHaveText('alpha')

  await view.getByLabel('Search saved logs').fill('nothing-here')
  await expect(view.locator('.saved-empty-title')).toContainText('No saved log matches')
  await view.getByRole('button', { name: 'clear the search' }).click()
  await expect(view.locator('.saved-row')).toHaveCount(2)

  await view.getByRole('button', { name: 'Name', exact: true }).click()
  await expect(view.locator('.saved-open').first()).toHaveText('alpha')

  await view
    .getByRole('button', { name: /^Delete/ })
    .first()
    .click()
  const confirm = page.getByRole('dialog', { name: /Delete/ })
  await expect(confirm).toBeVisible()
  await expect(confirm.locator('h2')).toContainText('alpha')
  await expect(confirm.getByRole('button', { name: 'Keep log' })).toBeVisible()
  await confirm.getByRole('button', { name: 'Keep log' }).click()
  await expect(view.locator('.saved-row')).toHaveCount(2)

  await view
    .getByRole('button', { name: /^Delete/ })
    .first()
    .click()
  await page
    .getByRole('dialog', { name: /Delete/ })
    .getByRole('button', { name: 'Delete log' })
    .click()
  await expect(view.locator('.saved-row')).toHaveCount(1)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('save opens a name dialog defaulting to the stream name', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('checkout-api')
  pipes.push(pipe)
  await pipe.write([line(1, 'ERROR', 'declined')])
  await waitForStream('checkout-api')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: /checkout-api/ }).click()

  await page.getByRole('button', { name: 'Save log', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Save log' })
  await expect(dialog).toBeVisible()

  const input = dialog.getByLabel('Saved log name')
  await expect(input).toHaveValue('checkout-api')
  await expect(input).toBeFocused()

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  const none = await page.request.get('/api/saved')
  expect((await none.json()) as unknown[]).toHaveLength(0)

  await page.getByRole('button', { name: 'Save log', exact: true }).click()
  await dialog.getByLabel('Saved log name').fill('   ')
  await expect(dialog.getByRole('button', { name: 'Save log' })).toBeDisabled()

  await dialog.getByLabel('Saved log name').fill('payment incident')
  await dialog.getByRole('button', { name: 'Save log' }).click()

  const view = page.locator('.view-slot:not([hidden])')
  await expect(view.locator('.saved-open').first()).toHaveText('payment incident')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
