// Distribution family tree and release models: distributions with their
// parent, family, package tools and release model, laid out as a tree per
// family. The facts come from each project's own pages (see `links` in the
// content file).
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const id = z.string().regex(/^[a-z][a-z0-9-]*$/)

export const familySchema = z.object({
  id,
  name: nonEmpty,
  /** Package format and tools, e.g. ".deb: dpkg, apt". Empty for kernel-only systems. */
  tools: z.string(),
  summary: nonEmpty,
})

export const distroSchema = z.object({
  id,
  name: nonEmpty,
  family: id,
  /** The distribution it comes from or tracks; null for a root of its family's tree. */
  parent: id.nullable(),
  /** How it relates to its parent, shown on the tree. */
  relation: nonEmpty,
  /** Who makes it, in a few words. */
  maker: nonEmpty,
  /** Exams whose objectives name it. Empty: named by neither list, shown for context. */
  exams: z.array(z.enum(['010-200', '010-160'])),
  /** Release model id. */
  model: id.nullable(),
  cadence: nonEmpty,
  support: nonEmpty,
  summary: nonEmpty,
  watchOut: nonEmpty,
  /** True for projects that have ended. */
  ended: z.boolean().default(false),
})

export const modelSchema = z.object({
  id,
  name: nonEmpty,
  idea: nonEmpty,
  newSoftware: nonEmpty,
  upgrades: nonEmpty,
  risk: nonEmpty,
  examples: nonEmpty,
})

export const paramsSchema = z
  .object({
    families: z.array(familySchema).min(4),
    distros: z.array(distroSchema).min(10),
    models: z.array(modelSchema).min(4),
    scenarios: z
      .array(z.object({ text: nonEmpty, options: z.array(id).min(3).max(4), answer: id, why: nonEmpty }))
      .min(4),
    /** Short notes beside the tree (Android, embedded systems). */
    notes: z.array(z.object({ title: nonEmpty, text: nonEmpty })),
  })
  .superRefine((p, ctx) => {
    const fam = new Set(p.families.map((f) => f.id))
    const models = new Set(p.models.map((m) => m.id))
    const byId = new Map(p.distros.map((d) => [d.id, d]))
    if (byId.size !== p.distros.length) ctx.addIssue({ code: 'custom', message: 'duplicate distribution ids' })
    for (const d of p.distros) {
      if (!fam.has(d.family)) ctx.addIssue({ code: 'custom', message: `${d.id}: unknown family ${d.family}` })
      if (d.model !== null && !models.has(d.model)) ctx.addIssue({ code: 'custom', message: `${d.id}: unknown release model ${d.model}` })
      if (d.parent !== null) {
        const parent = byId.get(d.parent)
        if (!parent) ctx.addIssue({ code: 'custom', message: `${d.id}: unknown parent ${d.parent}` })
        else if (parent.family !== d.family) ctx.addIssue({ code: 'custom', message: `${d.id}: parent is in another family` })
      }
    }
    p.scenarios.forEach((s, n) => {
      if (!s.options.every((o) => models.has(o)) || !s.options.includes(s.answer)) ctx.addIssue({ code: 'custom', message: `scenario ${n}: options must be release models and include the answer` })
    })
  })

export type DistrosParams = z.infer<typeof paramsSchema>
export type Distro = z.infer<typeof distroSchema>

export interface TreeNode {
  distro: Distro
  children: TreeNode[]
}

/** The roots of one family's tree, each with its descendants in file order. */
export function familyTree(distros: readonly Distro[], family: string): TreeNode[] {
  const build = (d: Distro): TreeNode => ({ distro: d, children: distros.filter((c) => c.parent === d.id).map(build) })
  return distros.filter((d) => d.family === family && d.parent === null).map(build)
}

/** Ids from a distribution up to its root: the lineage the tree highlights. */
export function lineage(distros: readonly Distro[], idOf: string): string[] {
  const byId = new Map(distros.map((d) => [d.id, d]))
  const out: string[] = []
  for (let cur = byId.get(idOf); cur && !out.includes(cur.id); cur = cur.parent ? byId.get(cur.parent) : undefined) out.push(cur.id)
  return out
}
