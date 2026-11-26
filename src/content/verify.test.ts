// Never trust a hand-written output (PLAN.md §5c): every claim the content makes
// about the guest must match what content:verify recorded for exactly that job.
// Offline and fast; run `npm run content:verify` when a check here fails.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ITEMS } from './bank'
import { FIXTURES } from './fixtureBank'
import { checkClaim, collectRunnables } from './runnables'
import { guestHash, jobKey, readVerified } from './verify'

// Read the raw MDX from disk: the MDX plugin would compile a `?raw` import.
const dir = join(import.meta.dirname, 'lessons')
const mdx = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => [`lesson ${f.replace(/\.mdx$/, '')}`, readFileSync(join(dir, f), 'utf8')]),
)

const { runnables, problems } = collectRunnables({ items: ITEMS, fixtures: FIXTURES, mdx })
const verified = readVerified()
const guest = guestHash()

describe('verified outputs', () => {
  it('can build every runnable (fixtures exist, fence options are known)', () => {
    expect(problems).toEqual([])
  })

  it('has a current record for every runnable', () => {
    const missing = runnables.filter((r) => !verified[jobKey(r.job, guest)]).map((r) => r.id)
    expect(missing, 'not verified, or changed since: run npm run content:verify').toEqual([])
  })

  it('holds every claim', () => {
    const wrong = runnables.flatMap((r) => {
      const record = verified[jobKey(r.job, guest)]
      const problem = record && checkClaim(r.claim, record)
      return problem ? [`${r.id}: ${problem}`] : []
    })
    expect(wrong).toEqual([])
  })

  it('keeps no records that no claim uses', () => {
    const used = new Set(runnables.map((r) => jobKey(r.job, guest)))
    expect(Object.keys(verified).filter((k) => !used.has(k)), 'run npm run content:verify to prune').toEqual([])
  })
})
