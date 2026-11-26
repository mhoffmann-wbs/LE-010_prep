// Builds one drill round: a sample of a deck's cards, each turned into a
// question with its answer choices. "Which command?" cards show the answer and
// its three distractors in random order; sorter rounds alternate buckets so a
// lopsided deck still asks about each bucket.
import type { DrillDeck } from '../content/schema'
import { type Rng, shuffle } from '../quiz/random'

export const ROUND_SIZE = 10

export interface DrillQuestion {
  id: string
  prompt: string
  /** Choices: answer texts, or bucket ids for sorters. */
  choices: string[]
  answer: string
  why?: string
}

/**
 * Up to `size` questions from `deck`. With `only`, just those card ids (the
 * learner's misses), all of them.
 */
export function buildRound(deck: DrillDeck, { only, size = ROUND_SIZE, rand = Math.random }: { only?: ReadonlySet<string>; size?: number; rand?: Rng } = {}): DrillQuestion[] {
  if (deck.kind === 'which') {
    const cards = shuffle(deck.cards.filter((c) => !only || only.has(c.id)), rand)
    return cards.slice(0, only ? cards.length : size).map((c) => ({
      id: c.id,
      prompt: c.prompt,
      choices: shuffle([c.answer, ...c.distractors], rand),
      answer: c.answer,
      why: c.why,
    }))
  }
  const choices = deck.buckets.map((b) => b.id)
  const items = deck.items.filter((i) => !only || only.has(i.id))
  const queues = choices.map((b) => shuffle(items.filter((i) => i.bucket === b), rand))
  const picked: typeof items = []
  const limit = only ? items.length : Math.min(size, items.length)
  for (let k = 0; picked.length < limit; k++) {
    const next = queues[k % queues.length]!.shift()
    if (next) picked.push(next)
  }
  return shuffle(picked, rand).map((i) => ({ id: i.id, prompt: i.text, choices, answer: i.bucket, why: i.why }))
}
