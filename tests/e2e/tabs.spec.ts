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

async function seedTabs(page: import('@playwright/test').Page): Promise<void> {
  const names = ['ms-user-1ahdss', 'ms-user-1kjwnd', 'api-gateway']
  for (const name of names) {
    const pipe = startPipe(name)
    pipes.push(pipe)
    await pipe.write([line(1)])
    await waitForStream(name)
  }
  await page.goto('/')
  await expect(page.getByRole('tab', { name: /ms-user-1ahdss/ })).toBeVisible()
}

test.beforeEach(async () => {
  await clearStreams()
})

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('the tab finder filters by name and activates a tab', async ({ page }) => {
  await seedTabs(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'Find a tab' }).click()
  const finder = page.getByRole('dialog', { name: 'Find a tab' })
  await expect(finder).toBeVisible()
  await expect(finder.locator('.tab-finder-option')).toHaveCount(3)

  await finder.getByLabel('Filter streams by name').fill('ms-user')
  await expect(finder.locator('.tab-finder-option')).toHaveCount(2)
  await expect(finder.locator('.tab-finder-count')).toContainText('2 of 3')

  await finder.getByLabel('Filter streams by name').fill('gateway')
  await expect(finder.locator('.tab-finder-option')).toHaveCount(1)
  await finder.locator('.tab-finder-option').first().click()
  await expect(finder).not.toBeVisible()
  await expect(page.getByRole('tab', { name: /api-gateway/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('the tab finder shows a no-match state and clears it', async ({ page }) => {
  await seedTabs(page)
  await page.getByRole('button', { name: 'Find a tab' }).click()
  const finder = page.getByRole('dialog', { name: 'Find a tab' })
  await finder.getByLabel('Filter streams by name').fill('zzz-nothing')
  await expect(finder.locator('.tab-finder-option')).toHaveCount(0)
  await expect(finder.locator('.tab-finder-empty')).toBeVisible()
  await finder.getByRole('button', { name: 'Clear' }).click()
  await expect(finder.locator('.tab-finder-option')).toHaveCount(3)
})

test('Cmd/Ctrl+K opens the tab finder', async ({ page }) => {
  await seedTabs(page)
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog', { name: 'Find a tab' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Find a tab' })).not.toBeVisible()
})

test('close all tabs confirms and empties the workspace', async ({ page }) => {
  await seedTabs(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'Tab actions' }).click()
  await page.getByRole('menuitem', { name: /Close all tabs/ }).click()

  const confirm = page.getByRole('dialog', { name: /Close all 3 tabs/ })
  await expect(confirm).toBeVisible()
  await expect(confirm).toContainText('This closes 3 streams and ends their pipes.')

  await confirm.getByRole('button', { name: 'Close all tabs' }).click()
  await expect(page.locator('.stream-tab')).toHaveCount(0)
  await expect(page.getByText('No streams yet')).toBeVisible()

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('cancelling close all keeps every tab', async ({ page }) => {
  await seedTabs(page)
  await page.getByRole('button', { name: 'Tab actions' }).click()
  await page.getByRole('menuitem', { name: /Close all tabs/ }).click()
  const confirm = page.getByRole('dialog', { name: /Close all 3 tabs/ })
  await confirm.getByRole('button', { name: 'Keep open' }).click()
  await expect(page.locator('.stream-tab')).toHaveCount(3)
})

test('the tab strip keeps its controls visible at 390', async ({ page }) => {
  await seedTabs(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(120)
  await expect(page.getByRole('button', { name: 'Find a tab' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tab actions' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open quick start' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)
})
