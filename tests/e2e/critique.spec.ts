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
  name = 'e2e',
  count = 40,
): Promise<Pipe> {
  const pipe = startPipe(name)
  pipes.push(pipe)
  const lines = Array.from({ length: count }, (_, index) => {
    if (index === 8) return jsonLine(index)
    return line(index, index % 7 === 0 ? 'ERROR' : 'INFO')
  })
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

test('dialogs expose accessible names and restore focus', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  await page.goto('/')

  const quick = page.getByRole('dialog', { name: 'Quick start' })
  await expect(quick).toBeVisible()
  await quick.getByRole('button', { name: 'Close quick start' }).click()
  await expect(quick).not.toBeVisible()

  const settingsButton = page.getByRole('button', { name: 'Settings' })
  await settingsButton.click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(settingsButton).toBeFocused()

  await page.getByRole('button', { name: 'Manual mode' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Manual mode' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Help and shortcuts' }).click()
  await expect(page.getByRole('dialog', { name: 'Help and shortcuts' })).toBeVisible()
  await page.keyboard.press('Escape')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('global shortcuts are inert while a dialog is open', async ({ page }) => {
  const pipe = await seed(page)
  const consoleWatch = watchConsole(page)
  const themeBefore = await page.locator('html').getAttribute('data-theme')

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()

  await page.keyboard.press('t')
  await expect(page.locator('html')).toHaveAttribute('data-theme', themeBefore ?? 'dark')

  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Help and shortcuts' })).toHaveCount(0)

  await page.keyboard.press('j')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()

  pipe.end()
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('the export menu is keyboard reachable', async ({ page }) => {
  await seed(page)
  const consoleWatch = watchConsole(page)
  const trigger = page.getByRole('button', { name: 'Export' }).first()

  await trigger.focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Export' })
  await expect(menu).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Raw \.txt/ })).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: /Formatted \.pdf/ })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('connection and stopped banners are live regions', async ({ page }) => {
  const pipe = await seed(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'connected' }).click()
  await page.getByRole('menuitem', { name: /Simulate connection loss/ }).click()
  const connectionBanner = page
    .locator('.banner')
    .filter({ hasText: 'Connection to the daemon lost' })
  await expect(connectionBanner).toBeVisible()
  await expect(connectionBanner).toHaveAttribute('role', 'status')

  await page.getByRole('button', { name: 'Retry now' }).click()
  await expect(connectionBanner).not.toBeVisible()

  pipe.end()
  const stoppedBanner = page.locator('.banner').filter({ hasText: 'The pipe for e2e ended' })
  await expect(stoppedBanner).toBeVisible()
  await expect(stoppedBanner).toHaveAttribute('role', 'status')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('invalid regex is explained next to the search field', async ({ page }) => {
  await seed(page)
  const consoleWatch = watchConsole(page)

  await page.locator('.regex').click()
  await expect(page.getByRole('button', { name: 'Regular expression' })).toBeVisible()
  await page.getByLabel('Search logs').fill('(')

  const searchError = page.locator('.search-error')
  await expect(searchError).toBeVisible()
  await expect(searchError).toContainText('Invalid regular expression')
  await expect(page.locator('.log-empty')).toContainText(/not a valid regular expression/i)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('manual mode rejects unsupported files with an alert', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Close quick start' }).click()
  await page.getByRole('button', { name: 'Manual mode' }).first().click()

  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  })

  const guard = page.locator('.guard')
  await expect(guard).toContainText('accepts .txt and .log files')
  await expect(guard).toHaveAttribute('role', 'alert')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('a failed boot shows an error and retry', async ({ page }) => {
  await page.route('**/api/streams', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Close quick start' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('daemon is unreachable')

  await page.unroute('**/api/streams')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(alert).toHaveCount(0)
})

test('the detail sheet opens at 768 from a row, Enter, and the rail', async ({ page }) => {
  const pipe = await seed(page)
  const consoleWatch = watchConsole(page)
  await page.setViewportSize({ width: 768, height: 900 })

  const row = page.locator('.log-row').first()
  await row.click()
  const sheet = page.getByRole('dialog', { name: /Line \d/ })
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('.raw')).toBeVisible()
  await expect(sheet).toContainText('Raw line')
  await page.keyboard.press('Escape')
  await expect(sheet).not.toBeVisible()
  await expect(row).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Line detail' }).click()
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')

  pipe.end()
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('tabs use arrow keys and the add button stays visible at 390', async ({ page }) => {
  const firstPipe = startPipe('tabs-a')
  pipes.push(firstPipe)
  const secondPipe = startPipe('tabs-b')
  pipes.push(secondPipe)
  await firstPipe.write([line(1)])
  await secondPipe.write([line(1)])
  await waitForStream('tabs-a')
  await waitForStream('tabs-b')
  await page.goto('/')
  await page.setViewportSize({ width: 390, height: 844 })

  const first = page.locator('.tab-target').first()
  const second = page.locator('.tab-target').nth(1)
  await expect(first).toBeVisible()
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(second).toBeFocused()
  await expect(second).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(second).toBeFocused()

  const add = page.getByRole('button', { name: 'Open quick start' })
  const box = await add.boundingBox()
  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
})

test('log rows expose list semantics and one roving tab stop', async ({ page }) => {
  const pipe = await seed(page, 'rows', 20)
  const consoleWatch = watchConsole(page)

  await expect(page.locator('.log-list')).toHaveAttribute('role', 'list')
  const selected = page.locator('.log-row[aria-current="true"]')
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveAttribute('tabindex', '0')
  await expect(page.locator('.log-row:not([aria-current="true"])').first()).toHaveAttribute(
    'tabindex',
    '-1',
  )

  pipe.end()
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('the tab favicon is the log-ui mark', async ({ page, request }) => {
  const response = await request.get('/favicon.svg')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/svg+xml')

  await page.goto('/')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
})

test('phone targets meet the 24px minimum', async ({ page }) => {
  const pipe = await seed(page, 'targets', 10)
  await page.setViewportSize({ width: 390, height: 844 })

  const closeBox = await page.locator('.stream-tab .close').first().boundingBox()
  expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(24)
  expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(24)

  const regexBox = await page.locator('.regex').boundingBox()
  expect(regexBox?.width ?? 0).toBeGreaterThanOrEqual(24)
  expect(regexBox?.height ?? 0).toBeGreaterThanOrEqual(24)

  pipe.end()
})
