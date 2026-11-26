import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import type { ExamId } from '../content/blueprint'

// All persisted learner state lives behind this module. Bump VERSION and add a
// migration in `load()` and `importProgress()` whenever the shape changes, and
// keep ProgressSchema in step; never read localStorage elsewhere.
const STORAGE_KEY = 'le010:progress'
const VERSION = 4

export interface ItemStat {
  attempts: number
  correct: number
  lastCorrect: boolean
  lastAt: number
  /** Consecutive correct answers; a wrong answer resets it to 0. */
  streak: number
}

export interface ExerciseStat {
  /** How often the learner pressed Check. */
  attempts: number
  /** When a check first passed, or null. */
  solvedAt: number | null
}

/** Spaced-review state of one flashcard (built-in or the learner's own). */
export interface CardStat {
  /** Leitner box 0–5: the higher the box, the longer until the card comes back. */
  box: number
  /** When the card is next due (ms since epoch). */
  due: number
  reviews: number
  /** Times the card was rated Again after it had been learned once. */
  lapses: number
  lastAt: number
}

/** A deck of the learner's own flashcards. */
export interface UserDeck {
  id: string
  name: string
  createdAt: number
}

export interface UserCard {
  id: string
  deckId: string
  front: string
  back: string
  createdAt: number
  updatedAt: number
}

/** A learner's record on one drill deck. */
export interface DrillStat {
  rounds: number
  /** Best round score in percent. */
  best: number
  /** Longest run of correct answers within one round. */
  bestStreak: number
  lastAt: number
}

export interface DrillRound {
  correct: number
  total: number
  streak: number
  /** Card ids answered wrongly and rightly in the round. */
  missed: string[]
  hit: string[]
}

export interface ScoreRowRecord {
  id: string
  correct: number
  total: number
}

export interface MockResult {
  at: number
  /** The exam it was a mock of. */
  exam: ExamId
  /** "Predict the output" items were included. */
  output: boolean
  correct: number
  total: number
  percent: number
  /** Scaled-score estimate (200–800). */
  scaled: number
  passed: boolean
  topics: ScoreRowRecord[]
}

export interface Progress {
  version: typeof VERSION
  /** The exam the learner prepares for; it filters practice, the mock exam, readiness and lessons. */
  track: ExamId
  /** Include "predict the output" items in practice and the question bank. */
  outputInPractice: boolean
  /** Include them in the mock exam. */
  outputInMock: boolean
  items: Record<string, ItemStat>
  mockResults: MockResult[]
  /** Objective ids whose lesson the learner marked as read. */
  lessonsRead: string[]
  /** Terminal exercises by id. */
  exercises: Record<string, ExerciseStat>
  /** Per drill deck id. */
  drills: Record<string, DrillStat>
  /** Drill card ids last answered wrongly; a right answer removes one. */
  drillMisses: string[]
  /** Review state per flashcard id, for built-in and own cards. */
  cards: Record<string, CardStat>
  decks: UserDeck[]
  myCards: UserCard[]
}

export type Toggle = 'outputInPractice' | 'outputInMock'

function empty(): Progress {
  return { version: VERSION, track: '010-200', outputInPractice: true, outputInMock: false, items: {}, mockResults: [], lessonsRead: [], exercises: {}, drills: {}, drillMisses: [], cards: {}, decks: [], myCards: [] }
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty()
    const parsed = migrate(JSON.parse(raw))
    if (parsed.version !== VERSION) return empty()
    return { ...empty(), ...parsed } as Progress
  } catch {
    return empty()
  }
}

/** Version 1 had no exam track (everything was 010-200), version 2 no exercises, version 3 no drills or flashcards. */
function migrate(data: { version?: unknown; mockResults?: unknown; [key: string]: unknown }) {
  if (data.version === 1) {
    const mockResults = Array.isArray(data.mockResults) ? data.mockResults.map((r: object) => ({ exam: '010-200', ...r })) : data.mockResults
    data = { ...data, version: 2, track: '010-200', mockResults }
  }
  if (data.version === 2) data = { ...data, version: 3, exercises: {} }
  if (data.version === 3) data = { ...data, version: 4, drills: {}, drillMisses: [], cards: {}, decks: [], myCards: [] }
  return data
}

let state: Progress = load()
const listeners = new Set<() => void>()

function commit(next: Progress) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private mode, quota); keep in-memory state.
  }
  listeners.forEach((l) => l())
}

export function getProgress(): Progress {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress)
}

export function recordAnswer(itemId: string, correct: boolean, at: number = Date.now()) {
  const prev = state.items[itemId] ?? { attempts: 0, correct: 0, lastCorrect: false, lastAt: 0, streak: 0 }
  commit({
    ...state,
    items: {
      ...state.items,
      [itemId]: {
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        lastCorrect: correct,
        lastAt: at,
        streak: correct ? prev.streak + 1 : 0,
      },
    },
  })
}

export function recordMockResult(result: MockResult) {
  commit({ ...state, mockResults: [...state.mockResults, result] })
}

export function setToggle(which: Toggle, on: boolean) {
  commit({ ...state, [which]: on })
}

export function setTrack(track: ExamId) {
  commit({ ...state, track })
}

export function setLessonRead(objectiveId: string, read: boolean) {
  const others = state.lessonsRead.filter((id) => id !== objectiveId)
  commit({ ...state, lessonsRead: read ? [...others, objectiveId] : others })
}

export function recordExerciseCheck(exerciseId: string, passed: boolean, at: number = Date.now()) {
  const prev = state.exercises[exerciseId] ?? { attempts: 0, solvedAt: null }
  const solvedAt = prev.solvedAt ?? (passed ? at : null)
  commit({ ...state, exercises: { ...state.exercises, [exerciseId]: { attempts: prev.attempts + 1, solvedAt } } })
}

export function recordDrillRound(deckId: string, round: DrillRound, at: number = Date.now()) {
  const prev = state.drills[deckId] ?? { rounds: 0, best: 0, bestStreak: 0, lastAt: 0 }
  const percent = round.total ? Math.round((round.correct / round.total) * 100) : 0
  const hit = new Set(round.hit)
  const kept = state.drillMisses.filter((id) => !hit.has(id) && !round.missed.includes(id))
  commit({
    ...state,
    drills: {
      ...state.drills,
      [deckId]: {
        rounds: prev.rounds + 1,
        best: Math.max(prev.best, percent),
        bestStreak: Math.max(prev.bestStreak, round.streak),
        lastAt: at,
      },
    },
    drillMisses: [...kept, ...round.missed],
  })
}

export function recordCardReview(cardId: string, stat: CardStat) {
  commit({ ...state, cards: { ...state.cards, [cardId]: stat } })
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

/** Creates an empty deck of own cards and returns its id. */
export function createDeck(name: string, at: number = Date.now()): string {
  const id = newId('d')
  commit({ ...state, decks: [...state.decks, { id, name, createdAt: at }] })
  return id
}

export function renameDeck(deckId: string, name: string) {
  commit({ ...state, decks: state.decks.map((d) => (d.id === deckId ? { ...d, name } : d)) })
}

/** Deletes a deck with its cards and their review state. */
export function deleteDeck(deckId: string) {
  const gone = new Set(state.myCards.filter((c) => c.deckId === deckId).map((c) => c.id))
  commit({
    ...state,
    decks: state.decks.filter((d) => d.id !== deckId),
    myCards: state.myCards.filter((c) => !gone.has(c.id)),
    cards: Object.fromEntries(Object.entries(state.cards).filter(([id]) => !gone.has(id))),
  })
}

export type CardDraft = Pick<UserCard, 'deckId' | 'front' | 'back'>

/** Adds own cards (e.g. one typed in, or a whole uploaded deck) and returns their ids. */
export function addCards(drafts: CardDraft[], at: number = Date.now()): string[] {
  const added = drafts.map((d): UserCard => ({ ...d, id: newId('u'), createdAt: at, updatedAt: at }))
  commit({ ...state, myCards: [...state.myCards, ...added] })
  return added.map((c) => c.id)
}

/** Changes an own card's text. Its review state is kept. */
export function updateCard(cardId: string, change: Pick<UserCard, 'front' | 'back'>, at: number = Date.now()) {
  commit({ ...state, myCards: state.myCards.map((c) => (c.id === cardId ? { ...c, ...change, updatedAt: at } : c)) })
}

export function deleteCard(cardId: string) {
  const { [cardId]: _, ...cards } = state.cards
  commit({ ...state, myCards: state.myCards.filter((c) => c.id !== cardId), cards })
}

// Imports come from files people pick, so they are validated in full before replacing anything.
const count = z.number().int().nonnegative()
const row = z.object({ id: z.string(), correct: count, total: count })
const ProgressSchema = z.object({
  version: z.literal(VERSION),
  track: z.enum(['010-200', '010-160']),
  outputInPractice: z.boolean(),
  outputInMock: z.boolean(),
  items: z.record(
    z.string(),
    z.object({ attempts: count, correct: count, lastCorrect: z.boolean(), lastAt: z.number(), streak: count }),
  ),
  mockResults: z.array(
    z.object({
      at: z.number(),
      exam: z.enum(['010-200', '010-160']),
      output: z.boolean(),
      correct: count,
      total: count,
      percent: z.number(),
      scaled: z.number(),
      passed: z.boolean(),
      topics: z.array(row),
    }),
  ),
  lessonsRead: z.array(z.string()),
  exercises: z.record(z.string(), z.object({ attempts: count, solvedAt: z.number().nullable() })),
  drills: z.record(z.string(), z.object({ rounds: count, best: z.number().min(0).max(100), bestStreak: count, lastAt: z.number() })),
  drillMisses: z.array(z.string()),
  cards: z.record(z.string(), z.object({ box: z.number().int().min(0).max(5), due: z.number(), reviews: count, lapses: count, lastAt: z.number() })),
  decks: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.number() })),
  myCards: z.array(
    z.object({ id: z.string(), deckId: z.string(), front: z.string(), back: z.string(), createdAt: z.number(), updatedAt: z.number() }),
  ),
})

const EXPORT_APP = 'le-010-prep'

/** The learner's progress as a JSON document they can save and import elsewhere. */
export function exportProgress(at: Date = new Date()): string {
  return JSON.stringify({ app: EXPORT_APP, exportedAt: at.toISOString(), progress: state }, null, 2)
}

/**
 * Replaces all progress with the contents of an export.
 * Throws an Error with a message for the learner if the file isn't a usable export.
 */
export function importProgress(json: string) {
  let doc: { app?: unknown; progress?: { version?: unknown; mockResults?: unknown } }
  try {
    doc = JSON.parse(json)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  if (doc?.app !== EXPORT_APP || typeof doc.progress !== 'object' || doc.progress === null) {
    throw new Error("This file isn't an LE-010 Prep progress export.")
  }
  const { version } = doc.progress
  if (typeof version === 'number' && version > VERSION) {
    throw new Error('This export comes from a newer version of the app. Reload the app, then import it again.')
  }
  const result = ProgressSchema.safeParse({ ...empty(), ...migrate(doc.progress) })
  if (!result.success) throw new Error('This export is damaged or incomplete, so nothing was imported.')
  commit(result.data)
}

export function resetProgress() {
  commit(empty())
}

/** Re-read from storage. Used by tests after manipulating localStorage directly. */
export function reloadProgress() {
  state = load()
  listeners.forEach((l) => l())
}
