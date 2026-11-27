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
export const AREA_ID = /^01[1-5]\.[1-4]\.v?\d+$/
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

// Built-in flashcards (src/content/flashcards/<objectiveId>.json). Card ids are
// `<objectiveId>-cNN` in file order and are stored in progress, so append, never
// renumber. Their areas and terms decide which exam track shows them, as for items.
export const cardSchema = z
  .object({
    id: z.string().regex(/^01[1-5]\.[1-4]-c\d{2}$/),
    /** Key knowledge areas of the card's objective that it covers. */
    areas: z.array(z.string().regex(AREA_ID)).min(1),
    /** Listed files, terms and utilities it covers: tag one that only one exam lists, so the other track hides the card. */
    terms: z.array(z.string().regex(TERM_ID)).optional(),
    /** Text with `code` spans; a blank line starts a new paragraph. */
    front: nonEmpty,
    back: nonEmpty,
  })
  .superRefine((card, ctx) => {
    const objectiveId = card.id.split('-')[0]!
    for (const id of [...card.areas, ...(card.terms ?? [])])
      if (!id.startsWith(`${objectiveId}.`)) ctx.addIssue({ code: 'custom', message: `${id} isn't a line of ${objectiveId}`, path: ['areas'] })
  })

export const cardFileSchema = z.array(cardSchema)

export type Card = z.infer<typeof cardSchema>

// Matcher drills (src/content/drills/<deckId>.json). Card ids are `<deckId>-NN`
// and are stored in progress, so append, never renumber or reuse one.
const drillBase = {
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: nonEmpty,
  /** One sentence on what the deck drills. */
  description: nonEmpty,
  /** Objectives whose lessons link to the deck. */
  objectives: z.array(z.string().regex(OBJECTIVE_ID)).min(1),
}

/** "Which command?" / "Which file?": a scenario and four answers (`code` spans allowed) to pick from. */
const whichDeck = z.object({
  ...drillBase,
  kind: z.literal('which'),
  cards: z
    .array(
      z.object({
        id: z.string(),
        prompt: nonEmpty,
        answer: nonEmpty,
        /** Exactly three answers that each miss the scenario. */
        distractors: z.array(nonEmpty).length(3),
        /** Why the answer fits, shown after the pick. */
        why: nonEmpty,
      }),
    )
    .min(8),
})

/** Sorter: put each item into one of 2–4 buckets. */
const sortDeck = z.object({
  ...drillBase,
  kind: z.literal('sort'),
  buckets: z.array(z.object({ id: nonEmpty, label: nonEmpty })).min(2).max(4),
  items: z.array(z.object({ id: z.string(), text: nonEmpty, bucket: nonEmpty, why: nonEmpty })).min(8),
})

export const drillDeckSchema = z.discriminatedUnion('kind', [whichDeck, sortDeck]).superRefine((deck, ctx) => {
  const ids = deck.kind === 'which' ? deck.cards.map((c) => c.id) : deck.items.map((i) => i.id)
  ids.forEach((id, i) => {
    const want = `${deck.id}-${String(i + 1).padStart(2, '0')}`
    if (id !== want) ctx.addIssue({ code: 'custom', message: `card ${i + 1} must have id ${want}, not ${id}` })
  })
  if (deck.kind === 'which')
    for (const c of deck.cards)
      if (new Set([c.answer, ...c.distractors]).size !== 4) ctx.addIssue({ code: 'custom', message: `${c.id}: the four answers must differ` })
  if (deck.kind === 'sort') {
    const buckets = new Set(deck.buckets.map((b) => b.id))
    for (const i of deck.items) if (!buckets.has(i.bucket)) ctx.addIssue({ code: 'custom', message: `${i.id}: unknown bucket ${i.bucket}` })
  }
})

export type DrillDeck = z.infer<typeof drillDeckSchema>
export type WhichDeck = Extract<DrillDeck, { kind: 'which' }>
export type SortDeck = Extract<DrillDeck, { kind: 'sort' }>

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

// Simulators (src/content/sims/<simId>.json): the copy around one interactive
// part in src/sims/<simId>/, whose own schema validates `params`.
export const simSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: nonEmpty,
  /** One sentence for the simulator list. */
  description: nonEmpty,
  /** What to try first, shown above the simulator. */
  intro: nonEmpty,
  /** Objectives the simulator teaches; their lessons link to it. */
  objectives: z.array(z.string().regex(OBJECTIVE_ID)).min(1),
  /** Exam-relevant points, shown below the simulator (`code` spans allowed). */
  takeaways: z.array(nonEmpty).min(2),
  /** 3–5 bank items for "Now you try", each testing one of the objectives; at least 2 on 010-200 and 1 on 010-160. */
  tryItems: z.array(z.string()).min(3).max(5),
  /** Sources for the facts the simulator states. */
  links: z.array(z.object({ title: nonEmpty, url: z.url() })).min(1),
  /** Simulator-specific copy and parameters, validated by the registry's schema. */
  params: z.unknown(),
})

export type Sim = z.infer<typeof simSchema>
