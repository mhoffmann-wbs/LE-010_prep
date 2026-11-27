// Licence chooser: licences described by a few facts (what they require of
// someone who passes the work on, whether commercial use and changes are
// allowed, whether credit is needed), and a matcher that turns the learner's
// answers into the licences that fit and the reason each other one doesn't.
// The facts come from the licences' own pages (see `links` in the content file).
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)

/** What a licence demands when someone shares a changed copy. */
export const COPYLEFT = ['none', 'program', 'library', 'network', 'adaptations'] as const
export type Copyleft = (typeof COPYLEFT)[number]

export const licenceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: nonEmpty,
  /** The usual abbreviation, shown on the buttons. */
  short: nonEmpty,
  family: z.enum(['copyleft', 'permissive', 'creative-commons', 'dedication']),
  /** What it is meant for. */
  applies: z.enum(['code', 'content', 'both']),
  /**
   * none: no duty to share changes. program: changed copies of the whole
   * program stay under the licence (GPL). library: only the library itself
   * (LGPL). network: also when users only reach it over a network (AGPL).
   * adaptations: adaptations of content must carry the same licence (SA).
   */
  copyleft: z.enum(COPYLEFT),
  /** May others use it commercially (sell it, ship it in a product)? */
  commercial: z.boolean(),
  /** May others share changed versions (derivatives)? */
  changes: z.boolean(),
  /** Does it require crediting you or keeping your notice? */
  credit: z.boolean(),
  summary: nonEmpty,
  /** The conditions in plain words. */
  conditions: z.array(nonEmpty).min(1),
  /** One thing learners get wrong about it. */
  watchOut: nonEmpty,
})
export type Licence = z.infer<typeof licenceSchema>

export const paramsSchema = z
  .object({
    licences: z.array(licenceSchema).min(10),
    scenarios: z
      .array(
        z.object({
          text: nonEmpty,
          /** Licence ids to pick from (3–4). */
          options: z.array(z.string()).min(3).max(4),
          answer: z.string(),
          why: nonEmpty,
        }),
      )
      .min(6),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.licences.map((l) => l.id))
    if (ids.size !== p.licences.length) ctx.addIssue({ code: 'custom', message: 'duplicate licence ids' })
    p.scenarios.forEach((s, n) => {
      if (!s.options.every((o) => ids.has(o))) ctx.addIssue({ code: 'custom', message: `scenario ${n}: unknown option` })
      if (!s.options.includes(s.answer)) ctx.addIssue({ code: 'custom', message: `scenario ${n}: the answer is not among the options` })
      if (new Set(s.options).size !== s.options.length) ctx.addIssue({ code: 'custom', message: `scenario ${n}: repeated option` })
    })
  })

export type LicencesParams = z.infer<typeof paramsSchema>

export type Kind = 'code' | 'content'
export type Scope = 'program' | 'library' | 'network'

export interface Answers {
  kind: Kind
  /** Must changed copies that others share keep the same terms? */
  share: 'same' | 'none'
  /** For code that must stay shared: how far the duty reaches. Ignored for content or without a share duty. */
  scope: Scope
  /** May others use it commercially? */
  commercial: boolean
  /** May others share changed versions? */
  changes: boolean
  /** Must users credit you? When false, only a dedication to the public domain fits. */
  credit: boolean
}

export const DEFAULT_ANSWERS: Answers = { kind: 'code', share: 'none', scope: 'program', commercial: true, changes: true, credit: true }

export interface Verdict {
  fits: boolean
  /** Why it does not fit; empty when it does. */
  problems: string[]
}

/** Whether one licence matches the answers, and what is wrong when it doesn't. */
export function evaluate(l: Licence, a: Answers): Verdict {
  const problems: string[] = []
  if (a.kind === 'code' && l.applies === 'content') problems.push('It is written for content such as art, music and text, not for programs.')
  if (a.kind === 'content' && l.applies === 'code') problems.push('It is a software licence, written for programs, not for art, music or text.')
  if (a.share === 'none' && l.copyleft !== 'none') problems.push('It makes people who share changes pass them on under the same terms, which you said you don’t want.')
  if (a.share === 'same') {
    if (l.copyleft === 'none') problems.push('It lets people keep their changes closed, but you want changes to stay under the same terms.')
    else if (a.kind === 'code') {
      if (a.scope === 'program' && l.copyleft !== 'program') problems.push(l.copyleft === 'library' ? 'It only covers the library itself, so closed programs may use it. You want the whole program to stay shared.' : 'It adds a network term beyond what you asked for.')
      if (a.scope === 'library' && l.copyleft !== 'library') problems.push('It reaches further than the library itself: programs that use it must be shared too.')
      if (a.scope === 'network' && l.copyleft !== 'network') problems.push('It does not cover users who only reach the program over a network.')
    }
  }
  if (a.commercial && !l.commercial) problems.push('It forbids commercial use (NonCommercial), and you want others to be able to sell it or use it in a product.')
  if (!a.commercial && l.commercial) problems.push('It allows commercial use, and you want to forbid it.')
  if (a.changes && !l.changes) problems.push('It forbids sharing changed versions (NoDerivatives).')
  if (!a.changes && l.changes) problems.push('It allows changed versions, and you want to forbid them.')
  if (a.credit && !l.credit) problems.push('It asks for no credit at all, and you want to be named.')
  if (!a.credit && l.credit) problems.push('It requires credit or keeping your notice, and you want none.')
  return { fits: problems.length === 0, problems }
}

/** Every licence with its verdict, the ones that fit first. */
export function recommend(licences: readonly Licence[], a: Answers): { licence: Licence; verdict: Verdict }[] {
  const all = licences.map((licence) => ({ licence, verdict: evaluate(licence, a) }))
  return [...all.filter((r) => r.verdict.fits), ...all.filter((r) => !r.verdict.fits)]
}

/** When nothing fits, say what to relax. */
export function noMatchHint(a: Answers): string {
  if (a.kind === 'code' && !a.commercial) return 'No free or open source software licence forbids commercial use: free software must be available for commercial use. Allow it, or accept that the result is not free software.'
  if (a.kind === 'code' && !a.changes) return 'Free and open source licences must allow changed versions. A licence that forbids them is not a free or open source licence.'
  if (a.kind === 'content' && a.share === 'same' && !a.changes) return 'ShareAlike is about adaptations, and NoDerivatives forbids them: the two cannot be combined.'
  if (a.share === 'same' && !a.credit) return 'Every copyleft licence asks that notices are kept. Only CC0, which asks for nothing, needs no credit.'
  return 'No licence in this list has exactly that combination. Relax one answer.'
}

export const kindOf = (l: Licence) => (l.family === 'copyleft' ? 'Copyleft' : l.family === 'permissive' ? 'Permissive' : l.family === 'dedication' ? 'Public-domain dedication' : 'Creative Commons')
