// Runs the anti-giveaway checks and prints the key-letter spread, over the whole
// bank or the given files. Run: npm run content:quality [-- <file.json> ...]
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { QUALITY_CHECKS, keyLetter } from '../src/content/quality.ts'
import type { Item } from '../src/content/schema.ts'

const dir = join(import.meta.dirname, '../src/content/questions')
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f))
const items: Item[] = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as Item[])

const singles = items.flatMap((i) => (i.kind === 'single' || (i.kind === 'output' && i.options) ? [i.options!] : []))
const spread: Record<string, number> = {}
for (const q of singles) spread[keyLetter(q)] = (spread[keyLetter(q)] ?? 0) + 1
console.log(`${items.length} items, ${singles.length} single-select questions. Keys:`, spread)

let failed = false
for (const [name, check] of Object.entries(QUALITY_CHECKS)) {
  const problems = check(items)
  console.log(`${problems.length ? '✗' : '✓'} ${name}`)
  for (const p of problems) console.log(`    ${p}`)
  failed ||= problems.length > 0
}
process.exit(failed ? 1 : 0)
