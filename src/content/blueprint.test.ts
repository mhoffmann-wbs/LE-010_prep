import { describe, expect, it } from 'vitest'
import {
  AREA_BY_ID,
  BANK_TARGET,
  EXAM_FORMAT,
  EXAM_IDS,
  MOCK,
  OBJECTIVES,
  TERM_BY_ID,
  TOPICS,
  estimateScaledScore,
  inExam,
  itemInExam,
  linesFor,
  mockQuota,
  questionTarget,
  topicWeight,
} from './blueprint'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('blueprint', () => {
  it('matches objectives v2.0: 5 topics, 19 objectives weighted to 40', () => {
    expect(TOPICS.map((t) => t.id)).toEqual(['011', '012', '013', '014', '015'])
    expect(OBJECTIVES.map((o) => `${o.id}:${o.weight}`)).toEqual([
      '011.1:2', '011.2:2', '011.3:1', '011.4:2',
      '012.1:3', '012.2:2', '012.3:2', '012.4:2',
      '013.1:2', '013.2:3', '013.3:4',
      '014.1:1', '014.2:2', '014.3:3', '014.4:2',
      '015.1:2', '015.2:2', '015.3:2', '015.4:1',
    ])
    expect(TOPICS.map((t) => topicWeight(t.id))).toEqual([7, 9, 9, 8, 7])
    expect(OBJECTIVES.flatMap((o) => linesFor(o, 'areas', '010-200'))).toHaveLength(63)
    expect(OBJECTIVES.flatMap((o) => linesFor(o, 'terms', '010-200'))).toHaveLength(102)
  })

  it('maps objectives v1.6 one to one, in order: 1.1–5.4', () => {
    expect(OBJECTIVES.map((o) => o.v16.id)).toEqual(
      ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3', '4.1', '4.2', '4.3', '4.4', '5.1', '5.2', '5.3', '5.4'],
    )
    for (const o of OBJECTIVES) expect(o.v16.id[0]).toBe(o.topicId[2])
    expect(OBJECTIVES.flatMap((o) => linesFor(o, 'areas', '010-160'))).toHaveLength(51)
    expect(OBJECTIVES.flatMap((o) => linesFor(o, 'terms', '010-160'))).toHaveLength(80)
    // Lines both versions list, with v1.6's own wording where it differs.
    const o = OBJECTIVES.find((x) => x.id === '012.3')!
    expect(linesFor(o, 'terms', '010-160').map((t) => t.text)).toEqual(['Common options for ls', 'Recursive listings', 'cd', '. and ..', 'home and ~'])
  })

  it('numbers areas and terms within their objective, v1.6-only lines after the 2.0 ones', () => {
    for (const o of OBJECTIVES) {
      expect(o.id.startsWith(`${o.topicId}.`)).toBe(true)
      const v2 = (kind: 'areas' | 'terms') => o[kind].filter((l) => !l.exams || l.exams.includes('010-200'))
      const v16 = (kind: 'areas' | 'terms') => o[kind].filter((l) => l.exams?.length === 1 && l.exams[0] === '010-160')
      v2('areas').forEach((a, i) => expect(a.id).toBe(`${o.id}.${i + 1}`))
      v2('terms').forEach((t, i) => expect(t.id).toBe(`${o.id}.t${i + 1}`))
      v16('areas').forEach((a, i) => expect(a.id).toBe(`${o.id}.v${i + 1}`))
      v16('terms').forEach((t, i) => expect(t.id).toBe(`${o.id}.vt${i + 1}`))
      // Every line is on at least one exam.
      for (const l of [...o.areas, ...o.terms]) expect(EXAM_IDS.some((e) => inExam(l, e))).toBe(true)
    }
    expect(AREA_BY_ID.size).toBe(63 + 15)
    expect(TERM_BY_ID.size).toBe(102 + 35)
  })

  it('puts an item on an exam when one of its areas and one of its terms are on it', () => {
    // 013.2.1 pipes: both; 013.2.3 ERE: 2.0; 013.2.v1 BRE: 1.6; 013.2.t5 uniq: 2.0; 013.2.t3 cat, head, tail: both.
    const on = (item: { areas: string[]; terms?: string[] }) => EXAM_IDS.filter((e) => itemInExam(item, e))
    expect(on({ areas: ['013.2.1'] })).toEqual(['010-200', '010-160'])
    expect(on({ areas: ['013.2.3'] })).toEqual(['010-200'])
    expect(on({ areas: ['013.2.v1'] })).toEqual(['010-160'])
    expect(on({ areas: ['013.2.3', '013.2.v1'] })).toEqual(['010-200', '010-160'])
    expect(on({ areas: ['013.2.1'], terms: ['013.2.t5'] })).toEqual(['010-200'])
    expect(on({ areas: ['013.2.1'], terms: ['013.2.t3'] })).toEqual(['010-200', '010-160'])
  })

  it('gives the 40-question mock one question per weight point, in 60 minutes', () => {
    expect(sum(OBJECTIVES.map((o) => mockQuota(o.id)))).toBe(MOCK.items)
    expect(MOCK).toEqual({ items: 40, minutes: 60 })
  })

  it('targets 15 bank items per weight point: 600 in all (PLAN.md §4)', () => {
    expect(questionTarget('013.3')).toBe(60)
    expect(questionTarget('011.3')).toBe(15)
    expect(BANK_TARGET).toBe(600)
  })

  it('estimates the scaled score on 200–800, with 500 at the assumed pass fraction', () => {
    expect(estimateScaledScore(0)).toBe(EXAM_FORMAT.scaleMin)
    expect(estimateScaledScore(1)).toBe(EXAM_FORMAT.scaleMax)
    expect(estimateScaledScore(2 / 3)).toBe(EXAM_FORMAT.passScore)
    expect(estimateScaledScore(0.65)).toBeLessThan(EXAM_FORMAT.passScore)
    expect(estimateScaledScore(0.5)).toBe(425)
  })
})
