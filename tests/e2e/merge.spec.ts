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

async function seedTwo(page: import('@playwright/test').Page): Promise<void> {
  const first = startPipe('ms-user-1ahdss')
  const second = startPipe('ms-user-1kjwnd')
  pipes.push(first, second)
  await first.write([line(1, 'ERROR', 'first stream failed')])
  await second.write([line(2, 'INFO', 'second stream loaded')])
  await waitForStream('ms-user-1ahdss')
  await waitForStream('ms-user-1kjwnd')
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

test('merge combines two streams with a source column', async ({ page }) => {
  await seedTwo(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'Merge log' }).click()
  const view = page.locator('.view-slot:not([hidden]) .tool-view')
  await expect(view).toBeVisible()
  await expect(view.locator('.tool-view-title')).toHaveText('Merge log')

  await view
    .getByRole('button', { name: /Select streams|streams/ })
    .first()
    .click()
  const selector = page.getByRole('dialog', { name: 'Select streams to merge' })
  await expect(selector).toBeVisible()
  const boxes = selector.locator('.merge-selector-item input')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await selector.getByRole('button', { name: /^Merge \d/ }).click()

  await expect(view.locator('.merge-row')).toHaveCount(2)
  await expect(view.locator('.merge-row .source')).toHaveCount(2)
  const sources = await view.locator('.merge-row .source').allTextContents()
  expect(sources.join(' ')).toContain('ms-user-1ahdss')
  expect(sources.join(' ')).toContain('ms-user-1kjwnd')

  const head = await view.locator('.merge-head').textContent()
  expect(head).toContain('stream')
  expect(head?.indexOf('time')).toBeLessThan(head?.indexOf('stream') ?? 0)
  expect(head?.indexOf('stream')).toBeLessThan(head?.indexOf('level') ?? 0)

  await view.locator('.merge-row').first().click()
  await expect(view.locator('.inspector')).toContainText('stream')

  await page.getByRole('button', { name: 'Streams', exact: true }).click()
  await expect(page.locator('.view-slot:not([hidden]) .log-panel')).toBeVisible()

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('merge search matches the source stream name', async ({ page }) => {
  await seedTwo(page)
  await page.getByRole('button', { name: 'Merge log' }).click()
  const view = page.locator('.view-slot:not([hidden]) .tool-view')
  await view
    .getByRole('button', { name: /Select streams|streams/ })
    .first()
    .click()
  const selector = page.getByRole('dialog', { name: 'Select streams to merge' })
  const boxes = selector.locator('.merge-selector-item input')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await selector.getByRole('button', { name: /^Merge \d/ }).click()
  await expect(view.locator('.merge-row')).toHaveCount(2)

  await view.getByLabel('Search streams and logs').fill('1ahdss')
  await expect(view.locator('.merge-row')).toHaveCount(1)
  await expect(view.locator('.merge-row .source')).toContainText('ms-user-1ahdss')
})

test('merge shows the empty state below two streams', async ({ page }) => {
  await seedTwo(page)
  await page.getByRole('button', { name: 'Merge log' }).click()
  const view = page.locator('.view-slot:not([hidden]) .tool-view')
  await expect(view.getByText('Select at least two streams to merge.')).toBeVisible()
})

test('merge view works at 390 without horizontal overflow', async ({ page }) => {
  await seedTwo(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Merge log' }).click()
  await page.waitForTimeout(120)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)
})

test('merge keeps the table full width and hides the inspector until a row is clicked', async ({
  page,
}) => {
  await seedTwo(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('button', { name: 'Merge log' }).click()
  const view = page.locator('.view-slot:not([hidden]) .tool-view')
  const shell = view.locator('.log-shell')

  await expect(shell).toHaveClass(/no-inspector/)
  await expect(view.locator('.inspector')).toHaveCount(0)

  await view
    .getByRole('button', { name: /Select streams|streams/ })
    .first()
    .click()
  const selector = page.getByRole('dialog', { name: 'Select streams to merge' })
  const boxes = selector.locator('.merge-selector-item input')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await selector.getByRole('button', { name: /^Merge \d/ }).click()

  await expect(view.locator('.merge-row')).toHaveCount(2)
  await expect(shell).toHaveClass(/no-inspector/)
  await expect(view.locator('.inspector')).toHaveCount(0)

  const fullWidth = await view.locator('.log-panel').evaluate((node) => node.clientWidth)

  await view.locator('.merge-row').first().click()
  await expect(shell).not.toHaveClass(/no-inspector/)
  await expect(view.locator('.inspector')).toBeVisible()
  const splitWidth = await view.locator('.log-panel').evaluate((node) => node.clientWidth)
  expect(splitWidth).toBeLessThan(fullWidth)

  await view.getByRole('button', { name: 'Close inspector' }).click()
  await expect(shell).toHaveClass(/no-inspector/)
  const restored = await view.locator('.log-panel').evaluate((node) => node.clientWidth)
  expect(restored).toBe(fullWidth)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('merge inspector resizes and shares its width with the stream view', async ({ page }) => {
  await seedTwo(page)
  const consoleWatch = watchConsole(page)

  await page.getByRole('tab', { name: /ms-user-1ahdss/ }).click()
  await page.locator('.view-slot:not([hidden]) .log-row').first().click()
  const streamInspector = page.locator('.view-slot:not([hidden]) .inspector')
  await expect(streamInspector).toBeVisible()
  const originalWidth = await streamInspector.evaluate((node) => node.clientWidth)

  const resizer = page.locator('.view-slot:not([hidden]) .inspector-resizer')
  const box = await resizer.boundingBox()
  if (box === null) throw new Error('no resizer box')
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 80, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  const widened = await streamInspector.evaluate((node) => node.clientWidth)
  expect(widened).toBeGreaterThan(originalWidth)

  await page.getByRole('button', { name: 'Merge log' }).click()
  const view = page.locator('.view-slot:not([hidden]) .tool-view')
  await view
    .getByRole('button', { name: /Select streams|streams/ })
    .first()
    .click()
  const selector = page.getByRole('dialog', { name: 'Select streams to merge' })
  const boxes = selector.locator('.merge-selector-item input')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await selector.getByRole('button', { name: /^Merge \d/ }).click()
  await view.locator('.merge-row').first().click()

  const mergeInspector = view.locator('.inspector')
  await expect(mergeInspector).toBeVisible()
  const mergeWidth = await mergeInspector.evaluate((node) => node.clientWidth)
  expect(mergeWidth).toBe(widened)

  await page.reload()
  await page.getByRole('tab', { name: /ms-user-1ahdss/ }).click()
  await page.locator('.view-slot:not([hidden]) .log-row').first().click()
  const persisted = await page
    .locator('.view-slot:not([hidden]) .inspector')
    .evaluate((node) => node.clientWidth)
  expect(persisted).toBe(widened)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
