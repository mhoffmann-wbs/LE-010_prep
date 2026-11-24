import { describe, expect, it } from 'vitest'
import {
  AREA_BY_ID,
  BANK_TARGET,
  EXAM_FORMAT,
  MOCK,
  OBJECTIVES,
  TERM_BY_ID,
  TOPICS,
  estimateScaledScore,
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
    expect(AREA_BY_ID.size).toBe(63)
    expect(TERM_BY_ID.size).toBe(102)
  })

  it('numbers areas and terms within their objective', () => {
    for (const o of OBJECTIVES) {
      expect(o.id.startsWith(`${o.topicId}.`)).toBe(true)
      o.areas.forEach((a, i) => expect(a.id).toBe(`${o.id}.${i + 1}`))
      o.terms.forEach((t, i) => expect(t.id).toBe(`${o.id}.t${i + 1}`))
    }
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
