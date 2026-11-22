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

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('the sidebar shows labels by default and collapses to icons', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('rail-a')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('rail-a')

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Streams' })).toBeVisible()

  const rail = page.locator('.rail')
  await expect(rail).toHaveClass(/rail-expanded/)
  await expect(page.locator('.rail-label').filter({ hasText: 'Streams' })).toBeVisible()
  await expect(page.locator('.rail-group-label').first()).toBeVisible()

  await page.getByRole('button', { name: 'Collapse the sidebar' }).click()
  await expect(rail).not.toHaveClass(/rail-expanded/)
  await expect(page.locator('.rail-label').filter({ hasText: 'Streams' })).toBeHidden()

  await page.reload()
  await expect(page.locator('.rail')).not.toHaveClass(/rail-expanded/)

  await page.getByRole('button', { name: 'Expand the sidebar' }).click()
  await expect(page.locator('.rail')).toHaveClass(/rail-expanded/)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('the phone bar keeps five labelled items', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('rail-b')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('rail-b')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const visible = page.locator('.rail-btn:visible')
  await expect(visible).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Manual mode' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Settings' })).toBeHidden()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
