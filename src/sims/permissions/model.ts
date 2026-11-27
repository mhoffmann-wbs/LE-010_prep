// Permissions calculator: a mode as rwx bits plus the sticky bit, shown as
// `ls -l` letters, octal and chmod commands, and symbolic chmod applied the way
// GNU chmod does (the cases in model.test.ts were run in the guest).
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)

export type Kind = 'file' | 'dir'
export const CLASSES = ['u', 'g', 'o'] as const
export type Who = (typeof CLASSES)[number]
export const PERMS = ['r', 'w', 'x'] as const
export type Perm = (typeof PERMS)[number]

const meaning = z.object({ r: nonEmpty, w: nonEmpty, x: nonEmpty })

export const paramsSchema = z.object({
  /** The names shown for owner, group and others, e.g. "mira". */
  owner: nonEmpty,
  group: nonEmpty,
  /** What r, w and x let someone do with a file and with a directory. */
  meanings: z.object({ file: meaning, dir: meaning }),
  /** What the sticky bit does on a directory, and that it does nothing useful on a file. */
  sticky: z.object({ dir: nonEmpty, file: nonEmpty }),
  /** Tasks: set the mode the text asks for. `answer` is octal, e.g. "750". */
  tasks: z
    .array(z.object({ text: nonEmpty, kind: z.enum(['file', 'dir']), answer: z.string().regex(/^1?[0-7]{3}$/), why: nonEmpty }))
    .min(4),
})

export type PermissionsParams = z.infer<typeof paramsSchema>

export const STICKY = 0o1000
const SHIFT: Record<Who, number> = { u: 6, g: 3, o: 0 }
const VALUE: Record<Perm, number> = { r: 4, w: 2, x: 1 }
/** The umask chmod honours when a clause names no class (Debian's default). */
export const UMASK = 0o022

export const bit = (who: Who, perm: Perm) => VALUE[perm] << SHIFT[who]
export const has = (mode: number, who: Who, perm: Perm) => (mode & bit(who, perm)) !== 0

/** `-rwxr-x--T`: the type letter and nine permission letters, with `t`/`T` for the sticky bit. */
export function lsMode(mode: number, kind: Kind): string {
  const letters: string[] = CLASSES.flatMap((who) => PERMS.map((p) => (has(mode, who, p) ? p : '-')))
  if (mode & STICKY) letters[8] = letters[8] === 'x' ? 't' : 'T'
  return (kind === 'dir' ? 'd' : '-') + letters.join('')
}

/** "750", or "1777" with the sticky bit. */
export const octal = (mode: number) => (mode & STICKY ? '1' : '') + (mode & 0o777).toString(8).padStart(3, '0')

/** `u=rwx,g=rx,o=`, plus `+t` when the sticky bit is set: the same mode as an absolute symbolic chmod. */
export function symbolicChmod(mode: number): string {
  const parts = CLASSES.map((who) => `${who}=${PERMS.filter((p) => has(mode, who, p)).join('')}`)
  return parts.join(',') + (mode & STICKY ? ',+t' : '')
}

export type Parsed = { mode: number; kind?: Kind } | { error: string }

/** Reads a typed mode: octal ("640", "0640", "1777") or `ls -l` letters, with or without the type letter. */
export function parseMode(text: string): Parsed {
  const t = text.trim()
  const oct = /^0?([01]?)([0-7]{3})$/.exec(t)
  if (oct) return { mode: (oct[1] === '1' ? STICKY : 0) | parseInt(oct[2]!, 8) }
  if (/^[2-7][0-7]{3}$/.test(t)) return { error: 'A leading 2–7 sets setuid or setgid, which this calculator leaves out: only the sticky bit (1) is on the exam.' }
  const ls = /^([-d]?)([-r][-w][-x][-r][-w][-x][-r][-w][-xtT])$/.exec(t)
  if (ls) {
    const letters = ls[2]!
    let mode = 0
    CLASSES.forEach((who, c) =>
      PERMS.forEach((p, i) => {
        const ch = letters[c * 3 + i]!
        if (ch === p || (p === 'x' && ch === 't')) mode |= bit(who, p)
      }),
    )
    if (/[tT]$/.test(letters)) mode |= STICKY
    return { mode, kind: ls[1] === 'd' ? 'dir' : ls[1] === '-' ? 'file' : undefined }
  }
  return { error: 'Type an octal mode such as 640 or 1777, or letters such as rwxr-x---.' }
}

/**
 * Applies a chmod mode argument the way GNU chmod does: octal sets everything;
 * symbolic clauses (`u+x`, `go-w`, `a=r`, `o=`, `+t`, joined with commas) change
 * only what they name. Without u, g, o or a, a clause covers everyone but leaves
 * the bits the umask (022) masks alone when adding or removing, and `=` clears
 * all three classes first. The sticky bit follows `o` and `a`.
 */
export function applyChmod(mode: number, arg: string): Parsed {
  const t = arg.trim()
  if (/^[0-7]+$/.test(t)) {
    const parsed = parseMode(t)
    return 'error' in parsed ? parsed : { mode: parsed.mode }
  }
  let next = mode
  for (const clause of t.split(',')) {
    const m = /^([ugoa]*)([-+=])([rwxt]*)$/.exec(clause)
    if (!m) return { error: `“${clause}” isn’t a clause chmod understands here. Write who (u, g, o, a), then +, - or =, then r, w, x or t.` }
    const [, whoText, op, permText] = m as unknown as [string, string, '+' | '-' | '=', string]
    const named = whoText.includes('a') ? [...CLASSES] : CLASSES.filter((w) => whoText.includes(w))
    const classes = named.length > 0 ? named : [...CLASSES]
    const mask = classes.reduce((n, w) => n | (7 << SHIFT[w]), 0)
    const masked = whoText === '' ? UMASK : 0
    let bits = classes.reduce((n, w) => n | PERMS.filter((p) => permText.includes(p)).reduce((b, p) => b | bit(w, p), 0), 0) & ~masked
    const stickyApplies = whoText === '' || classes.includes('o')
    if (permText.includes('t') && stickyApplies) bits |= STICKY
    const clear = mask | (stickyApplies ? STICKY : 0)
    if (op === '+') next |= bits
    else if (op === '-') next &= ~bits
    else next = (next & ~clear) | bits
  }
  return { mode: next }
}
