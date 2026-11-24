// Everything the content claims about the guest, as jobs to run: each `output`
// item's command, each accepted answer of a `fill` item with `verify`, and each
// ```bash snippet in MDX. content:verify runs them in Docker and records what they
// print (verified.json); the content tests compare every claim with its record.
//
// Scripts import this file with Node, so runtime imports carry their extension.
import type { Job, User } from '../vm/job'
import type { Fixture } from './fixture'
import type { Item } from './schema'
import { extractSnippets } from './snippets.ts'

/** What the content says about a run: exactly this output, or simply that it works. */
export type Claim = { output: string } | { succeeds: true }

export type Runnable = {
  /** Where the claim lives: "013.2-001", "013.1-001#2" (second accepted answer), "lesson 013.2:41" (MDX line). */
  id: string
  job: Job
  claim: Claim
}

/** What content:verify saw. */
export type RunRecord = { exit: number; output: string }

export type Sources = {
  items: Item[]
  fixtures: Record<string, Fixture>
  /** MDX sources by label, e.g. { "lesson 013.2": "…" }. */
  mdx?: Record<string, string>
}

/** All runnables, plus problems that stop one from being built (unknown fixture, bad fence option). */
export function collectRunnables({ items, fixtures, mdx = {} }: Sources): { runnables: Runnable[]; problems: string[] } {
  const runnables: Runnable[] = []
  const problems: string[] = []
  const add = (id: string, command: string, user: User | undefined, fixture: string | undefined, claim: Claim) => {
    if (fixture !== undefined && !fixtures[fixture]) problems.push(`${id}: unknown fixture "${fixture}"`)
    else runnables.push({ id, job: { command, user, fixture: fixture ? fixtures[fixture] : undefined }, claim })
  }
  for (const item of items) {
    if (item.kind === 'output') add(item.id, item.command, item.user, item.fixture, { output: item.output })
    if (item.kind === 'fill' && item.verify) {
      const { command, user, fixture } = item.verify
      item.accept.forEach((answer, i) => add(`${item.id}#${i + 1}`, command.replaceAll('{answer}', answer), user, fixture, { succeeds: true }))
    }
  }
  for (const [label, source] of Object.entries(mdx)) {
    try {
      for (const s of extractSnippets(source))
        add(`${label}:${s.line}`, s.code, s.user, s.fixture, s.output === undefined ? { succeeds: true } : { output: s.output })
    } catch (e) {
      problems.push(`${label}: ${(e as Error).message}`)
    }
  }
  return { runnables, problems }
}

/** Why a record contradicts its claim, or null when it holds. */
export function checkClaim(claim: Claim, record: RunRecord): string | null {
  if (record.exit === 124) return 'timed out'
  if ('output' in claim)
    return record.output === claim.output ? null : `prints ${JSON.stringify(record.output)}, the content says ${JSON.stringify(claim.output)}`
  return record.exit === 0 ? null : `exits with ${record.exit}: ${JSON.stringify(record.output)}`
}
