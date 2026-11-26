// Integrity of the built-in flashcards and drill decks.
import { describe, expect, it } from 'vitest'
import { AREA_BY_ID, EXAM_IDS, OBJECTIVES, OBJECTIVE_BY_ID, TERM_BY_ID, itemInExam } from './blueprint'
import { DRILL_DECKS, DRILL_FILES } from './drills'
import { CARDS, CARD_FILES } from './flashcards'
import { cardFileSchema, drillDeckSchema } from './schema'

/** PLAN.md §6e: at least this many built-in cards per key knowledge area, on each exam. */
const MIN_CARDS_PER_AREA = 2

describe('flashcards', () => {
  it.each(Object.keys(CARD_FILES))('%s.json is valid and holds only its own objective', (objectiveId) => {
    expect(OBJECTIVE_BY_ID.has(objectiveId)).toBe(true)
    for (const card of cardFileSchema.parse(CARD_FILES[objectiveId])) expect(card.id.startsWith(`${objectiveId}-`)).toBe(true)
  })

  it('has unique ids', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
  })

  it('tags areas and terms that exist, on at least one exam', () => {
    for (const card of CARDS) {
      for (const a of card.areas) expect(AREA_BY_ID.has(a), `${card.id}: ${a}`).toBe(true)
      for (const t of card.terms ?? []) expect(TERM_BY_ID.has(t), `${card.id}: ${t}`).toBe(true)
      expect(EXAM_IDS.some((e) => itemInExam(card, e)), card.id).toBe(true)
    }
  })

  it(`has at least ${MIN_CARDS_PER_AREA} cards for every key knowledge area of both exams`, () => {
    const thin = OBJECTIVES.flatMap((o) => o.areas).filter((a) => CARDS.filter((c) => c.areas.includes(a.id)).length < MIN_CARDS_PER_AREA)
    expect(thin.map((a) => a.id)).toEqual([])
  })
})

describe('drill decks', () => {
  it.each(Object.keys(DRILL_FILES))('%s.json is valid and named after its id', (name) => {
    expect(drillDeckSchema.parse(DRILL_FILES[name]).id).toBe(name)
  })

  it('link to objectives that exist', () => {
    for (const deck of DRILL_DECKS) for (const o of deck.objectives) expect(OBJECTIVE_BY_ID.has(o), `${deck.id}: ${o}`).toBe(true)
  })

  it('use every bucket of a sorter', () => {
    const empty = DRILL_DECKS.flatMap((deck) => (deck.kind === 'sort' ? deck.buckets.filter((b) => !deck.items.some((i) => i.bucket === b.id)).map((b) => `${deck.id}: ${b.id}`) : []))
    expect(empty).toEqual([])
  })
})
