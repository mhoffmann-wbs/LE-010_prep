// Integrity of the real question bank. Targets (PLAN.md §4) are tracked with
// `npm run content:status`, not enforced here.
import { describe, expect, it } from 'vitest'
import { AREA_BY_ID, OBJECTIVE_BY_ID, TERM_BY_ID } from './blueprint'
import { ITEMS, QUESTION_FILES } from './bank'
import { QUALITY_CHECKS } from './quality'
import { itemFileSchema } from './schema'

describe('question bank', () => {
  it.each(Object.keys(QUESTION_FILES))('%s.json is valid and holds only its own objective', (objectiveId) => {
    expect(OBJECTIVE_BY_ID.has(objectiveId)).toBe(true)
    const items = itemFileSchema.parse(QUESTION_FILES[objectiveId])
    for (const item of items) expect(item.objectiveId).toBe(objectiveId)
  })

  it('has unique ids', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
  })

  it('tags areas and terms that exist in the blueprint', () => {
    for (const item of ITEMS) {
      for (const a of item.areas) expect(AREA_BY_ID.has(a), `${item.id}: ${a}`).toBe(true)
      for (const t of item.terms ?? []) expect(TERM_BY_ID.has(t), `${item.id}: ${t}`).toBe(true)
    }
  })

  it.each(Object.entries(QUALITY_CHECKS))('passes %s', (_, check) => {
    expect(check(ITEMS)).toEqual([])
  })
})
