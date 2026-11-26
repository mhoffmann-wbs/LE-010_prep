// Loads every built-in flashcard file under src/content/flashcards/. Files are
// JSON arrays named <objectiveId>.json; content tests validate them.
import { type Card, cardFileSchema } from './schema'

const files = import.meta.glob<unknown>('./flashcards/*.json', { eager: true, import: 'default' })

export const CARD_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), data]),
)

export const CARDS: Card[] = Object.values(CARD_FILES).flatMap((data) => cardFileSchema.parse(data))
