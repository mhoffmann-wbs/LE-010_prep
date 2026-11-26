// Prints question-bank coverage per objective, key knowledge area and term
// against the PLAN.md targets, with the mix of item kinds. Objective counts are
// for 010-200; areas and terms are checked on each exam with the items on it.
// Run: npm run content:status
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BANK_TARGET, EXAM_IDS, MIN_ITEMS_PER_AREA, TOPICS, itemInExam, linesFor, objectivesOf, questionTarget, topicWeight } from '../src/content/blueprint.ts'
import type { Item } from '../src/content/schema.ts'

const dir = join(import.meta.dirname, '../src/content/questions')
const items: Item[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Item[])

let have = 0
const kinds: Record<string, number> = {}
for (const t of TOPICS) {
  console.log(`\nTopic ${t.id}: ${t.title} (weight ${topicWeight(t.id)})`)
  for (const o of objectivesOf(t.id)) {
    const pool = items.filter((i) => i.objectiveId === o.id)
    const target = questionTarget(o.id)
    have += Math.min(pool.length, target)
    const mix: Record<string, number> = {}
    for (const i of pool) {
      mix[i.kind] = (mix[i.kind] ?? 0) + 1
      kinds[i.kind] = (kinds[i.kind] ?? 0) + 1
    }
    const mixText = Object.entries(mix)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ')
    console.log(`  ${pool.length >= target ? '✓' : ' '} ${o.id}  ${String(pool.length).padStart(3)} / ${target}  ${mixText}`)
    for (const exam of EXAM_IDS) {
      const onExam = pool.filter((i) => itemInExam(i, exam))
      const thin = linesFor(o, 'areas', exam)
        .map((a) => [a.id, onExam.filter((i) => i.areas.includes(a.id)).length] as const)
        .filter(([, n]) => n < MIN_ITEMS_PER_AREA)
      if (thin.length) console.log(`        ${exam} areas below ${MIN_ITEMS_PER_AREA}: ${thin.map(([id, n]) => `${id} (${n})`).join(', ')}`)
      const untested = linesFor(o, 'terms', exam).filter((term) => !onExam.some((i) => i.terms?.includes(term.id)))
      if (untested.length) console.log(`        ${exam} terms no item tests: ${untested.map((term) => term.id).join(', ')}`)
    }
  }
}
const share = (k: string) => (items.length ? Math.round(((kinds[k] ?? 0) / items.length) * 100) : 0)
console.log(`\nQuestions: ${have} / ${BANK_TARGET} (${Math.round((have / BANK_TARGET) * 100)}%)`)
console.log(`Kinds: ${JSON.stringify(kinds)}; single ${share('single')}% (target ~60), multi ${share('multi')}% (~15), fill ${share('fill')}% (~15), output ${share('output')}% (~10)`)
