import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import type { ExamId } from '../content/blueprint'

// All persisted learner state lives behind this module. Bump VERSION and add a
// migration in `load()` and `importProgress()` whenever the shape changes, and
// keep ProgressSchema in step; never read localStorage elsewhere.
const STORAGE_KEY = 'le010:progress'
const VERSION = 2

export interface ItemStat {
  attempts: number
  correct: number
  lastCorrect: boolean
  lastAt: number
  /** Consecutive correct answers; a wrong answer resets it to 0. */
  streak: number
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
}

export type Toggle = 'outputInPractice' | 'outputInMock'

function empty(): Progress {
  return { version: VERSION, track: '010-200', outputInPractice: true, outputInMock: false, items: {}, mockResults: [], lessonsRead: [] }
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

/** Version 1 had no exam track: everything was 010-200. */
function migrate(data: { version?: unknown; mockResults?: unknown }) {
  if (data.version !== 1) return data
  const mockResults = Array.isArray(data.mockResults) ? data.mockResults.map((r: object) => ({ exam: '010-200', ...r })) : data.mockResults
  return { ...data, version: 2, track: '010-200', mockResults }
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
