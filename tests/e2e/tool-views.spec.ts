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

async function seed(page: import('@playwright/test').Page): Promise<void> {
  const pipe = startPipe('views')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('views')
  await page.goto('/')
  await expect(page.getByRole('tab', { name: /views/ })).toBeVisible()
}

test.beforeEach(async () => {
  await clearStreams()
})

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('tool views replace the log area without a dialog', async ({ page }) => {
  await seed(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'Compare JSON' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.view-slot:not([hidden]) .tool-view-title')).toHaveText('Compare JSON')
  await expect(page.getByRole('button', { name: 'Compare JSON' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await page.getByRole('button', { name: 'Pretty JSON' }).click()
  await expect(page.locator('.view-slot:not([hidden]) .tool-view-title')).toHaveText('Pretty JSON')

  await page.getByRole('button', { name: 'Merge log' }).click()
  await expect(page.locator('.view-slot:not([hidden]) .tool-view-title')).toHaveText('Merge log')

  await page.getByRole('button', { name: 'Streams', exact: true }).click()
  await expect(page.locator('.view-slot:not([hidden]) .log-panel')).toBeVisible()

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('tool view content survives a round trip to the logs', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Compare JSON' }).click()
  const view = page.locator('.view-slot:not([hidden]) .tool-view')
  await view.getByRole('button', { name: 'Load sample' }).click()
  await expect(view.locator('.diff-row')).toHaveCount(19)

  await page.getByRole('button', { name: 'Streams', exact: true }).click()
  await expect(page.locator('.view-slot:not([hidden]) .log-panel')).toBeVisible()

  await page.getByRole('button', { name: 'Compare JSON' }).click()
  await expect(page.locator('.view-slot:not([hidden]) .diff-row')).toHaveCount(19)
})

test('Escape returns from a tool view to the logs', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Pretty JSON' }).click()
  await expect(page.locator('.view-slot:not([hidden]) .tool-view-title')).toHaveText('Pretty JSON')
  await page.keyboard.press('Escape')
  await expect(page.locator('.view-slot:not([hidden]) .log-panel')).toBeVisible()
})

test('the export menu is disabled in compare and pretty', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Compare JSON' }).click()
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled()
  await page.getByRole('button', { name: 'Pretty JSON' }).click()
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled()
  await page.getByRole('button', { name: 'Streams', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled()
})

test('no stream tab claims selection while a tool view is shown', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Compare JSON' }).click()
  const tabs = page.locator('.stream-tab[aria-selected="true"]')
  await expect(tabs).toHaveCount(0)
})

test('settings shows the daemon version and help lists the sections', async ({ page }) => {
  await seed(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await expect(settings.locator('.version-readout')).toContainText('logdeck')
  await expect(settings.locator('.version-sub')).toContainText('pid')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Help and shortcuts' }).click()
  const help = page.getByRole('dialog', { name: 'Help and shortcuts' })
  await expect(help.locator('.help-section')).toHaveCount(5)
  await expect(help).toContainText('CLI flags')
  await expect(help).toContainText('--buffer-cap')
  await expect(help).toContainText('Find what matters')
  await expect(help.locator('.help-about-main')).toContainText('logdeck')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
