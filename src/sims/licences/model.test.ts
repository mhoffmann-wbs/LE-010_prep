import { describe, expect, it } from 'vitest'
import params from '../../content/sims/licences.json'
import { DEFAULT_ANSWERS, type Answers, evaluate, noMatchHint, paramsSchema, recommend } from './model'

const { licences, scenarios } = paramsSchema.parse(params.params)
const fits = (a: Partial<Answers>) =>
  recommend(licences, { ...DEFAULT_ANSWERS, ...a })
    .filter((r) => r.verdict.fits)
    .map((r) => r.licence.id)
    .sort()

describe('licence matching', () => {
  it('offers the permissive code licences by default', () => {
    expect(fits({})).toEqual(['apache', 'bsd', 'mit'])
  })
  it('separates the three GNU licences by how far the duty reaches', () => {
    expect(fits({ share: 'same', scope: 'program' })).toEqual(['gpl'])
    expect(fits({ share: 'same', scope: 'library' })).toEqual(['lgpl'])
    expect(fits({ share: 'same', scope: 'network' })).toEqual(['agpl'])
  })
  it('picks the Creative Commons licence by its elements', () => {
    expect(fits({ kind: 'content' })).toEqual(['cc-by'])
    expect(fits({ kind: 'content', share: 'same' })).toEqual(['cc-by-sa'])
    expect(fits({ kind: 'content', commercial: false })).toEqual(['cc-by-nc'])
    expect(fits({ kind: 'content', commercial: false, share: 'same' })).toEqual(['cc-by-nc-sa'])
    expect(fits({ kind: 'content', changes: false })).toEqual(['cc-by-nd'])
    expect(fits({ kind: 'content', changes: false, commercial: false })).toEqual(['cc-by-nc-nd'])
  })
  it('suggests CC0 when no credit is wanted, for code or content', () => {
    expect(fits({ credit: false })).toEqual(['cc0'])
    expect(fits({ kind: 'content', credit: false })).toEqual(['cc0'])
  })
  it('keeps software licences away from content and the reverse', () => {
    expect(evaluate(licences.find((l) => l.id === 'gpl')!, { ...DEFAULT_ANSWERS, kind: 'content' }).problems[0]).toMatch(/software licence/)
    expect(evaluate(licences.find((l) => l.id === 'cc-by')!, DEFAULT_ANSWERS).problems[0]).toMatch(/content/)
  })
  it('finds nothing for impossible combinations and says why', () => {
    for (const a of [{ commercial: false }, { changes: false }, { kind: 'content', share: 'same', changes: false }] as const) {
      expect(fits(a)).toEqual([])
      expect(noMatchHint({ ...DEFAULT_ANSWERS, ...a })).not.toMatch(/exactly that combination/)
    }
  })
})

describe('scenarios', () => {
  it.each(scenarios.map((s) => [s.text.slice(0, 40), s] as const))('%s has one fitting answer among its options', (_t, s) => {
    expect(s.options).toContain(s.answer)
    expect(licences.some((l) => l.id === s.answer)).toBe(true)
  })
})
