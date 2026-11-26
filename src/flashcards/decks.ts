// Built-in and own flashcards behind one shape. Built-in cards form one deck per
// topic, holding the cards on the learner's exam track; own decks come from
// progress.
import { type ExamId, OBJECTIVE_BY_ID, TOPICS, itemInExam, topicName } from '../content/blueprint'
import { CARDS } from '../content/flashcards'
import type { Progress, UserCard } from '../progress/store'

export interface StudyCard {
  id: string
  front: string
  back: string
  /** Built-in cards only. */
  objectiveId: string | null
}

export interface Deck {
  /** "t011"…"t015" for topics, or an own deck's id. */
  id: string
  name: string
  own: boolean
  cards: StudyCard[]
}

type Settings = Pick<Progress, 'decks' | 'myCards' | 'track'>

const builtIn = (track: ExamId): StudyCard[] =>
  CARDS.filter((c) => itemInExam(c, track)).map((c) => ({ id: c.id, front: c.front, back: c.back, objectiveId: c.id.split('-')[0]! }))

export const fromOwn = (c: UserCard): StudyCard => ({ id: c.id, front: c.front, back: c.back, objectiveId: null })

export function builtInDecks(track: ExamId): Deck[] {
  const cards = builtIn(track)
  return TOPICS.map((t) => ({
    id: `t${t.id}`,
    name: topicName(t.id, track),
    own: false,
    cards: cards.filter((c) => OBJECTIVE_BY_ID.get(c.objectiveId!)!.topicId === t.id),
  })).filter((d) => d.cards.length > 0)
}

export function ownDecks({ decks, myCards }: Pick<Progress, 'decks' | 'myCards'>): Deck[] {
  return decks.map((d) => ({ id: d.id, name: d.name, own: true, cards: myCards.filter((c) => c.deckId === d.id).map(fromOwn) }))
}

export const allDecks = (settings: Settings): Deck[] => [...builtInDecks(settings.track), ...ownDecks(settings)]

/** What a review page asks for: one deck, one objective's built-in cards, or (neither) every deck. */
export interface CardQuery {
  deck?: string | null
  objective?: string | null
}

export function cardsFor({ deck, objective }: CardQuery, settings: Settings): StudyCard[] {
  if (objective) return builtIn(settings.track).filter((c) => c.objectiveId === objective)
  const decks = allDecks(settings)
  if (deck) return decks.find((d) => d.id === deck)?.cards ?? []
  return decks.flatMap((d) => d.cards)
}
