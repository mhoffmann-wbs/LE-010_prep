// Finds the shell snippets in MDX (lessons, later guides) and what each claims
// to print. A ```bash fence is a runnable cell; an ```output fence right after it
// (only blank lines between) states exactly what it prints. Without one, the
// snippet must succeed (exit 0). The fence's meta line sets how it runs:
//
//   ```bash fixture=assets user=jonas      run as jonas after the "assets" fixture
//   ```bash static                         shown with a prompt, never run (systemctl, apt …)
//
// content:verify runs every snippet in the guest and the content tests compare.
//
// Scripts import this file with Node, so it may only import types.
import type { User } from '../vm/job'

export interface Fence {
  lang: string
  meta: string
  text: string
  /** 0-based lines of the opening and closing fence. */
  start: number
  end: number
}

export interface Snippet {
  /** 1-based line of the ```bash fence, for messages. */
  line: number
  code: string
  fixture?: string
  user?: User
  /** Exactly what it prints, when an output fence follows. */
  output?: string
}

export interface FenceMeta {
  fixture?: string
  user?: User
  static: boolean
}

/** Reads `fixture=assets user=jonas static`; unknown words are errors, so typos don't pass silently. */
export function parseMeta(meta: string): FenceMeta {
  const out: FenceMeta = { static: false }
  for (const word of meta.split(/\s+/).filter(Boolean)) {
    const [key, value] = word.split('=') as [string, string | undefined]
    if (key === 'static' && value === undefined) out.static = true
    else if (key === 'fixture' && value) out.fixture = value
    else if (key === 'user' && value) out.user = value as User
    else throw new Error(`unknown fence option "${word}"`)
  }
  return out
}

export function fences(source: string): Fence[] {
  const lines = source.split('\n')
  const out: Fence[] = []
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\w*)[ \t]*(.*)$/.exec(lines[i]!)
    if (!open) continue
    const close = lines.findIndex((l, j) => j > i && /^```\s*$/.test(l))
    if (close < 0) break
    out.push({ lang: open[1]!, meta: open[2]!.trim(), text: lines.slice(i + 1, close).join('\n'), start: i, end: close })
    i = close
  }
  return out
}

/** Every runnable ```bash fence (not `static`), with its claimed output. */
export function extractSnippets(source: string): Snippet[] {
  const lines = source.split('\n')
  const all = fences(source)
  const snippets: Snippet[] = []
  for (let i = 0; i < all.length; i++) {
    const f = all[i]!
    if (f.lang !== 'bash') continue
    let meta: FenceMeta
    try {
      meta = parseMeta(f.meta)
    } catch (e) {
      throw new Error(`line ${f.start + 1}: ${(e as Error).message}`, { cause: e })
    }
    if (meta.static) continue
    const snippet: Snippet = { line: f.start + 1, code: f.text }
    if (meta.fixture) snippet.fixture = meta.fixture
    if (meta.user) snippet.user = meta.user
    const next = all[i + 1]
    if (next?.lang === 'output' && lines.slice(f.end + 1, next.start).every((l) => l.trim() === '')) snippet.output = next.text
    snippets.push(snippet)
  }
  return snippets
}
