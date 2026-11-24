// MDX components for lessons. A ```bash fence becomes a cell the learner can run
// (and edit) in the shared guest; an ```output fence gets a label; <Predict> asks
// for a guess before showing what a command prints. Fence options (```bash
// fixture=assets user=jonas, or static) reach <code> as data-meta through the
// remark plugin in vite.config.ts; src/content/snippets.ts reads the same syntax.
import { Children, type ComponentProps, type ReactNode, isValidElement, useState } from 'react'
import { Link } from 'react-router'
import { ShellCommand } from '../components/ShellCommand'
import { FIXTURES } from '../content/fixtureBank'
import { normaliseOutput } from '../content/schema'
import { type FenceMeta, parseMeta } from '../content/snippets'
import { sharedRunner } from '../vm/emulator'
import { type RunResult, RunError } from '../vm/runner'

type FenceProps = { lang: string; meta: string; text: string }

/** The language, options and text of a fenced block as MDX renders it: <pre><code className="language-x" data-meta>. */
function fenceOf(node: ReactNode): FenceProps | null {
  if (!isValidElement(node)) return null
  const code = (node.props as { children?: ReactNode }).children
  if (!isValidElement(code)) return null
  const props = code.props as { className?: string; children?: ReactNode; 'data-meta'?: string }
  return {
    lang: props.className?.replace(/^language-/, '') ?? '',
    meta: props['data-meta'] ?? '',
    text: Children.toArray(props.children).join('').replace(/\n$/, ''),
  }
}

function OutputBlock({ text, label = 'Output' }: { text: string; label?: string }) {
  return (
    <div className="not-prose my-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm">{text || '(no output)'}</pre>
    </div>
  )
}

type CellState = { state: 'idle' } | { state: 'running'; starting: boolean } | { state: 'done'; result: RunResult } | { state: 'error'; message: string }

let started = false

/** A shell snippet with a Run button: runs in a fresh copy of the guest, as the fence's user, after its fixture. */
export function ShellCell({ code, meta }: { code: string; meta: FenceMeta }) {
  const [command, setCommand] = useState(code)
  const [editing, setEditing] = useState(false)
  const [cell, setCell] = useState<CellState>({ state: 'idle' })

  const run = async () => {
    setCell({ state: 'running', starting: !started })
    try {
      const runner = await sharedRunner()
      started = true
      const result = await runner.run({ command, user: meta.user, fixture: meta.fixture ? FIXTURES[meta.fixture] : undefined })
      setCell({ state: 'done', result })
    } catch (e) {
      const message =
        e instanceof RunError && e.reason === 'timeout'
          ? 'The command took too long and was stopped.'
          : `Linux could not run this: ${e instanceof Error ? e.message : String(e)}`
      setCell({ state: 'error', message })
    }
  }

  return (
    <div className="not-prose my-4 space-y-2">
      {editing ? (
        <label className="block text-sm">
          <span className="sr-only">Command</span>
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void run()
            }}
            rows={Math.max(2, command.split('\n').length)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="block w-full rounded-lg bg-code p-3 font-mono text-sm text-[#e6edf3]"
          />
        </label>
      ) : (
        <ShellCommand command={command} user={meta.user} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={cell.state === 'running'}
          className="rounded border border-brand px-3 py-1 text-sm text-brand-dark disabled:opacity-50"
        >
          ▶ Run
        </button>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded border border-slate-300 px-3 py-1 text-sm">
            Edit
          </button>
        )}
        {editing && command !== code && (
          <button type="button" onClick={() => setCommand(code)} className="rounded border border-slate-300 px-3 py-1 text-sm">
            Reset
          </button>
        )}
        <span role="status" className="text-sm text-slate-500">
          {cell.state === 'running' && (cell.starting ? 'Starting Linux (about 15 MB the first time)…' : 'Running…')}
          {cell.state === 'done' && cell.result.exit !== 0 && `Exit status ${cell.result.exit}`}
        </span>
      </div>
      {cell.state === 'done' && <OutputBlock text={cell.result.output} />}
      {cell.state === 'error' && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{cell.message}</p>}
    </div>
  )
}

/** Overrides <pre>: bash becomes runnable (or a static prompt), output gets a label, anything else is plain code. */
function Pre(props: ComponentProps<'pre'>) {
  const fence = fenceOf(<pre {...props} />)
  if (fence?.lang === 'bash') {
    const meta = parseMeta(fence.meta)
    if (meta.static)
      return (
        <div className="not-prose my-4">
          <ShellCommand command={fence.text} user={meta.user} />
        </div>
      )
    return <ShellCell code={fence.text} meta={meta} />
  }
  if (fence?.lang === 'output') return <OutputBlock text={fence.text} />
  return (
    <div className="not-prose my-4">
      <pre className="overflow-x-auto rounded-lg bg-code p-3 font-mono text-sm text-[#e6edf3]">{fence?.text}</pre>
    </div>
  )
}

/**
 * A predict-the-output check around one ```bash fence and its ```output fence:
 * shows the command, asks for a guess, and only then reveals the real output
 * and lets the learner run it.
 */
export function Predict({ children }: { children: ReactNode }) {
  const blocks = Children.toArray(children)
    .map(fenceOf)
    .filter((f): f is FenceProps => !!f)
  const code = blocks.find((b) => b.lang === 'bash')
  const answer = blocks.find((b) => b.lang === 'output')
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  if (!code || !answer) return null
  const meta = parseMeta(code.meta)
  const matched = normaliseOutput(guess) === normaliseOutput(answer.text)
  return (
    <div className="not-prose my-6 space-y-3 rounded-lg border-2 border-accent bg-white p-4">
      <p className="font-semibold">What does this print?</p>
      <ShellCommand command={code.text} user={meta.user} />
      <label className="block text-sm">
        Your guess
        <textarea
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={revealed}
          rows={Math.max(2, answer.text.split('\n').length)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 font-mono text-sm"
        />
      </label>
      {revealed ? (
        <>
          <p className={`font-semibold ${matched ? 'text-green-600' : 'text-slate-700'}`}>
            {matched ? '✓ Exactly right.' : 'Compare your guess with the real output:'}
          </p>
          <OutputBlock text={answer.text} />
          <ShellCell code={code.text} meta={meta} />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={guess.trim() === ''}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-chalk disabled:opacity-40"
          >
            Reveal the answer
          </button>
          <p className="text-xs text-slate-500">Write your guess first: predicting before you look is what makes it stick.</p>
        </>
      )}
    </div>
  )
}

/** Links starting with / go through the router; others open in a new tab. */
function A({ href = '', ...props }: ComponentProps<'a'>) {
  if (href.startsWith('/')) return <Link to={href} {...props} />
  return <a href={href} target="_blank" rel="noreferrer" {...props} />
}

export const lessonComponents = { pre: Pre, a: A, Predict }
