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

test.beforeEach(async () => {
  await clearStreams()
})

test.afterEach(async () => {
  for (const pipe of pipes.splice(0)) pipe.end()
  await clearStreams()
})

test('formats a messy query from the rail', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('gql-a')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('gql-a')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'GraphQL' }).click()

  const view = page.locator('.view-slot:not([hidden])')
  await expect(view.locator('.tool-view-title')).toHaveText('GraphQL')

  await view.getByLabel('GraphQL in').fill('query { user { id name } }')
  await view.getByRole('button', { name: 'Format' }).click()

  const output = view.getByLabel('Formatted GraphQL')
  await expect(output).toContainText('query {')
  await expect(output).toContainText('  user {')
  await expect(output).toContainText('    id')

  await expect(output.locator('.gql-keyword').first()).toBeVisible()
  await expect(output.locator('.gql-field').first()).toBeVisible()

  await expect(view.locator('.diff-summary')).toContainText('6 lines')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('reports unbalanced input instead of emitting mangled output', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('gql-b')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('gql-b')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'GraphQL' }).click()

  const view = page.locator('.view-slot:not([hidden])')
  await view.getByLabel('GraphQL in').fill('query { user { id }')
  await view.getByRole('button', { name: 'Format' }).click()

  await expect(view.getByRole('alert')).toContainText('Unbalanced braces.')
  await expect(view.getByLabel('Formatted GraphQL')).toContainText(
    'Formatted GraphQL appears here.',
  )

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
