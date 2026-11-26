// Builds practice sets and mock exams from the question bank.
import { type ExamId, MOCK, TOPICS, itemInExam, mockQuota, objectivesOf } from '../content/blueprint'
import type { Item } from '../content/schema'
import { type Rng, shuffle } from './random'

export interface MockExam {
  exam: ExamId
  /** "Predict the output" items were included. */
  output: boolean
  items: Item[]
  minutes: number
  /** How many questions short of the full length the bank currently is. */
  shortfall: number
}

/** Unseen items first, each group in random order. */
const freshFirst = (items: readonly Item[], seen: ReadonlySet<string>, rng: Rng) => {
  const shuffled = shuffle(items, rng)
  return [...shuffled.filter((i) => !seen.has(i.id)), ...shuffled.filter((i) => seen.has(i.id))]
}

/**
 * Builds a mock exam: one question per weight point of each objective, as LPI
 * describes its exams, preferring items the learner hasn't seen. When an
 * objective's pool is short, the rest of its topic fills in; when the bank is
 * short overall, the time limit is scaled to the real pace.
 */
export function buildMockExam(
  pool: readonly Item[],
  exam: ExamId,
  output: boolean,
  seen: ReadonlySet<string> = new Set(),
  rng: Rng = Math.random,
): MockExam {
  const usable = pool.filter((i) => itemInExam(i, exam) && (output || i.kind !== 'output'))
  const picked: Item[] = []
  for (const topic of TOPICS) {
    const queues = new Map(objectivesOf(topic.id).map((o) => [o.id, freshFirst(usable.filter((i) => i.objectiveId === o.id), seen, rng)]))
    let missing = 0
    for (const [id, queue] of queues) {
      const take = queue.splice(0, mockQuota(id))
      picked.push(...take)
      missing += mockQuota(id) - take.length
    }
    // Short objectives borrow from the rest of their topic, so topic counts stay right.
    const rest = shuffle([...queues.values()].flat(), rng)
    picked.push(...rest.slice(0, missing))
  }
  const items = shuffle(picked, rng)
  return {
    exam,
    output,
    items,
    minutes: Math.max(1, Math.round((MOCK.minutes * items.length) / MOCK.items)),
    shortfall: MOCK.items - items.length,
  }
}

/**
 * Draws an untimed mixed practice set. It samples without replacement, with each
 * objective's chance proportional to its blueprint weight (not its pool size), so
 * short sets match the blueprint on average and every objective shows up over a
 * few sessions.
 */
export function buildMixedSet(pool: readonly Item[], weights: ReadonlyMap<string, number>, size: number, rng: Rng = Math.random): Item[] {
  const poolSize = new Map<string, number>()
  for (const i of pool) poolSize.set(i.objectiveId, (poolSize.get(i.objectiveId) ?? 0) + 1)
  // Efraimidis–Spirakis: key = u^(1/w); the largest keys form a weighted sample.
  const keyed = pool.map((item) => {
    const w = (weights.get(item.objectiveId) ?? 0) / (poolSize.get(item.objectiveId) ?? 1)
    return { item, key: w > 0 ? Math.pow(rng(), 1 / w) : -1 }
  })
  keyed.sort((a, b) => b.key - a.key)
  return shuffle(
    keyed.slice(0, size).map((k) => k.item),
    rng,
  )
}

/**
 * A "least mastered" mixed set: per-objective counts come from the same
 * weighted draw as `buildMixedSet`; within each objective, the items with the
 * lowest correct-answer streak are chosen (never answered counts as 0).
 */
export function buildFocusSet(
  pool: readonly Item[],
  weights: ReadonlyMap<string, number>,
  size: number,
  streakOf: (itemId: string) => number,
  rng: Rng = Math.random,
): Item[] {
  const perObjective = new Map<string, number>()
  for (const i of buildMixedSet(pool, weights, size, rng)) perObjective.set(i.objectiveId, (perObjective.get(i.objectiveId) ?? 0) + 1)
  const picked = [...perObjective].flatMap(([id, count]) =>
    orderLeastMastered(
      pool.filter((i) => i.objectiveId === id),
      streakOf,
      rng,
    ).slice(0, count),
  )
  return shuffle(picked, rng)
}

/** Orders a whole pool lowest streak first, in random order within each streak. */
export function orderLeastMastered(pool: readonly Item[], streakOf: (itemId: string) => number, rng: Rng = Math.random): Item[] {
  // Array.prototype.sort is stable, so the shuffle survives within each streak.
  return shuffle(pool, rng).sort((a, b) => streakOf(a.id) - streakOf(b.id))
}
