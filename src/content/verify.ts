// The verified cache, src/content/verified.json: what each runnable printed in
// the guest, keyed by a hash of its job script and the guest's recipe (the
// Dockerfile and le-init), so a changed command, fixture, user, runner or image
// makes the record stale.
// Node only (content:verify, vm:smoke and the content tests).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { type Job, jobScript } from '../vm/job.ts'
import type { RunRecord } from './runnables'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const VERIFIED_FILE = path.join(ROOT, 'src/content/verified.json')

/** A record also names its runnable and command, so diffs of verified.json read well. */
export type VerifiedRecord = RunRecord & { id: string; command: string }
export type Verified = Record<string, VerifiedRecord>

const sha = (text: string) => createHash('sha256').update(text).digest('hex')

/** Changes whenever the guest's recipe does. */
export const guestHash = () =>
  sha(['Dockerfile', 'le-init'].map((f) => readFileSync(path.join(ROOT, 'scripts/vm', f), 'utf8')).join('\0')).slice(0, 16)

export const jobKey = (job: Job, guest = guestHash()) => sha(`${guest}\n${jobScript(job)}`).slice(0, 16)

export function readVerified(): Verified {
  try {
    return JSON.parse(readFileSync(VERIFIED_FILE, 'utf8')) as Verified
  } catch {
    return {}
  }
}
