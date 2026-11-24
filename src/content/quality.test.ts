import { describe, expect, it } from 'vitest'
import { OUTPUT_CHOICE, SINGLE } from '../test/fixtures'
import { duplicateStems, keyIsLongest, keyLetterBalance, letterReferences } from './quality'

type Single = typeof SINGLE

// n single items whose key sits at `keyAt`, with distinct stems.
const pool = (n: number, keyAt: (i: number) => number, keyText = 'k', longestEvery = 0): Single[] =>
  Array.from({ length: n }, (_, i) => ({
    ...SINGLE,
    id: `014.2-${String(i).padStart(3, '0')}`,
    stem: `Question ${i}?`,
    options: [0, 1, 2, 3].map((j) => {
      const key = j === keyAt(i)
      const text = key ? (longestEvery && i % longestEvery === 0 ? 'a much longer key' : keyText) : `opt${j}`
      return { text, correct: key, rationale: 'r' }
    }),
  }))

describe('quality checks', () => {
  it('flags a key letter used in more than 40% of single-select questions', () => {
    expect(keyLetterBalance(pool(12, () => 0))).toHaveLength(1)
    expect(keyLetterBalance(pool(12, (i) => i % 4))).toEqual([])
    expect(keyLetterBalance(pool(5, () => 0))).toEqual([]) // pool too small to judge
  })

  it('wants the key to be the longest option in 15–40% of single-select questions', () => {
    expect(keyIsLongest(pool(12, (i) => i % 4, 'a much longer key'))[0]).toMatch(/max 40%/)
    expect(keyIsLongest(pool(12, (i) => i % 4, 'k'))[0]).toMatch(/min 15%/)
    expect(keyIsLongest(pool(12, (i) => i % 4, 'k', 4))).toEqual([])
  })

  it('flags duplicate stems, comparing output items by stem and command', () => {
    expect(duplicateStems([SINGLE, { ...SINGLE, id: '014.2-002' }])).toEqual(['014.2-002 duplicates the stem of 014.2-001'])
    expect(duplicateStems([OUTPUT_CHOICE, { ...OUTPUT_CHOICE, id: '013.2-002', command: 'sort x' }])).toEqual([])
  })

  it('flags explanations and rationales that cite option letters', () => {
    for (const explanation of ['Option B is right.', 'So (C) wins.', 'The answer A is a trap.'])
      expect(letterReferences([{ ...SINGLE, explanation }])).toHaveLength(1)
    const options = OUTPUT_CHOICE.options!.map((o, i) => (i === 1 ? { ...o, rationale: 'Choice D is wrong.' } : o))
    expect(letterReferences([{ ...OUTPUT_CHOICE, options }])).toHaveLength(1)
    expect(letterReferences([SINGLE])).toEqual([])
  })
})
