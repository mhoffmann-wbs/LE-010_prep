// Loads every exercise file under src/content/exercises/. Files are JSON arrays
// named <objectiveId>.json; content tests validate them against the schema.
import { type Exercise, exerciseFileSchema } from './exercise'

const files = import.meta.glob<unknown>('./exercises/*.json', { eager: true, import: 'default' })

export const EXERCISE_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), data]),
)

export const EXERCISES: Exercise[] = Object.values(EXERCISE_FILES).flatMap((data) => exerciseFileSchema.parse(data))

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
