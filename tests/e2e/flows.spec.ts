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

test('level chips hide unknown rows and combine levels', async ({ page }) => {
  await seed(page, 'levels', [
    line(1, 'INFO', 'ready'),
    line(2, 'WARN', 'slow'),
    line(3, 'ERROR', 'failed'),
    'plain continuation line',
  ])
  const consoleWatch = watchConsole(page)

  const unknownChip = page.locator('.level-chip').filter({ hasText: 'Unknown' })
  await expect(unknownChip.locator('.count')).toHaveText('1')

  await page.locator('.level-chip').filter({ hasText: 'Info' }).click()
  await expect(page.locator('.log-row')).toHaveCount(1)
  await expect(page.locator('.log-row').filter({ hasText: 'plain continuation' })).toHaveCount(0)

  await page.locator('.level-chip').filter({ hasText: 'Warn' }).click()
  await expect(page.locator('.log-row')).toHaveCount(2)

  await unknownChip.click()
  await expect(page.locator('.log-row')).toHaveCount(3)
  await expect(page.locator('.log-row').filter({ hasText: 'plain continuation' })).toHaveCount(1)

  await page.locator('.level-chip').filter({ hasText: 'All' }).click()
  await expect(page.locator('.log-row')).toHaveCount(4)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('parsing rules reparse retained lines and persist', async ({ page }) => {
  await seed(page, 'rules', [
    line(1, 'INFO', 'normal line'),
    '{"sev":"error","when":"2026-10-27T12:00:00.000Z","text":"custom rules apply"}',
  ])
  const consoleWatch = watchConsole(page)

  const target = page.locator('.log-row').filter({ hasText: 'custom rules apply' })
  await expect(target.locator('.level')).toContainText('UNKNOWN')

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Edit rules' }).click()
  await page.getByLabel('JSON level keys').fill('sev')
  await page.getByLabel('JSON time keys').fill('when')
  await page.getByLabel('JSON message keys').fill('text')
  await page
    .getByLabel('Test a line')
    .fill('{"sev":"error","when":"2026-10-27T12:00:00.000Z","text":"custom rules apply"}')
  await expect(page.locator('.rules-preview')).toContainText('ERROR')
  await page.getByRole('button', { name: 'Save rules' }).click()

  await expect(target.locator('.level')).toContainText('ERROR')
  await expect(target.locator('.time')).toContainText('12:00:00.000')

  await page.reload()
  await expect(
    page.locator('.log-row').filter({ hasText: 'custom rules apply' }).locator('.level'),
  ).toContainText('ERROR')
  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('inspector switches JSON views, wraps and expands the tree', async ({ page }) => {
  await seed(page, 'inspect', [jsonLine(1)])
  const consoleWatch = watchConsole(page)

  await page.locator('.log-row').first().click()
  const inspector = page.locator('.inspector')
  await expect(inspector).toBeVisible()
  await expect(inspector).toContainText('JSON body')
  await expect(inspector.locator('.json-tree')).toBeVisible()
  await expect(inspector.locator('.raw')).toBeHidden()

  await inspector.getByRole('button', { name: 'Pretty', exact: true }).click()
  await expect(inspector.locator('.json-pretty')).toBeVisible()
  await expect(inspector.locator('.json-pretty')).toContainText('"order"')
  await inspector.getByRole('button', { name: 'Wrap', exact: true }).click()
  await expect(inspector.locator('.json-pretty')).toHaveClass(/wrap/)

  await inspector.getByRole('button', { name: 'Tree', exact: true }).click()
  await expect(inspector.locator('.json-tree details[open]')).toHaveCount(1)
  await inspector.getByRole('button', { name: 'Collapse', exact: true }).click()
  await expect(inspector.locator('.json-tree details[open]')).toHaveCount(0)
  await inspector.getByRole('button', { name: 'Expand', exact: true }).click()
  await expect(inspector.locator('.json-tree details[open]')).toHaveCount(1)

  await inspector.locator('.raw-block summary').click()
  await expect(inspector.locator('.raw')).toBeVisible()

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('toolbar stays on one row or a compact two-row layout without overflow', async ({ page }) => {
  await seed(page, 'toolbar', [line(1, 'INFO', 'ready'), line(2, 'ERROR', 'failed')])
  const consoleWatch = watchConsole(page)

  const widths = [1440, 1280, 1181, 1024, 900, 768, 390]
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(80)
    const metrics = await page.evaluate(() => {
      const bar = document.querySelector('.toolbar') as HTMLElement
      const chips = document.querySelector('.level-filters') as HTMLElement
      const levels = document.querySelector('#levels-trigger') as HTMLElement
      const more = document.querySelector('#more-trigger') as HTMLElement
      const visible = (node: HTMLElement) => getComputedStyle(node).display !== 'none'
      return {
        overflow: bar.scrollWidth > bar.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        height: Math.round(bar.getBoundingClientRect().height),
        chips: visible(chips),
        levels: visible(levels),
        more: visible(more),
        unnamed: Array.from(bar.querySelectorAll('button')).filter((button) => {
          const text = (button.textContent ?? '').trim()
          const label = button.getAttribute('aria-label') ?? ''
          return text.length === 0 && label.length === 0
        }).length,
      }
    })
    expect(metrics.overflow, `toolbar overflow at ${String(width)}`).toBe(false)
    expect(metrics.pageOverflow, `page overflow at ${String(width)}`).toBe(false)
    expect(metrics.unnamed, `unnamed toolbar buttons at ${String(width)}`).toBe(0)
    if (width === 1440 || width === 1280 || width === 1181) {
      expect(metrics.chips).toBe(true)
      expect(metrics.levels).toBe(false)
      expect(metrics.more).toBe(false)
      expect(metrics.height).toBeLessThan(50)
    }
    if (width === 1024) {
      expect(metrics.chips).toBe(false)
      expect(metrics.levels).toBe(true)
      expect(metrics.more).toBe(true)
      expect(metrics.height).toBeLessThan(50)
    }
    if (width === 768 || width === 390) {
      expect(metrics.chips).toBe(true)
      expect(metrics.levels).toBe(false)
      expect(metrics.more).toBe(true)
      expect(metrics.height).toBeGreaterThan(50)
    }
  }

  await page.setViewportSize({ width: 1024, height: 900 })
  await page.waitForTimeout(80)
  await page.locator('#levels-trigger').click()
  const levelsMenu = page.getByRole('menu', { name: 'Filter by level' })
  await expect(levelsMenu).toBeVisible()
  await levelsMenu.getByRole('menuitemcheckbox', { name: /Info/ }).click()
  await expect(page.locator('.log-row')).toHaveCount(1)
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 768, height: 900 })
  await page.waitForTimeout(80)
  await page.locator('#more-trigger').click()
  const moreMenu = page.getByRole('menu', { name: 'More tools' })
  await expect(moreMenu).toBeVisible()
  await moreMenu.getByRole('menuitem', { name: /Word wrap/ }).click()
  await expect(page.locator('.log-list')).toHaveClass(/wrap/)

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
