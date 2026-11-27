// Regex highlighter: the extended regular expressions `grep -E` understands,
// restricted to the syntax where JavaScript's RegExp and POSIX ERE agree on
// which lines match. Highlights follow POSIX's "leftmost, longest" rule, which
// JavaScript's "leftmost, first alternative" rule does not, so they are found
// by trying every end position. The cases in model.test.ts were run with
// `grep -E` (and `grep -oE`) in the guest.
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)

export const paramsSchema = z.object({
  /** The file name shown in the command. */
  file: nonEmpty,
  /** The invented build log, one entry per line. */
  log: z.array(z.string().min(1)).min(8),
  /** Patterns to start from, each with a short explanation (`code` spans allowed). */
  presets: z.array(z.object({ pattern: z.string(), title: nonEmpty, explain: nonEmpty })).min(6),
})

export type RegexParams = z.infer<typeof paramsSchema>

export const MAX_PATTERN = 40

const ESCAPABLE = '.[]*+?^$|(){}\\'

type Check = { ok: true } | { ok: false; error: string }
const bad = (error: string): Check => ({ ok: false, error })

/** Reads a bracket expression starting at `open` (the index of `[`); returns the index after `]`, or an error. */
function bracket(p: string, open: number): { end: number } | { error: string } {
  let i = open + 1
  if (p[i] === '^') i++
  const first = i
  const items: string[] = []
  while (i < p.length && p[i] !== ']') {
    const c = p[i]!
    if (c === '[') return { error: 'Inside [ ] a second [ starts a class such as [:alpha:], which this simulator leaves out. Use a range like a-z.' }
    if (c === '\\') return { error: 'Inside [ ] a backslash means different things in grep and in other tools, so it is not accepted. List the characters instead.' }
    if (c === '-' && i > first && p[i + 1] !== ']') {
      const from = items[items.length - 1]
      const to = p[i + 1]
      if (from === undefined || to === undefined || to === '-' || to === '[' || to === '\\') return { error: 'A range inside [ ] needs a character on each side of the dash, like a-z.' }
      if (from > to) return { error: `The range ${from}-${to} runs backwards. Write it as ${to}-${from}.` }
      items.pop()
      items.push(`${from}-${to}`)
      i += 2
      continue
    }
    items.push(c)
    i++
  }
  if (i >= p.length) return { error: 'The [ has no closing ]. A set is written [abc] or [a-z].' }
  if (i === first) return { error: 'An empty set [] is not allowed: put at least one character between the brackets.' }
  return { end: i + 1 }
}

/** Accepts only syntax that grep -E and JavaScript read the same way. */
export function check(pattern: string): Check {
  if (pattern.length > MAX_PATTERN) return bad(`Keep the pattern under ${MAX_PATTERN} characters.`)
  if (/[^\x20-\x7e]/.test(pattern)) return bad('Use plain ASCII characters only.')
  if (pattern.includes("'")) return bad('A single quote would end the quoting in the shell command, so this simulator leaves it out.')
  // The previous item: what a quantifier may follow.
  type Prev = 'none' | 'atom' | 'group' | 'quantified' | 'anchor'
  let prev: Prev = 'none'
  // Per group: whether the current alternative has content, and whether the group has any.
  const stack: { branchHasContent: boolean; hadContent: boolean }[] = [{ branchHasContent: false, hadContent: false }]
  const top = () => stack[stack.length - 1]!
  const content = () => {
    top().branchHasContent = true
    top().hadContent = true
  }
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]!
    if (c === '\\') {
      const next = pattern[i + 1]
      if (next === undefined) return bad('A pattern cannot end with a backslash.')
      if (!ESCAPABLE.includes(next)) {
        return bad(`\\${next} means different things in different tools (grep -E has \\w and \\b, other tools have \\d). Write the characters out instead, like [0-9] or [a-z].`)
      }
      content()
      prev = 'atom'
      i += 2
    } else if (c === '[') {
      const r = bracket(pattern, i)
      if ('error' in r) return bad(r.error)
      content()
      prev = 'atom'
      i = r.end
    } else if (c === '(') {
      stack.push({ branchHasContent: false, hadContent: false })
      prev = 'none'
      i++
    } else if (c === ')') {
      if (stack.length === 1) return bad('This ) has no matching ( in front of it. To match a bracket character itself, write \\).')
      const g = top()
      if (!g.hadContent) return bad('An empty group () matches nothing useful. Put a pattern between the parentheses.')
      if (!g.branchHasContent) return bad('The last choice in this group is empty. Put something after the |.')
      stack.pop()
      content()
      prev = 'group'
      i++
    } else if (c === '|') {
      if (!top().branchHasContent) return bad('A | needs a pattern on both sides.')
      top().branchHasContent = false
      prev = 'none'
      i++
    } else if (c === '*' || c === '+' || c === '?') {
      if (prev === 'none') return bad(`A ${c} repeats the item before it, so it cannot come first. To match a ${c} character itself, write \\${c}.`)
      if (prev === 'anchor') return bad(`A ${c} cannot follow ^ or $, because an anchor is a position, not a character.`)
      if (prev === 'quantified') return bad('Two repeat symbols in a row (like a*? or a+*) mean different things in different tools. Use one.')
      if (prev === 'group' && c !== '?') return bad(`Repeating a whole group with ${c} is left out here. Use ? after a group, or repeat a single character or [set].`)
      prev = 'quantified'
      i++
    } else if (c === '{' || c === '}') {
      return bad('Interval expressions like a{2,3} are left out here. Use *, + and ? first.')
    } else if (c === '^' || c === '$') {
      content()
      prev = 'anchor'
      i++
    } else {
      content() // a literal character or .
      prev = 'atom'
      i++
    }
  }
  if (stack.length > 1) return bad('This ( has no closing ).')
  if (!top().branchHasContent && top().hadContent) return bad('A | needs a pattern on both sides.')
  return { ok: true }
}

export interface Segment {
  text: string
  hit: boolean
}

export interface LineResult {
  n: number
  text: string
  matched: boolean
  segments: Segment[]
}

/** The matches POSIX would choose (leftmost, then longest), as `grep -o` prints them. Empty matches are skipped. */
function matchSpans(pattern: string, text: string): [number, number][] {
  const sticky = new RegExp(`(?:${pattern})`, 'y')
  const endsAt = new Map<number, RegExp>()
  const exactEnd = (j: number) => {
    let r = endsAt.get(j)
    if (!r) {
      r = new RegExp(`(?:${pattern})(?<=^[\\s\\S]{${j}})`, 'y')
      endsAt.set(j, r)
    }
    return r
  }
  const spans: [number, number][] = []
  let i = 0
  while (i < text.length) {
    sticky.lastIndex = i
    if (!sticky.test(text)) {
      i++
      continue
    }
    let end = i
    for (let j = text.length; j > i; j--) {
      const r = exactEnd(j)
      r.lastIndex = i
      if (r.test(text)) {
        end = j
        break
      }
    }
    if (end === i) {
      i++
      continue
    }
    spans.push([i, end])
    i = end
  }
  return spans
}

/** Runs the pattern over every line: which lines `grep -E` prints, and what to highlight in them. */
export function run(pattern: string, log: readonly string[]): { error: string } | { lines: LineResult[] } {
  const verdict = check(pattern)
  if (!verdict.ok) return { error: verdict.error }
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    return { error: 'This pattern is not valid. Check the brackets and repeat symbols.' }
  }
  return {
    lines: log.map((text, k) => {
      const matched = re.test(text)
      const segments: Segment[] = []
      let at = 0
      if (matched) {
        for (const [from, to] of matchSpans(pattern, text)) {
          if (from > at) segments.push({ text: text.slice(at, from), hit: false })
          segments.push({ text: text.slice(from, to), hit: true })
          at = to
        }
      }
      if (at < text.length) segments.push({ text: text.slice(at), hit: false })
      return { n: k + 1, text, matched, segments }
    }),
  }
}

/** The command line the pattern stands for. The pattern is single-quoted, so the shell leaves it alone. */
export const grepCommand = (pattern: string, file: string) => `grep -E '${pattern}' ${file}`
