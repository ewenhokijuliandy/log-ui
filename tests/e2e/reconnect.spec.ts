import { expect, test } from '@playwright/test'
import {
  clearStreams,
  line,
  type Pipe,
  shutdownDaemon,
  startDaemon,
  startPipe,
  unexpectedConsole,
  waitForHealth,
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

test('a real daemon restart reconnects, resyncs, and clears stale streams', async ({ page }) => {
  test.setTimeout(90_000)
  const pipe = startPipe('reconnect')
  pipes.push(pipe)
  await pipe.write([line(1), line(2)])
  await waitForStream('reconnect')

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'connected' })).toBeVisible()
  await expect(page.locator('.log-row').first()).toBeVisible()
  const consoleWatch = watchConsole(page)

  await shutdownDaemon()
  await expect(page.getByRole('button', { name: 'reconnecting' })).toBeVisible()
  const banner = page.locator('.banner').filter({ hasText: 'Connection to the daemon lost' })
  await expect(banner).toBeVisible()

  startDaemon()
  await waitForHealth(15_000)
  await expect(page.getByRole('button', { name: 'connected' })).toBeVisible({ timeout: 30_000 })
  await expect(banner).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No streams yet' })).toBeVisible()

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('a reconnect keeps browser-only manual tabs', async ({ page }) => {
  test.setTimeout(90_000)
  const pipe = startPipe('manual-reconnect')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('manual-reconnect')

  await page.goto('/')
  await expect(page.getByRole('tab', { name: /manual-reconnect/ })).toBeVisible()
  await page.getByRole('button', { name: 'Manual mode' }).first().click()
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('button', { name: 'Parse logs' }).click()
  await expect(page.getByRole('tab', { name: /manual-1/ })).toBeVisible()
  await expect(page.locator('.status-pill')).toContainText('MANUAL')
  const consoleWatch = watchConsole(page)

  await shutdownDaemon()
  startDaemon()
  await waitForHealth(15_000)
  await expect(page.getByRole('button', { name: 'connected' })).toBeVisible({ timeout: 30_000 })

  await expect(page.getByRole('tab', { name: /manual-1/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.status-pill')).toContainText('MANUAL')
  await expect(page.getByRole('tab', { name: /manual-reconnect/ })).toHaveCount(0)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
