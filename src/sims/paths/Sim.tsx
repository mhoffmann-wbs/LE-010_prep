import { useState } from 'react'
import { Inline } from '../../components/Inline'
import { Panel } from '../ui'
import { type PathsParams, type Status, matchesTask, resolvePath } from './model'

const STATUS_LABEL: Record<Status, string> = { dir: 'exists: a directory', file: 'exists: a file', missing: 'does not exist', unknown: 'not shown in this small tree' }
const STATUS_STYLE: Record<Status, string> = { dir: 'text-green-600', file: 'text-green-600', missing: 'text-red-600', unknown: 'text-slate-500' }

export default function PathsSim({ params }: { params: PathsParams }) {
  const [cwd, setCwd] = useState(params.starts[1] ?? params.starts[0]!)
  const [typed, setTyped] = useState('pixel-raiders/assets')
  const [task, setTask] = useState(0)
  const [checked, setChecked] = useState<boolean | null>(null)
  const result = resolvePath(cwd, typed, params)
  const current = params.tasks[task]!

  function pickTask(n: number) {
    setTask(n)
    setCwd(params.tasks[n]!.cwd)
    setTyped('')
    setChecked(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Where you are and what you type">
          <div className="space-y-4">
            <div>
              <label htmlFor="paths-cwd" className="text-sm font-medium">
                Current directory (<code className="font-mono">pwd</code>)
              </label>
              <select
                id="paths-cwd"
                value={cwd}
                onChange={(e) => {
                  setCwd(e.target.value)
                  setChecked(null)
                }}
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm"
              >
                {params.starts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="paths-typed" className="text-sm font-medium">
                Path you type
              </label>
              <input
                id="paths-typed"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setChecked(null)
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                placeholder="../builds or ~jonas"
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Try one</p>
              <div className="flex flex-wrap gap-2">
                {params.examples.map((e) => (
                  <button key={e} type="button" onClick={() => { setTyped(e); setChecked(null) }} className="rounded border border-slate-300 px-2 py-1 font-mono text-sm">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Where it leads">
          {'error' in result ? (
            <p role="status" className="text-sm text-red-600">
              {result.error}
            </p>
          ) : (
            <div role="status" aria-live="polite" className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {result.kind === 'absolute' ? 'Absolute path' : result.kind === 'tilde' ? 'Starts with ~ (an absolute path after expansion)' : 'Relative path'}
              </p>
              <p className="break-all rounded bg-code p-3 font-mono text-lg text-chalk">{result.absolute}</p>
              <p className={`font-medium ${STATUS_STYLE[result.status]}`}>{STATUS_LABEL[result.status]}</p>
              <p className="text-sm">{result.detail}</p>
            </div>
          )}
        </Panel>
      </div>

      {!('error' in result) && (
        <Panel title="Step by step">
          <ol className="space-y-2 text-sm">
            {result.steps.map((s, n) => (
              <li key={n} className="grid grid-cols-[minmax(4rem,8rem)_1fr] gap-3">
                <code className="break-all font-mono font-semibold">{s.token}</code>
                <span>
                  {s.text} <span className="text-slate-500">Now at</span> <code className="break-all font-mono">{s.path}</code>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <Panel title="The small TuxPixel tree">
        <ul className="font-mono text-sm" aria-label="Directories and files in the tree">
          {params.tree.map((n) => {
            const depth = n.path === '/' ? 0 : n.path.split('/').length - 1
            const name = n.path === '/' ? '/' : n.path.slice(n.path.lastIndexOf('/') + 1)
            return (
              <li key={n.path} style={{ paddingLeft: `${depth * 1}rem` }} className={n.type === 'file' ? 'text-slate-500' : ''}>
                {name}
                {n.type === 'dir' && n.path !== '/' ? '/' : ''}
                {n.more ? ' …' : ''}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-500">An ellipsis means the real machine has more entries there than this tree lists.</p>
      </Panel>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">TuxPixel tasks</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a task">
          {params.tasks.map((t, n) => (
            <button
              key={t.text}
              type="button"
              aria-pressed={n === task}
              onClick={() => pickTask(n)}
              className={`rounded border px-3 py-1 text-sm ${n === task ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
            >
              Task {n + 1}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p>
            <Inline text={current.text} />
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Current directory: <code className="font-mono">{current.cwd}</code>. Type your answer in the box above.
          </p>
          <button
            type="button"
            onClick={() => setChecked(cwd === current.cwd && matchesTask(typed, cwd, current, params))}
            className="mt-3 rounded bg-brand px-4 py-2 font-medium text-chalk"
          >
            Check my path
          </button>
          {checked !== null && (
            <p role="status" className="mt-2 text-sm">
              <strong className={checked ? 'text-green-600' : 'text-red-600'}>{checked ? '✓ Right.' : '✗ Not yet: check where it ends up and which kind of path was asked for.'}</strong> {checked && <Inline text={current.why} />}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
