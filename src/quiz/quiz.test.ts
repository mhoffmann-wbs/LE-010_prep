import { describe, expect, it } from 'vitest'
import { OBJECTIVES, mockQuota } from '../content/blueprint'
import type { Item } from '../content/schema'
import { FILL, MULTI, OUTPUT_CHOICE, OUTPUT_TYPE, SINGLE } from '../test/fixtures'
import { emptyResponse, grade, isAnswered } from './grade'
import { objectiveWeights, practicePool } from './pools'
import { seededRng } from './random'
import { scoreMock } from './results'
import { buildFocusSet, buildMixedSet, buildMockExam, orderLeastMastered } from './sampler'

describe('grading', () => {
  it('grades single and multi items all or nothing', () => {
    expect(grade(SINGLE, { kind: 'single', choice: 0 })).toBe(true)
    expect(grade(SINGLE, { kind: 'single', choice: 1 })).toBe(false)
    expect(grade(MULTI, { kind: 'multi', choices: [1, 0] })).toBe(true)
    expect(grade(MULTI, { kind: 'multi', choices: [0, 2] })).toBe(false)
    expect(isAnswered(MULTI, { kind: 'multi', choices: [0] })).toBe(false)
  })

  it('grades short input against every accepted answer, case-sensitively by default', () => {
    expect(grade(FILL, { kind: 'fill', text: ' -t ' })).toBe(true)
    expect(grade(FILL, { kind: 'fill', text: 't' })).toBe(true)
    expect(grade(FILL, { kind: 'fill', text: '-T' })).toBe(false)
    expect(grade({ ...FILL, caseSensitive: false }, { kind: 'fill', text: '-T' })).toBe(true)
    expect(isAnswered(FILL, { kind: 'fill', text: '  ' })).toBe(false)
  })

  it('grades output items by choice or by the typed text', () => {
    expect(grade(OUTPUT_CHOICE, { kind: 'output', choice: 0, text: '' })).toBe(true)
    expect(grade(OUTPUT_CHOICE, { kind: 'output', choice: 1, text: '' })).toBe(false)
    expect(grade(OUTPUT_TYPE, { kind: 'output', choice: null, text: "Pixel and 'Pixel'  \n" })).toBe(true)
    expect(grade(OUTPUT_TYPE, { kind: 'output', choice: null, text: 'Pixel and $x' })).toBe(false)
    expect(isAnswered(OUTPUT_TYPE, emptyResponse(OUTPUT_TYPE))).toBe(false)
  })
})

// A synthetic bank: `perObjective` single items for every objective, plus one output item each.
function bank(perObjective: number, output = true): Item[] {
  const items: Item[] = []
  for (const o of OBJECTIVES) {
    for (let n = 0; n < perObjective; n++) {
      items.push({ ...SINGLE, id: `${o.id}-${String(n).padStart(3, '0')}`, objectiveId: o.id, areas: [`${o.id}.1`], terms: [], stem: `${o.id} q${n}` })
    }
    if (output) items.push({ ...OUTPUT_CHOICE, id: `${o.id}-900`, objectiveId: o.id, areas: [`${o.id}.1`], terms: [] })
  }
  return items
}

const perObjective = (items: Item[]) => {
  const counts: Record<string, number> = {}
  for (const i of items) counts[i.objectiveId] = (counts[i.objectiveId] ?? 0) + 1
  return counts
}

describe('mock exam', () => {
  it('has 40 questions in 60 minutes, one per weight point of each objective', () => {
    const exam = buildMockExam(bank(10), false, new Set(), seededRng(1))
    expect(exam).toMatchObject({ minutes: 60, shortfall: 0, output: false })
    expect(exam.items).toHaveLength(40)
    expect(perObjective(exam.items)).toEqual(Object.fromEntries(OBJECTIVES.map((o) => [o.id, mockQuota(o.id)])))
    expect(exam.items.every((i) => i.kind === 'single')).toBe(true)
  })

  it('includes output items only when asked', () => {
    const kinds = new Set(Array.from({ length: 10 }, (_, s) => buildMockExam(bank(1), true, new Set(), seededRng(s))).flatMap((e) => e.items.map((i) => i.kind)))
    expect(kinds.has('output')).toBe(true)
  })

  it('fills a short objective from the rest of its topic', () => {
    const items = bank(10, false).filter((i) => !(i.objectiveId === '013.3' && Number(i.id.slice(-3)) >= 1))
    const exam = buildMockExam(items, false, new Set(), seededRng(2))
    expect(exam.items).toHaveLength(40)
    expect(perObjective(exam.items)['013.3']).toBe(1)
    expect(exam.items.filter((i) => i.objectiveId.startsWith('013.'))).toHaveLength(9)
  })

  it('prefers unseen items', () => {
    const items = bank(10, false)
    const seen = new Set(items.filter((i) => Number(i.id.slice(-3)) < 5).map((i) => i.id))
    const exam = buildMockExam(items, false, seen, seededRng(3))
    expect(exam.items.some((i) => seen.has(i.id))).toBe(false)
  })

  it('scales the time to the real pace when the bank is short', () => {
    const exam = buildMockExam(bank(1, false), false, new Set(), seededRng(4))
    expect(exam.items).toHaveLength(19)
    expect(exam.shortfall).toBe(21)
    expect(exam.minutes).toBe(Math.round((60 * 19) / 40))
  })
})

describe('practice sets', () => {
  it('leaves out output items when the learner turns them off', () => {
    expect(practicePool(bank(2), false).some((i) => i.kind === 'output')).toBe(false)
    expect(practicePool(bank(2), true).some((i) => i.kind === 'output')).toBe(true)
  })

  it('weights objectives by the blueprint, 40 in all', () => {
    const total = [...objectiveWeights().values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(40)
  })

  it('draws mixed sets of the requested size without repeats', () => {
    const set = buildMixedSet(bank(5, false), objectiveWeights(), 25, seededRng(5))
    expect(set).toHaveLength(25)
    expect(new Set(set.map((i) => i.id)).size).toBe(25)
  })

  it('puts least-mastered items first', () => {
    const pool = bank(3, false)
    const streakOf = (id: string) => (id.endsWith('000') ? 0 : 5)
    expect(orderLeastMastered(pool, streakOf, seededRng(6)).slice(0, OBJECTIVES.length).every((i) => i.id.endsWith('000'))).toBe(true)
    expect(buildFocusSet(pool, objectiveWeights(), 10, streakOf, seededRng(7))).toHaveLength(10)
  })
})

describe('mock score', () => {
  it('scores by topic and objective and estimates the scaled score', () => {
    const score = scoreMock([SINGLE, MULTI, FILL], (item) => item.kind !== 'fill')
    expect(score).toMatchObject({ correct: 2, total: 3, percent: 67, scaled: 500, passed: true })
    expect(score.topics.find((t) => t.id === '013')).toMatchObject({ correct: 0, total: 1 })
    expect(score.objectives.map((o) => o.id)).toEqual(['011.2', '013.1', '014.2'])
  })
})
