// Loads every simulator under src/content/sims/ (JSON files named <simId>.json),
// in blueprint order. Each file's `params` is validated by the simulator's own
// schema in src/sims/registry.ts; content tests check both.
import { type Sim, simSchema } from './schema'

const files = import.meta.glob<unknown>('./sims/*.json', { eager: true, import: 'default' })

export const SIM_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), data]),
)

const byFirstObjective = (a: Sim, b: Sim) => a.objectives[0]!.localeCompare(b.objectives[0]!, 'en', { numeric: true }) || a.id.localeCompare(b.id)

export const SIMS: Sim[] = Object.values(SIM_FILES)
  .map((data) => simSchema.parse(data))
  .sort(byFirstObjective)

export const SIM_BY_ID = new Map(SIMS.map((s) => [s.id, s]))
