// Paths: how the shell and the kernel turn a typed path into an absolute one,
// step by step, with `.`, `..`, `~` and `~user`, and whether the result exists
// in a small tree. The resolution matches `realpath -m` and the existence
// matches `test -e` in the guest (the cases in model.test.ts were run there).
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const absolute = z.string().regex(/^\/[^\s]*$/)

const node = z.object({
  path: absolute,
  type: z.enum(['dir', 'file']),
  /** The tree lists only some of the directory's entries, so other names under it are unknown, not missing. */
  more: z.boolean().default(false),
})

export const STYLES = ['any', 'relative', 'absolute', 'tilde'] as const
export type Style = (typeof STYLES)[number]

export const paramsSchema = z.object({
  /** The tree, parents before children. "/" is first. */
  tree: z.array(node).min(3),
  /** Login names the shell knows for `~user`, with their home directories. */
  users: z.array(z.object({ name: nonEmpty, home: absolute })).min(2),
  /** The logged-in user, whose home `~` means. */
  me: nonEmpty,
  /** Current directories to pick from. */
  starts: z.array(absolute).min(3),
  /** Typed paths to try with one click. */
  examples: z.array(nonEmpty).min(4),
  /** Tasks: type a path that leads from `cwd` to `goal`. */
  tasks: z
    .array(z.object({ text: nonEmpty, cwd: absolute, goal: absolute, style: z.enum(STYLES), why: nonEmpty }))
    .min(4),
})

export type PathsParams = z.infer<typeof paramsSchema>
export type TreeNode = z.infer<typeof node>

export interface Step {
  /** What was read: "/", "studio", "..", "~jonas" … */
  token: string
  /** One sentence on what it does. */
  text: string
  /** The path after the step. */
  path: string
}

export type Status = 'dir' | 'file' | 'missing' | 'unknown'

export interface Resolution {
  /** Absolute, with no `.`, `..`, `//` or trailing slash: the same as `realpath -m`. */
  absolute: string
  steps: Step[]
  status: Status
  /** Why the path can't be followed, or what the status means. */
  detail: string
  /** The word starts with ~ and the shell replaced it. */
  tilde?: { from: string; to: string }
  /** The first character kind: how the start was chosen. */
  kind: 'absolute' | 'relative' | 'tilde'
}

export type Result = Resolution | { error: string }

const join = (dir: string, name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`)

/** Expands a leading tilde the way Bash does: `~`, `~/x` and `~user`; an unknown user leaves the word alone. */
export function expandTilde(typed: string, params: Pick<PathsParams, 'users' | 'me'>): { word: string; home?: string; prefix?: string } | { error: string } {
  if (!typed.startsWith('~')) return { word: typed }
  const slash = typed.indexOf('/')
  const prefix = slash === -1 ? typed : typed.slice(0, slash)
  const rest = slash === -1 ? '' : typed.slice(slash)
  const name = prefix.slice(1)
  if (name === '+' || name === '-') return { error: `Bash also knows ${prefix} (the current or previous directory), but this tool handles only ~, ~/… and ~user.` }
  const user = params.users.find((u) => u.name === (name === '' ? params.me : name))
  if (!user) return { word: typed }
  return { word: user.home + rest, home: user.home, prefix }
}

export function resolvePath(cwd: string, typed: string, params: PathsParams): Result {
  if (typed.trim() === '') return { error: 'Type a path first.' }
  if (/\s/.test(typed.trim())) return { error: 'A path with spaces needs quotes in the shell; keep to one word here.' }
  const word = typed.trim()
  const expanded = expandTilde(word, params)
  if ('error' in expanded) return expanded
  const steps: Step[] = []
  let kind: Resolution['kind']
  let current: string
  let tilde: Resolution['tilde']
  if (expanded.home !== undefined) {
    kind = 'tilde'
    current = expanded.home
    tilde = { from: expanded.prefix!, to: expanded.home }
    steps.push({ token: expanded.prefix!, text: `The shell replaces ${expanded.prefix} with the home directory ${expanded.home} before the command sees the path. Then it starts there.`, path: current })
  } else if (word.startsWith('/')) {
    kind = 'absolute'
    current = '/'
    steps.push({ token: '/', text: 'A path that starts with / is absolute: start at the root, whatever the current directory is.', path: '/' })
  } else {
    kind = 'relative'
    current = cwd
    steps.push({ token: cwd, text: word.startsWith('~') ? `No user is called ${word.slice(1).split('/')[0]}, so the ~ stays a plain character and this is a relative path. Start in the current directory.` : 'No leading / means relative: start in the current directory.', path: cwd })
  }

  const rest = expanded.home !== undefined ? expanded.word.slice(expanded.home.length) : expanded.word
  const parts = rest.split('/')

  // Walk the way the kernel does: every directory on the way must exist before the next name is looked up.
  let status: Status = lookup(params.tree, current)
  let detail = ''
  let failedAt = ''
  for (const part of parts) {
    if (part === '') continue
    if (part === '.') {
      steps.push({ token: '.', text: '`.` is this directory, so nothing changes.', path: current })
      continue
    }
    if (part === '..') {
      if (status === 'missing' && !failedAt) failedAt = `${current} does not exist, so the kernel cannot go up from it`
      if (status === 'file' && !failedAt) failedAt = `${current} is a file, not a directory`
      const next = current === '/' ? '/' : current.slice(0, current.lastIndexOf('/')) || '/'
      steps.push({ token: '..', text: current === '/' ? '`..` means the parent directory, but the root is its own parent: you stay at /.' : '`..` means the parent directory: drop the last name.', path: next })
      current = next
      if (!failedAt) status = lookup(params.tree, current)
      else status = 'missing'
      continue
    }
    const next = join(current, part)
    if (!failedAt) {
      if (status === 'file') failedAt = `${current} is a file, not a directory, so ${part} can't be inside it`
      else if (status === 'missing') failedAt = `${current} does not exist`
    }
    current = next
    if (!failedAt) status = lookup(params.tree, current, status === 'unknown')
    else status = 'missing'
    steps.push({ token: part, text: `Go into ${part}.`, path: current })
  }

  if (failedAt) detail = `Not found: ${failedAt}.`
  else if (status === 'dir') detail = 'It exists and is a directory, so `cd` works.'
  else if (status === 'file') detail = 'It exists and is a regular file: `cat` can read it, but `cd` fails with "Not a directory".'
  else if (status === 'missing') detail = 'Nothing with this name exists here: `ls` and `cd` say "No such file or directory".'
  else detail = 'The real machine has more here than this small tree shows, so the tree cannot say.'
  return { absolute: current, steps, status: failedAt ? 'missing' : status, detail, tilde, kind }
}

function lookup(tree: readonly TreeNode[], path: string, parentUnknown = false): Status {
  const hit = tree.find((n) => n.path === path)
  if (hit) return hit.type
  if (parentUnknown) return 'unknown'
  // Under a directory that lists only some entries, an unlisted name is unknown.
  const parent = path === '/' ? undefined : tree.find((n) => n.path === (path.slice(0, path.lastIndexOf('/')) || '/'))
  if (parent?.more) return 'unknown'
  return 'missing'
}

/** Whether a typed path satisfies a task: it must end at the goal, in the asked style. */
export function matchesTask(typed: string, cwd: string, task: PathsParams['tasks'][number], params: PathsParams): boolean {
  const r = resolvePath(cwd, typed, params)
  if ('error' in r || r.absolute !== task.goal) return false
  if (r.status === 'missing') return false
  const wants = { any: true, relative: r.kind === 'relative', absolute: r.kind === 'absolute', tilde: r.kind === 'tilde' }
  return wants[task.style]
}
