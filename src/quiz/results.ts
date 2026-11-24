// Scores a finished mock exam: pass/fail, a scaled score (an estimate), and
// results per topic and per objective.
import { EXAM_FORMAT, OBJECTIVES, TOPICS, estimateScaledScore } from '../content/blueprint'
import type { Item } from '../content/schema'

export interface ScoreRow {
  id: string
  label: string
  correct: number
  total: number
}

export interface MockScore {
  correct: number
  total: number
  percent: number
  /** Estimate on the 200–800 scale; always label it as one. */
  scaled: number
  passed: boolean
  topics: ScoreRow[]
  objectives: ScoreRow[]
}

export const percent = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 100))

export function scoreMock(items: readonly Item[], correct: (item: Item) => boolean): MockScore {
  const row = (id: string, label: string, xs: readonly Item[]): ScoreRow => ({ id, label, correct: xs.filter(correct).length, total: xs.length })
  const topics = TOPICS.map((t) => row(t.id, t.title, items.filter((i) => i.objectiveId.startsWith(`${t.id}.`))))
  const objectives = OBJECTIVES.map((o) => row(o.id, o.title, items.filter((i) => i.objectiveId === o.id))).filter((r) => r.total > 0)
  const all = row('all', 'All', items)
  const scaled = all.total ? estimateScaledScore(all.correct / all.total) : EXAM_FORMAT.scaleMin
  return {
    correct: all.correct,
    total: all.total,
    percent: percent(all.correct, all.total),
    scaled,
    passed: scaled >= EXAM_FORMAT.passScore,
    topics,
    objectives,
  }
}
