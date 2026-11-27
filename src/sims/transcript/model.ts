// Shared by the transcript simulators (services, ssh, network, users,
// packages): scenes that replay steps of one captured transcript, then ask
// questions whose answers the learner can find in that output. A content test
// checks that every step key exists and every question's evidence appears in
// its step's output, so no answer rests on text the capture didn't print.
import { z } from 'zod'
import type { TranscriptStep } from '../../content/transcript'

const nonEmpty = z.string().trim().min(1)
const KEY = z.string().regex(/^[a-z][a-z0-9-]*$/)

export const questionSchema = z
  .object({
    prompt: nonEmpty,
    answer: nonEmpty,
    distractors: z.array(nonEmpty).length(3),
    /** Why the answer is right, shown after the pick (`code` spans allowed). */
    why: nonEmpty,
    /** Where the answer shows: text that appears verbatim in that step's output, highlighted after the pick. */
    evidence: z.object({ step: KEY, text: z.string().min(1) }),
  })
  .refine((q) => new Set([q.answer, ...q.distractors]).size === 4, 'the four answers must differ')

export const sceneSchema = z.object({
  title: nonEmpty,
  /** What happens in the scene, shown before its commands (`code` spans allowed). */
  text: nonEmpty,
  /** Step keys of the transcript, replayed in this order. */
  steps: z.array(KEY).min(1),
  /** A note per step key, shown under that step's output. */
  notes: z.record(z.string(), nonEmpty).optional(),
  questions: z.array(questionSchema),
})

export const paramsSchema = z.object({
  transcript: KEY,
  scenes: z.array(sceneSchema).min(2),
})

export type ReplayParams = z.infer<typeof paramsSchema>
export type Scene = z.infer<typeof sceneSchema>
export type Question = z.infer<typeof questionSchema>

/** The prompt a step's line starts with: `mira@build:~$ `, or `#` for root. */
export const promptOf = (step: Pick<TranscriptStep, 'user' | 'host' | 'cwd'>) =>
  `${step.user}@${step.host}:${step.user === 'root' ? step.cwd.replace(/^~/, '/root') : step.cwd}${step.user === 'root' ? '#' : '$'} `

/** The four answers in a fixed order that doesn't give the key away: sorted by a hash of the text. */
export function choices(q: Question): string[] {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return [q.answer, ...q.distractors].sort((a, b) => hash(a) - hash(b))
}

/** Splits output around the first occurrence of `text`, for highlighting. */
export function splitAt(output: string, text: string): [string, string, string] | null {
  const i = output.indexOf(text)
  return i < 0 ? null : [output.slice(0, i), text, output.slice(i + text.length)]
}
