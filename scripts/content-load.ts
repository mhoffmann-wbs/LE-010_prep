// Reads the content from disk for the scripts, the way src/content/bank.ts does
// with import.meta.glob in the app, and collects every runnable claim.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { type Fixture, fixtureSchema } from '../src/content/fixture.ts'
import { type Runnable, collectRunnables } from '../src/content/runnables.ts'
import { type Item, itemFileSchema } from '../src/content/schema.ts'

const CONTENT = join(import.meta.dirname, '../src/content')

/** Files in a content folder as [name without extension, text]. */
function files(dir: string, ext: string): [string, string][] {
  const full = join(CONTENT, dir)
  if (!existsSync(full)) return []
  return readdirSync(full)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => [f.slice(0, -ext.length), readFileSync(join(full, f), 'utf8')])
}

export const loadItems = (): Item[] => files('questions', '.json').flatMap(([, text]) => itemFileSchema.parse(JSON.parse(text)))

export const loadFixtures = (): Record<string, Fixture> =>
  Object.fromEntries(files('fixtures', '.json').map(([name, text]) => [name, fixtureSchema.parse(JSON.parse(text))]))

export const loadMdx = (): Record<string, string> => Object.fromEntries(files('lessons', '.mdx').map(([name, text]) => [`lesson ${name}`, text]))

export function loadRunnables(): Runnable[] {
  const { runnables, problems } = collectRunnables({ items: loadItems(), fixtures: loadFixtures(), mdx: loadMdx() })
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`)
    process.exit(1)
  }
  return runnables
}
