// Learner responses and all-or-nothing grading for every item kind.
import { type Item, normaliseAnswer, normaliseOutput } from '../content/schema'

export type Response =
  | { kind: 'single'; choice: number | null }
  | { kind: 'multi'; choices: number[] }
  | { kind: 'fill'; text: string }
  /** `choice` in choice mode, `text` in type mode. */
  | { kind: 'output'; choice: number | null; text: string }

export function emptyResponse(item: Item): Response {
  switch (item.kind) {
    case 'single':
      return { kind: 'single', choice: null }
    case 'multi':
      return { kind: 'multi', choices: [] }
    case 'fill':
      return { kind: 'fill', text: '' }
    case 'output':
      return { kind: 'output', choice: null, text: '' }
  }
}

/** Whether the learner has given an answer that can be checked. */
export function isAnswered(item: Item, r: Response): boolean {
  switch (item.kind) {
    case 'single':
      return r.kind === 'single' && r.choice !== null
    case 'multi':
      return r.kind === 'multi' && r.choices.length === item.select
    case 'fill':
      return r.kind === 'fill' && r.text.trim() !== ''
    case 'output':
      return r.kind === 'output' && (item.mode === 'choice' ? r.choice !== null : r.text.trim() !== '')
  }
}

export function grade(item: Item, r: Response): boolean {
  switch (item.kind) {
    case 'single':
      return r.kind === 'single' && r.choice !== null && !!item.options[r.choice]?.correct
    case 'multi': {
      if (r.kind !== 'multi') return false
      const key = item.options.flatMap((o, i) => (o.correct ? [i] : []))
      return r.choices.length === key.length && key.every((i) => r.choices.includes(i))
    }
    case 'fill':
      return r.kind === 'fill' && item.accept.some((a) => normaliseAnswer(a, item.caseSensitive) === normaliseAnswer(r.text, item.caseSensitive))
    case 'output':
      if (r.kind !== 'output') return false
      return item.mode === 'choice'
        ? r.choice !== null && !!item.options?.[r.choice]?.correct
        : normaliseOutput(r.text) === normaliseOutput(item.output)
  }
}
