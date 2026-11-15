// Deploys the site: a clean build of merged main, uploaded with wrangler.
//   bun run deploy              build the data and the site, then upload
//   bun run deploy --dry-run    build, and let wrangler check the upload without making it
// An upload is refused unless the checkout is origin/main with nothing uncommitted. The data build
// reads the cache (cache/, or the directory HAN_INPUT_CACHE names): the pinned downloads, the
// database unpacked from 漢字音典's APK and the privately supplied frequency table. The data is about
// 300 MB and comes from files that are not in the repository, which is why this runs where the
// cache is and not in CI.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SITE = 'https://han.mkpo.li'
const WRANGLER = 'wrangler@4.156.0'

/**
 * Why this checkout may not be uploaded, or null when it is merged main as it stands.
 * @param {{ head: string, main: string, dirty: string[] }} state
 */
export function deployProblem({ head, main, dirty }) {
  if (dirty.length) return `the checkout has uncommitted changes: ${dirty.slice(0, 3).join(', ')}${dirty.length > 3 ? ', …' : ''}`
  if (head !== main) return `HEAD ${head.slice(0, 9)} is not origin/main ${main.slice(0, 9)}`
  return null
}

/**
 * What is wrong with a built site, or null: the page, and every method the data build made.
 * @param {string} dist
 */
export function distProblem(dist) {
  if (!existsSync(join(dist, 'index.html'))) return 'dist/index.html is missing'
  for (const file of ['data/methods.json', 'data/varieties.json']) {
    if (!existsSync(join(dist, file))) return `dist/${file} is missing`
    const list = JSON.parse(readFileSync(join(dist, file), 'utf8'))
    if (!Array.isArray(list) || !list.length) return `dist/${file} lists nothing`
  }
  return null
}

/** @param {string} command @param {string[]} args */
function run(command, args) {
  console.log(`\n$ ${command} ${args.join(' ')}`)
  const { status } = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' })
  if (status !== 0) { console.error(`\ndeploy stopped: ${command} ${args[0]} failed`); process.exit(status ?? 1) }
}
const git = (/** @type {string[]} */ ...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trimEnd()

if (import.meta.main) {
  const dry = process.argv.includes('--dry-run')
  run('git', ['fetch', '--quiet', 'origin', 'main'])
  const head = git('rev-parse', 'HEAD'), main = git('rev-parse', 'origin/main')
  const problem = deployProblem({ head, main, dirty: git('status', '--porcelain').split('\n').filter(Boolean) })
  console.log(`${dry ? 'dry run of' : 'deploying'} ${head.slice(0, 9)} ${git('log', '-1', '--format=%s')}`)
  if (problem && !dry) { console.error(`deploy refused: ${problem}`); process.exit(1) }
  if (problem) console.log(`not uploadable as it stands: ${problem}`)

  run('bun', ['install', '--frozen-lockfile'])
  // The slowest test runs close to bun's five seconds on a busy machine; a deploy waits for it.
  run('bun', ['run', 'test', '--timeout', '60000'])
  run('bun', ['run', 'check'])
  run('bun', ['run', 'i18n'])
  run('bun', ['scripts/build.mjs'])
  run('bun', ['scripts/build_readings.mjs'])
  run('bun', ['run', 'build'])
  const broken = distProblem(join(ROOT, 'dist'))
  if (broken) { console.error(`deploy stopped: ${broken}`); process.exit(1) }
  run('bunx', [WRANGLER, 'deploy', ...(dry ? ['--dry-run'] : [])])
  if (dry) { console.log(`\ndry run finished: ${head.slice(0, 9)} builds; nothing was uploaded`); process.exit(0) }

  // The upload is live when the site lists the methods this build made.
  const built = readFileSync(join(ROOT, 'dist', 'data', 'methods.json'), 'utf8')
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(`${SITE}/data/methods.json?${Date.now()}`).catch(() => null)
    if (response?.ok && await response.text() === built) { console.log(`\ndeployed ${head.slice(0, 9)} to ${SITE}`); process.exit(0) }
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  console.error(`\nuploaded, but ${SITE}/data/methods.json is not yet this build's`)
  process.exit(1)
}
