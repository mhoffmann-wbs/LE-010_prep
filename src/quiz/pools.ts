// Which items the learner practises, given the output-items toggle, and the
// blueprint weight of each objective.
import { OBJECTIVES, OBJECTIVE_BY_ID } from '../content/blueprint'
import type { Item } from '../content/schema'

/** The pool: "predict the output" items only when the learner wants them. */
export function practicePool(bank: readonly Item[], includeOutput: boolean): Item[] {
  return includeOutput ? [...bank] : bank.filter((i) => i.kind !== 'output')
}

/** Blueprint weight of each objective, straight from the objectives page. */
export function objectiveWeights(): Map<string, number> {
  return new Map(OBJECTIVES.map((o) => [o.id, o.weight]))
}

export const topicOf = (objectiveId: string) => OBJECTIVE_BY_ID.get(objectiveId)!.topicId
