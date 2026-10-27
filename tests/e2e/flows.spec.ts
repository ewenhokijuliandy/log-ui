import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  clearStreams,
  jsonLine,
  line,
  type Pipe,
  startPipe,
  unexpectedConsole,
  waitForStream,
  watchConsole,
} from './helpers.ts'

const pipes: Pipe[] = []

async function seed(
  page: import('@playwright/test').Page,
  name = 'flow',
  lines: readonly string[],
): Promise<Pipe> {
  const pipe = startPipe(name)
  pipes.push(pipe)
  await pipe.write(lines)
  await waitForStream(name)
  await page.goto('/')
  await expect(page.getByRole('tab', { name: new RegExp(name) })).toBeVisible()
  await expect(page.locator('.log-row').first()).toBeVisible()
  return pipe
}

test.beforeEach(async () => {
  await clearStreams()
})

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('quick start closes to the empty state and manual mode stays local', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const posts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/streams')) {
      posts.push(request.url())
    }
  })
  await page.goto('/')

  const quick = page.getByRole('dialog', { name: 'Quick start' })
  await expect(quick).toBeVisible()
  await page.getByRole('button', { name: 'Close quick start' }).click()
  await expect(page.getByRole('heading', { name: 'No streams yet' })).toBeVisible()

  await page.locator('.quick-actions').getByRole('button', { name: 'Open quick start' }).click()
  await expect(quick).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(quick).not.toBeVisible()

  await page.getByRole('button', { name: 'Manual mode' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Manual mode' })).toBeVisible()
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('button', { name: 'Parse logs' }).click()

  await expect(page.getByRole('tab', { name: /manual-1/ })).toBeVisible()
  await expect(page.locator('.status-pill')).toContainText('MANUAL')
  expect(posts).toEqual([])
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('pipe flows through search, level filter, inspector, export, and close', async ({ page }) => {
  const pipe = await seed(page, 'flow', [
    line(1, 'INFO', 'payment accepted'),
    line(2, 'ERROR', 'payment declined'),
    jsonLine(3),
  ])
  const consoleWatch = watchConsole(page)

  await page.getByLabel('Search logs').fill('payment')
  await expect(page.locator('.log-row')).toHaveCount(3)
  await page.getByLabel('Search logs').fill('')
  await expect(page.locator('.log-row')).toHaveCount(3)

  await page.locator('.level-chip').filter({ hasText: 'Error' }).click()
  await expect(page.locator('.log-row')).toHaveCount(2)

  const jsonRow = page.locator('.log-row').filter({ has: page.locator('.json-mark') })
  await expect(jsonRow).toHaveCount(1)
  await jsonRow.click()
  const inspector = page.locator('.inspector')
  await expect(inspector).toBeVisible()
  await expect(inspector).toContainText('Raw line')
  await expect(inspector).toContainText('JSON body')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).first().click()
  await page.getByRole('menuitem', { name: /Raw \.txt/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('flow.txt')
  const path = await download.path()
  expect(path).not.toBeNull()
  const exported = readFileSync(path ?? '', 'utf8')
  expect(exported.split('\n')).toHaveLength(2)
  expect(exported).toContain('payment declined')
  expect(exported).toContain('"level":"error"')
  await page.keyboard.press('Escape')

  await page.locator('.stream-tab.selected .close').click()
  await expect(page.getByRole('dialog', { name: 'Close flow?' })).toBeVisible()
  await page.getByRole('button', { name: 'Close tab' }).click()
  await expect(page.getByRole('tab', { name: /flow/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No streams yet' })).toBeVisible()
  const exitCode = await pipe.exited
  expect(exitCode).toBe(0)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('pause freezes the rows while counts and buffers keep moving', async ({ page }) => {
  const pipe = await seed(
    page,
    'pause',
    Array.from({ length: 5 }, (_, index) => line(index + 1)),
  )
  const consoleWatch = watchConsole(page)

  const newest = page.locator('.log-row .seq').first()
  await expect(newest).toHaveText('5')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.locator('.pause-banner')).toContainText('Paused')

  await pipe.write([line(6), line(7), line(8)])
  await expect(page.locator('.pause-banner')).toContainText('3 new lines buffered')
  await expect(page.getByRole('tab', { name: /pause 8/ })).toBeVisible()
  await expect(newest).toHaveText('5')

  await page.locator('.pause-banner .link').click()
  await expect(page.locator('.pause-banner')).toHaveCount(0)
  await expect(page.locator('.log-row .seq').first()).toHaveText('8')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('tabs rename inline and the theme toggles', async ({ page }) => {
  const pipe = await seed(page, 'rename', [line(1)])
  const consoleWatch = watchConsole(page)

  await page.locator('.stream-tab.selected .tab-target').dblclick()
  const input = page.locator('.tab-rename')
  await expect(input).toBeFocused()
  await input.fill('renamed-tab')
  await input.press('Enter')
  await expect(page.getByRole('tab', { name: /renamed-tab/ })).toBeVisible()

  const before = await page.locator('html').getAttribute('data-theme')
  await page.getByRole('button', { name: 'Switch theme' }).first().click()
  const after = await page.locator('html').getAttribute('data-theme')
  expect(after).not.toBe(before)
  await expect(page.locator('.log-row').first()).toBeVisible()

  pipe.end()
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
