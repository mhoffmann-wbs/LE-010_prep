// Which items the learner practises, given their exam and the output-items
// toggle, and the blueprint weight of each objective.
import { type ExamId, OBJECTIVES, OBJECTIVE_BY_ID, itemInExam } from '../content/blueprint'
import type { Item } from '../content/schema'

/** The pool: the items on the learner's exam, and "predict the output" items only when the learner wants them. */
export function practicePool(bank: readonly Item[], exam: ExamId, includeOutput: boolean): Item[] {
  return bank.filter((i) => itemInExam(i, exam) && (includeOutput || i.kind !== 'output'))
}

/** Blueprint weight of each objective, straight from the objectives page. */
export function objectiveWeights(): Map<string, number> {
  return new Map(OBJECTIVES.map((o) => [o.id, o.weight]))
}

export const topicOf = (objectiveId: string) => OBJECTIVE_BY_ID.get(objectiveId)!.topicId
