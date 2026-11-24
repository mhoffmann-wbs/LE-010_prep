// Loads every fixture under src/content/fixtures/<name>.json, validated. Kept
// apart from bank.ts, so lesson cells don't pull in the question bank.
import { type Fixture, fixtureSchema } from './fixture'

const files = import.meta.glob<unknown>('./fixtures/*.json', { eager: true, import: 'default' })

/** File trees commands run against, by name (the file name without .json). */
export const FIXTURES: Record<string, Fixture> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), fixtureSchema.parse(data)]),
)
