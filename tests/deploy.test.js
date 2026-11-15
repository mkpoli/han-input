import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deployProblem, distProblem, optionsOf } from '../scripts/deploy.mjs'

const main = 'c4ab02f0000000000000000000000000000000ff'

test('uploads only merged main as it stands', () => {
  expect(deployProblem({ head: main, main, dirty: [] })).toBe(null)
  expect(deployProblem({ head: '7c945f1000000000000000000000000000000000', main, dirty: [] })).toBe('HEAD 7c945f100 is not origin/main c4ab02f00')
  expect(deployProblem({ head: main, main, dirty: [' M src/strokes.js', '?? notes.txt'] })).toBe('the checkout has uncommitted changes:  M src/strokes.js, ?? notes.txt')
})

test('takes --dry-run and refuses anything else', () => {
  expect(optionsOf([])).toEqual({ dry: false })
  expect(optionsOf(['--dry-run'])).toEqual({ dry: true })
  // A mistyped flag must not fall through to an upload.
  for (const arg of ['--dryrun', '--dry', '-n', 'main']) expect(optionsOf([arg])).toEqual({ unknown: arg })
  expect(optionsOf(['--dry-run', '--force'])).toEqual({ unknown: '--force' })
})

test('refuses a built site without its page, its data or the mark of its commit', () => {
  const dist = mkdtempSync(join(tmpdir(), 'han-input-dist-'))
  try {
    expect(distProblem(dist, main)).toBe('dist/index.html is missing')
    writeFileSync(join(dist, 'index.html'), '<!doctype html>')
    expect(distProblem(dist, main)).toBe('dist/data/methods.json is missing')
    mkdirSync(join(dist, 'data'))
    writeFileSync(join(dist, 'data', 'methods.json'), '[]')
    expect(distProblem(dist, main)).toBe('dist/data/methods.json lists nothing')
    writeFileSync(join(dist, 'data', 'methods.json'), '[{"id":"cns-stroke-order"}]')
    // The readings are built by their own script; a site without them is not whole.
    expect(distProblem(dist, main)).toBe('dist/data/varieties.json is missing')
    writeFileSync(join(dist, 'data', 'varieties.json'), '[{"id":0}]')
    expect(distProblem(dist, main)).toBe('dist/data/build.json is missing')
    // A mark left by a build of another commit is not this one's.
    writeFileSync(join(dist, 'data', 'build.json'), '{"commit":"7c945f1000000000000000000000000000000000"}')
    expect(distProblem(dist, main)).toBe('dist/data/build.json names another commit')
    writeFileSync(join(dist, 'data', 'build.json'), JSON.stringify({ commit: main }))
    expect(distProblem(dist, main)).toBe(null)
  } finally { rmSync(dist, { recursive: true, force: true }) }
})
