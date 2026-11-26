// Loads every drill deck under src/content/drills/ (JSON files named
// <deckId>.json), in blueprint order; content tests validate them.
import { type DrillDeck, drillDeckSchema } from './schema'

const files = import.meta.glob<unknown>('./drills/*.json', { eager: true, import: 'default' })

export const DRILL_FILES: Record<string, unknown> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), data]),
)

const byFirstObjective = (a: DrillDeck, b: DrillDeck) => a.objectives[0]!.localeCompare(b.objectives[0]!, 'en', { numeric: true }) || a.id.localeCompare(b.id)

export const DRILL_DECKS: DrillDeck[] = Object.values(DRILL_FILES)
  .map((data) => drillDeckSchema.parse(data))
  .sort(byFirstObjective)

export const DRILL_DECK_BY_ID = new Map(DRILL_DECKS.map((d) => [d.id, d]))

/** Every card id of a deck, in deck order. */
export const cardIds = (deck: DrillDeck): string[] => (deck.kind === 'which' ? deck.cards.map((c) => c.id) : deck.items.map((i) => i.id))
