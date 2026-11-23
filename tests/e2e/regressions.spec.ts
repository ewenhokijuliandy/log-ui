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

test('pretty JSON keeps a long minified line inside its card', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('pretty-long')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('pretty-long')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Pretty JSON' }).click()
  const view = page.locator('.view-slot:not([hidden])')

  const longJson = JSON.stringify({
    items: Array.from({ length: 40 }, (_, index) => ({
      sku: `SKU-${String(4000 + index)}`,
      qty: index,
    })),
  })
  await view.getByLabel('JSON in').fill(longJson)
  await view.getByRole('button', { name: 'Minify' }).click()
  await view.getByRole('button', { name: 'Prettify' }).click()

  const output = view.locator('.diff-output')
  await expect(output).toContainText('SKU-4000')

  const box = await output.boundingBox()
  const card = await view.locator('.diff-input-card').nth(1).boundingBox()
  expect(box).not.toBeNull()
  expect(card).not.toBeNull()
  if (box === null || card === null) throw new Error('missing boxes')
  expect(box.width).toBeLessThanOrEqual(card.width)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})

test('compare diffs every line of a 3000-line input', async ({ page }) => {
  const consoleWatch = watchConsole(page)
  const pipe = startPipe('compare-long')
  pipes.push(pipe)
  await pipe.write([line(1)])
  await waitForStream('compare-long')

  await page.goto('/')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Compare JSON' }).click()
  const view = page.locator('.view-slot:not([hidden])')

  const build = (mutate: boolean): string =>
    JSON.stringify(
      Object.fromEntries(
        Array.from({ length: 3000 }, (_, index) => [
          `key_${String(index)}`,
          mutate && index === 1500 ? 'CHANGED' : index,
        ]),
      ),
    )

  await view.getByLabel('A · before').fill(build(false))
  await view.getByLabel('B · after').fill(build(true))
  await view.getByRole('button', { name: 'Compare', exact: true }).click()

  await expect(view.locator('.diff-row')).toHaveCount(3002)
  await expect(view.locator('.diff-row.changed')).toHaveCount(1)
  await expect(view.locator('.diff-summary')).toContainText('3002 lines compared')

  expect(unexpectedConsole(consoleWatch.problems)).toEqual([])
})
