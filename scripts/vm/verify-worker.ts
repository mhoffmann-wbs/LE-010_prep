// One guest for content:verify: restores the snapshot, then runs each job it is
// sent and posts back what it printed.
import { parentPort } from 'node:worker_threads'
import type { Job } from '../../src/vm/job.ts'
import { restoreGuest } from './guest.ts'

const { runner } = await restoreGuest()
parentPort!.on('message', ({ i, job }: { i: number; job: Job }) => {
  runner.run(job).then(
    (record) => parentPort!.postMessage({ i, record }),
    (e: unknown) => parentPort!.postMessage({ i, error: e instanceof Error ? e.message : String(e) }),
  )
})
parentPort!.postMessage('ready')
