// Every concept simulator lives in its own folder, src/sims/<simId>/:
// model.ts (the params schema and pure logic, with model.test.ts), Sim.tsx
// (the component) and index.ts, which default-exports
// defineSim(paramsSchema, () => import('./Sim')). The folder name must match
// the content file src/content/sims/<simId>.json.
import type { SimEntry } from './define'

const modules = import.meta.glob<SimEntry>('./*/index.ts', { eager: true, import: 'default' })

export const SIM_REGISTRY: ReadonlyMap<string, SimEntry> = new Map(
  Object.entries(modules).map(([path, entry]) => [path.replace(/^\.\/(.+)\/index\.ts$/, '$1'), entry]),
)
