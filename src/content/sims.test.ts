// Content tests over the simulators: each file parses and is named after its
// simulator, has a registered component whose schema accepts its params, names
// real objectives, and points "Now you try" at bank items that test one of
// those objectives, enough of them on each exam.
import { describe, expect, it } from 'vitest'
import { SIM_REGISTRY } from '../sims/registry'
import { ITEMS } from './bank'
import { EXAM_IDS, OBJECTIVE_BY_ID, itemInExam } from './blueprint'
import { simSchema } from './schema'
import { SIMS, SIM_FILES } from './sims'

describe('simulators', () => {
  it.each(Object.entries(SIM_FILES))('%s.json parses, is named after its simulator and has valid params', (fileId, data) => {
    const parsed = simSchema.safeParse(data)
    expect(parsed.success, parsed.error?.message).toBe(true)
    expect(parsed.data?.id).toBe(fileId)
    const entry = SIM_REGISTRY.get(fileId)
    expect(entry, `no src/sims/${fileId}/index.ts`).toBeDefined()
    const params = entry!.params.safeParse(parsed.data!.params)
    expect(params.success, params.error?.message).toBe(true)
  })

  it('has a content file for every registered component', () => {
    expect([...SIM_REGISTRY.keys()].filter((id) => !(id in SIM_FILES))).toEqual([])
  })

  it('names real objectives', () => {
    expect(SIMS.flatMap((s) => s.objectives.filter((o) => !OBJECTIVE_BY_ID.has(o)).map((o) => `${s.id}: ${o}`))).toEqual([])
  })

  it('uses bank items that test one of its objectives for "Now you try", enough on each exam', () => {
    const problems = SIMS.flatMap((s) => {
      const items = s.tryItems.map((id) => ITEMS.find((i) => i.id === id))
      const missing = s.tryItems.filter((_, n) => !items[n]).map((id) => `${s.id}: no item ${id}`)
      const found = items.filter((i) => i !== undefined)
      const offTopic = found.filter((i) => !s.objectives.includes(i.objectiveId)).map((i) => `${s.id}: ${i.id} tests none of its objectives`)
      // At least 2 on the main exam and 1 on the other: some simulators (SSH) teach what only 010-200 lists.
      const short = EXAM_IDS.map((exam, n) => [exam, n === 0 ? 2 : 1] as const)
        .filter(([exam, min]) => found.filter((i) => itemInExam(i, exam)).length < min)
        .map(([exam, min]) => `${s.id}: fewer than ${min} items on ${exam}`)
      return [...missing, ...offTopic, ...short]
    })
    expect(problems).toEqual([])
  })

  it('does not reuse a "Now you try" item across simulators', () => {
    const ids = SIMS.flatMap((s) => s.tryItems)
    expect(ids.length).toBe(new Set(ids).size)
  })
})
