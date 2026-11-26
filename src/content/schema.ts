// Zod schema for question-bank items. Items live as JSON arrays in
// src/content/questions/<objectiveId>.json and are rendered generically.
// Cross-checks against the blueprint (objective, area and term ids) live in the
// content tests, so this file stays independent of that data.
import { z } from 'zod'
import { USERS } from '../vm/job.ts'
import { FIXTURE_NAME } from './fixture.ts'

const nonEmpty = z.string().trim().min(1)

export const OBJECTIVE_ID = /^01[1-5]\.[1-4]$/
/** 2.0 ids ("013.2.3", "013.2.t5") and v1.6-only ones ("013.2.v1", "013.2.vt1"). */
const AREA_ID = /^01[1-5]\.[1-4]\.v?\d+$/
const TERM_ID = /^01[1-5]\.[1-4]\.v?t\d+$/

const option = z.object({
  text: nonEmpty,
  correct: z.boolean(),
  /** Why this option is right, or why it misses the stated constraint. */
  rationale: nonEmpty,
})

/** An option that is a command's output: kept exactly, since leading spaces are part of it. */
const outputOption = option.extend({ text: z.string().refine((s) => s.trim() !== '', 'is empty') })

export const COUNT_WORDS = ['', 'ONE', 'TWO', 'THREE', 'FOUR'] as const

const base = {
  /** `${objectiveId}-NNN`, e.g. "013.2-014". Stored in progress: never renumber or reuse. */
  id: z.string().regex(/^01[1-5]\.[1-4]-\d{3}$/),
  objectiveId: z.string().regex(OBJECTIVE_ID),
  /** Key knowledge area ids the item tests, e.g. ["013.2.3"]. They decide which exams it is on (`itemInExam`). */
  areas: z.array(z.string().regex(AREA_ID)).min(1),
  /** Ids of the objective's listed files, terms and utilities the item tests. */
  terms: z.array(z.string().regex(TERM_ID)).optional(),
  stem: nonEmpty,
  explanation: nonEmpty,
  /** Pages backing facts that change, e.g. distribution release models. */
  sourceLinks: z.array(z.url()).optional(),
}

const single = z.object({
  ...base,
  kind: z.literal('single'),
  options: z.array(option).length(4),
})

const multi = z.object({
  ...base,
  kind: z.literal('multi'),
  /** How many options to pick; the stem must say "(Choose TWO.)" etc. */
  select: z.number().int().min(2).max(3),
  options: z.array(option).min(5).max(6),
})

/** Short input: the learner types a command, option, path or value. */
const fill = z.object({
  ...base,
  kind: z.literal('fill'),
  /** Every accepted answer, compared after normaliseAnswer(). The first is shown as the key. */
  accept: z.array(nonEmpty).min(1),
  /** Linux is case-sensitive, so answers are too unless this says otherwise. */
  caseSensitive: z.boolean().default(true),
  /** Text shown in front of the input, e.g. "$ tar" for "complete the command". */
  prefix: z.string().optional(),
  /**
   * Proves every accepted answer works: `command` with `{answer}` replaced by
   * each answer must exit 0 in the guest. Required with a `prefix`.
   */
  verify: z
    .object({
      command: z.string().includes('{answer}'),
      fixture: z.string().regex(FIXTURE_NAME).optional(),
      user: z.enum(USERS).optional(),
    })
    .optional(),
})

/**
 * Predict the output: `command` runs as `user` (default mira) in their home
 * directory, after `fixture` is applied, and `output` is what it prints. The
 * output must come from running the command in the guest, never from memory
 * (PLAN.md §5c); content:verify records it.
 */
const output = z.object({
  ...base,
  kind: z.literal('output'),
  command: nonEmpty,
  /** A file tree from src/content/fixtures/, by name. */
  fixture: z.string().regex(FIXTURE_NAME).optional(),
  user: z.enum(USERS).optional(),
  /** Exactly what the command prints, without the final newline. */
  output: z.string(),
  /** Pick from four outputs, or type the output. */
  mode: z.enum(['choice', 'type']),
  /** For mode "choice": four outputs; the correct one's text equals `output`. */
  options: z.array(outputOption).length(4).optional(),
})

function checkOptions(q: { kind: string; stem: string; options: { text: string; correct: boolean }[]; select?: number }, ctx: z.RefinementCtx) {
  const correct = q.options.filter((o) => o.correct).length
  const want = q.kind === 'multi' ? q.select! : 1
  if (correct !== want) ctx.addIssue({ code: 'custom', path: ['options'], message: `has ${correct} correct options, expected ${want}` })
  if (q.kind === 'multi' && !q.stem.includes(`(Choose ${COUNT_WORDS[want]}.)`))
    ctx.addIssue({ code: 'custom', path: ['stem'], message: `stem must say "(Choose ${COUNT_WORDS[want]}.)"` })
  const texts = q.options.map((o) => o.text.trim().toLowerCase())
  if (new Set(texts).size !== texts.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'has duplicate options' })
}

export const itemSchema = z.discriminatedUnion('kind', [single, multi, fill, output]).superRefine((item, ctx) => {
  if (!item.id.startsWith(`${item.objectiveId}-`))
    ctx.addIssue({ code: 'custom', path: ['id'], message: `id must start with "${item.objectiveId}-"` })
  for (const id of [...item.areas, ...(item.terms ?? [])])
    if (!id.startsWith(`${item.objectiveId}.`)) ctx.addIssue({ code: 'custom', path: ['areas'], message: `${id} is not in ${item.objectiveId}` })
  switch (item.kind) {
    case 'single':
    case 'multi':
      checkOptions(item, ctx)
      break
    case 'fill':
      if (new Set(item.accept.map((a) => normaliseAnswer(a, item.caseSensitive))).size !== item.accept.length)
        ctx.addIssue({ code: 'custom', path: ['accept'], message: 'has duplicate answers' })
      if (item.prefix !== undefined && !item.verify)
        ctx.addIssue({ code: 'custom', path: ['verify'], message: 'an item with a prefix needs `verify`, to prove each answer works with it' })
      break
    case 'output':
      if (item.mode === 'choice') {
        if (!item.options) {
          ctx.addIssue({ code: 'custom', path: ['options'], message: 'choice mode needs four options' })
          break
        }
        checkOptions({ ...item, options: item.options }, ctx)
        if (item.options.find((o) => o.correct)?.text !== item.output)
          ctx.addIssue({ code: 'custom', path: ['options'], message: 'the correct option must equal `output`' })
      } else {
        if (item.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'type mode has no options' })
        if (item.output.trim() === '') ctx.addIssue({ code: 'custom', path: ['output'], message: 'type mode needs a non-empty output' })
      }
      break
  }
})

export const itemFileSchema = z.array(itemSchema)

/** A lesson (src/content/lessons/<objectiveId>.mdx) exports this as `meta`. */
export const lessonMetaSchema = z.object({
  objectiveId: z.string().regex(OBJECTIVE_ID),
  /** Date the lesson's facts were last checked. */
  updated: z.iso.date(),
  /** One or two sentences: what the learner must take away. */
  tldr: nonEmpty,
  /** Key knowledge area ids the lesson teaches; a content test requires all of the objective's. */
  areasCovered: z.array(z.string().regex(AREA_ID)).min(1),
  /** Term ids the lesson teaches; a content test requires all of the objective's. */
  termsCovered: z.array(z.string().regex(TERM_ID)).min(1),
  /** Sources for the lesson's facts (man pages, distribution docs). The LPI materials are linked on every lesson page. */
  links: z.array(z.object({ title: nonEmpty, url: z.url() })).min(1),
})

export type LessonMeta = z.infer<typeof lessonMetaSchema>

export type Item = z.infer<typeof itemSchema>
export type ItemKind = Item['kind']

/** The text that identifies an item in lists. Output items add their command, since stems repeat. */
export const itemSummary = (item: Item) => (item.kind === 'output' ? `${item.stem} \`${item.command}\`` : item.stem)

/**
 * Compares typed answers: trims, collapses runs of whitespace, and ignores case
 * only when the item allows it.
 */
export function normaliseAnswer(text: string, caseSensitive = true): string {
  const s = text.trim().replace(/\s+/g, ' ')
  return caseSensitive ? s : s.toLowerCase()
}

/** Compares a typed output: trailing spaces on each line and trailing blank lines don't count. */
export const normaliseOutput = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '')
