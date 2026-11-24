// Zod schema for fixtures: declarative TuxPixel file trees that a command runs
// against. Files are src/content/fixtures/<name>.json; src/vm/job.ts turns one
// into shell lines, so the browser VM and content:verify apply it the same way.
//
// Scripts import this file with Node, so runtime imports carry their extension.
import { z } from 'zod'
import { USERS } from '../vm/job.ts'

export const FIXTURE_NAME = /^[a-z][a-z0-9-]*$/
const NAME = /^[a-z_][a-z0-9_-]*$/

const entry = z
  .object({
    /** Absolute, e.g. "/home/mira/notes.txt" or "/srv/assets/logo.png". */
    path: z.string().regex(/^\/(?:[^/\0]+\/)*[^/\0]+$/, 'must be an absolute path without a trailing slash'),
    type: z.enum(['file', 'dir', 'symlink']).default('file'),
    /** A file's exact contents; include the final newline when the file should end with one. */
    content: z.string().optional(),
    /** Where a symlink points, as `ln -s` would get it. */
    target: z.string().min(1).optional(),
    /** Defaults to the user whose home the path is in, else root. */
    owner: z.enum(USERS).optional(),
    /** Defaults to the owner's group. */
    group: z.string().regex(NAME).optional(),
    /** Octal; defaults to 644 for files and 755 for directories. */
    mode: z
      .string()
      .regex(/^[0-7]{3,4}$/)
      .optional(),
  })
  .superRefine((e, ctx) => {
    if ((e.type === 'symlink') !== (e.target !== undefined))
      ctx.addIssue({ code: 'custom', path: ['target'], message: 'symlinks need a target, and only symlinks have one' })
    if (e.content !== undefined && e.type !== 'file') ctx.addIssue({ code: 'custom', path: ['content'], message: 'only files have content' })
    if (e.mode !== undefined && e.type === 'symlink') ctx.addIssue({ code: 'custom', path: ['mode'], message: 'symlinks have no mode' })
  })

export const fixtureSchema = z
  .object({
    /** What the tree is for, shown to authors. */
    description: z.string().trim().min(1),
    /** Groups created first, so entries can use them. */
    groups: z.array(z.object({ name: z.string().regex(NAME), members: z.array(z.enum(USERS)).default([]) })).default([]),
    entries: z.array(entry).default([]),
    /** Commands run after the entries, each as its user (default mira) in their home, e.g. to build an archive. */
    setup: z.array(z.object({ user: z.enum(USERS).optional(), run: z.string().min(1) })).optional(),
  })
  .superRefine((f, ctx) => {
    const paths = f.entries.map((e) => e.path)
    const dupes = paths.filter((p, i) => paths.indexOf(p) !== i)
    if (dupes.length) ctx.addIssue({ code: 'custom', path: ['entries'], message: `duplicate paths: ${dupes.join(', ')}` })
  })

export type Fixture = z.infer<typeof fixtureSchema>
