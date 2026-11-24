// Runs every runnable claim (output items, fill answers with `verify`, lesson
// snippets) in the learner's own guest, v86 in Node, through the same job runner
// as lesson cells, records what it printed in src/content/verified.json and
// reports claims that don't hold. Needs public/vm/ (vm:build, then vm:state).
//
//   npm run content:verify               run what is new or stale, drop records no claim uses
//   npm run content:verify -- --all      rerun everything (CI does, after rebuilding the guest)
import { writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import { type RunRecord, checkClaim } from '../src/content/runnables.ts'
import { VERIFIED_FILE, type Verified, guestHash, jobKey, readVerified } from '../src/content/verify.ts'
import type { Job } from '../src/vm/job.ts'
import { loadRunnables } from './content-load.ts'
import { guestBuilt } from './vm/guest.ts'

/** Each worker holds a whole guest (about 200 MB). */
const MAX_WORKERS = 4

if (!guestBuilt()) {
  console.error('No guest in public/vm/. Run npm run vm:build, then npm run vm:state.')
  process.exit(1)
}

const all = process.argv.includes('--all')
const guest = guestHash()
const old = readVerified()
const runnables = loadRunnables()
const keyed = runnables.map((r) => ({ r, key: jobKey(r.job, guest) }))
const todo = keyed.filter(({ key }) => all || !old[key])

const next: Verified = {}
if (!all) for (const { r, key } of keyed) if (old[key]) next[key] = { ...old[key], id: r.id }

console.log(`${runnables.length} runnables, ${todo.length} to run`)
let failed = 0
if (todo.length) {
  const started = performance.now()
  const results = await runAll(todo.map(({ r }) => r.job))
  results.forEach((result, i) => {
    const { r, key } = todo[i]!
    if ('error' in result) {
      console.error(`✗ ${r.id}: ${result.error}`)
      failed++
    } else next[key] = { id: r.id, command: r.job.command, ...result }
  })
  console.log(`Ran ${todo.length} in ${((performance.now() - started) / 1000).toFixed(0)} s`)
}

// Sorted by id, so diffs stay small.
const sorted = Object.fromEntries(Object.entries(next).sort(([, a], [, b]) => a.id.localeCompare(b.id, 'en', { numeric: true })))
writeFileSync(VERIFIED_FILE, `${JSON.stringify(sorted, null, 2)}\n`)

for (const { r, key } of keyed) {
  const record = next[key]
  if (!record) continue // already reported
  const problem = checkClaim(r.claim, record)
  if (problem) {
    console.error(`✗ ${r.id}: ${problem}`)
    failed++
  }
}
console.log(failed ? `${failed} problem(s)` : `✓ every claim holds (${runnables.length})`)
process.exit(failed ? 1 : 0)

/** Runs the jobs on a few guests in worker threads; results come back in job order. */
async function runAll(jobs: Job[]): Promise<(RunRecord | { error: string })[]> {
  const results: (RunRecord | { error: string })[] = []
  let nextJob = 0
  let done = 0
  const count = Math.min(MAX_WORKERS, Math.max(1, availableParallelism() - 1), jobs.length)
  await Promise.all(
    Array.from({ length: count }, () => {
      const worker = new Worker(new URL('./vm/verify-worker.ts', import.meta.url))
      return new Promise<void>((resolve, reject) => {
        const feed = () => {
          if (nextJob >= jobs.length) return void worker.terminate().then(() => resolve())
          const i = nextJob++
          worker.postMessage({ i, job: jobs[i] })
        }
        worker.on('message', (msg: 'ready' | { i: number; record?: RunRecord; error?: string }) => {
          if (msg !== 'ready') {
            results[msg.i] = msg.record ?? { error: msg.error! }
            if (process.stdout.isTTY) process.stdout.write(`\r${++done}/${jobs.length}`)
          }
          feed()
        })
        worker.on('error', reject)
      })
    }),
  )
  if (process.stdout.isTTY) process.stdout.write('\n')
  return results
}
