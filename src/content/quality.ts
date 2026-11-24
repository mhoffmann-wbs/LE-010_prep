// Anti-giveaway checks for the question bank (PLAN.md §4). Each check returns a
// list of human-readable problems; an empty list means the bank passes.
// Type-only imports: the content scripts run this file directly with Node.
import type { Item } from './schema'

/** Share limits only apply once a pool is big enough for shares to mean anything. */
export const MIN_POOL_FOR_SHARES = 12
export const MAX_SHARE = 0.4
/** Below this, "never pick the longest option" would be a hint too. */
export const MIN_LONGEST_SHARE = 0.15

const LETTERS = 'ABCDEF'

type Options = { text: string; correct: boolean; rationale: string }[]

const optionsOf = (item: Item): Options | undefined => ('options' in item ? item.options : undefined)

/** The four-option questions with one key: single items and output items in choice mode. */
const singles = (items: Item[]): Options[] =>
  items.flatMap((i) => (i.kind === 'single' || (i.kind === 'output' && i.options) ? [optionsOf(i)!] : []))

export const keyLetter = (options: Options) => LETTERS[options.findIndex((o) => o.correct)]!

/** No answer letter may be the key of more than 40% of single-select questions. */
export function keyLetterBalance(items: Item[]): string[] {
  const pool = singles(items)
  if (pool.length < MIN_POOL_FOR_SHARES) return []
  const counts = new Map<string, number>()
  for (const q of pool) counts.set(keyLetter(q), (counts.get(keyLetter(q)) ?? 0) + 1)
  return [...counts]
    .filter(([, n]) => n / pool.length > MAX_SHARE)
    .map(([letter, n]) => `key ${letter} is correct in ${n}/${pool.length} single-select questions (max ${MAX_SHARE * 100}%)`)
}

/** The key should be the strictly longest option in 15–40% of single-select questions. */
export function keyIsLongest(items: Item[]): string[] {
  const pool = singles(items)
  if (pool.length < MIN_POOL_FOR_SHARES) return []
  const longest = pool.filter((options) => {
    const key = options.find((o) => o.correct)!.text.length
    return options.every((o) => o.correct || o.text.length < key)
  }).length
  const share = longest / pool.length
  if (share > MAX_SHARE) return [`key is the longest option in ${longest}/${pool.length} single-select questions (max ${MAX_SHARE * 100}%)`]
  if (share < MIN_LONGEST_SHARE)
    return [`key is the longest option in only ${longest}/${pool.length} single-select questions (min ${MIN_LONGEST_SHARE * 100}%)`]
  return []
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Stems must be unique; output items count stem and command together. */
export function duplicateStems(items: Item[]): string[] {
  const seen = new Map<string, string>()
  const problems: string[] = []
  for (const item of items) {
    const key = norm(item.kind === 'output' ? `${item.stem} ${item.command}` : item.stem)
    const other = seen.get(key)
    if (other) problems.push(`${item.id} duplicates the stem of ${other}`)
    else seen.set(key, item.id)
  }
  return problems
}

const LETTER_REF = /\b([Oo]ption|[Aa]nswer|[Cc]hoice)\s+[A-F]\b|\([A-F]\)|\b[A-F]\)\s/

const explanationTexts = (item: Item): string[] => [item.explanation, ...(optionsOf(item) ?? []).map((o) => o.rationale)]

/** Explanations and rationales must not cite option letters, so options can be reordered. */
export function letterReferences(items: Item[]): string[] {
  return items.flatMap((item) => (explanationTexts(item).some((t) => LETTER_REF.test(t)) ? [`${item.id} refers to an option letter`] : []))
}

export const QUALITY_CHECKS = { keyLetterBalance, keyIsLongest, duplicateStems, letterReferences }
