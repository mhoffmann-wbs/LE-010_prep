import { useState } from 'react'
import { Inline } from '../../components/Inline'
import { Choice, Panel } from '../ui'
import { CLASSES, type Kind, PERMS, type PermissionsParams, STICKY, applyChmod, bit, has, lsMode, octal, parseMode, symbolicChmod } from './model'

const CLASS_LABELS = { u: 'Owner (u)', g: 'Group (g)', o: 'Others (o)' } as const
const PERM_LABELS = { r: 'read', w: 'write', x: 'execute' } as const

export default function PermissionsSim({ params }: { params: PermissionsParams }) {
  const [mode, setMode] = useState(0o644)
  const [kind, setKind] = useState<Kind>('file')
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState('')
  const [chmodArg, setChmodArg] = useState('')
  const [chmodResult, setChmodResult] = useState<{ before: number; arg: string; after: number } | { error: string } | null>(null)
  const [task, setTask] = useState(0)
  const [checked, setChecked] = useState<boolean | null>(null)
  const name = kind === 'dir' ? 'builds' : 'build.sh'
  const current = params.tasks[task]!

  const change = (next: number) => {
    setMode(next)
    setChecked(null)
  }
  const toggle = (mask: number) => change(mode ^ mask)

  function readTyped() {
    const parsed = parseMode(typed)
    if ('error' in parsed) return setTypedError(parsed.error)
    setTypedError('')
    change(parsed.mode)
    if (parsed.kind) setKind(parsed.kind)
  }

  function runChmod() {
    const result = applyChmod(mode, chmodArg)
    if ('error' in result) return setChmodResult(result)
    setChmodResult({ before: mode, arg: chmodArg.trim(), after: result.mode })
    change(result.mode)
  }

  function pickTask(n: number) {
    setTask(n)
    setKind(params.tasks[n]!.kind)
    setChecked(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Set the bits">
          <div className="space-y-4">
            <Choice
              label="The entry is a"
              value={kind}
              options={[
                { id: 'file', label: 'File' },
                { id: 'dir', label: 'Directory' },
              ]}
              onChange={setKind}
            />
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium">
                    <span className="sr-only">Class</span>
                  </th>
                  {PERMS.map((p) => (
                    <th key={p} scope="col" className="font-mono font-medium">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLASSES.map((who) => (
                  <tr key={who}>
                    <th scope="row" className="py-1 text-left font-medium">
                      {CLASS_LABELS[who]}
                      <span className="block text-xs font-normal text-slate-500">
                        {who === 'u' ? params.owner : who === 'g' ? params.group : 'everyone else'}
                      </span>
                    </th>
                    {PERMS.map((p) => (
                      <td key={p} className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${CLASS_LABELS[who]} ${PERM_LABELS[p]}`}
                          checked={has(mode, who, p)}
                          onChange={() => toggle(bit(who, p))}
                          className="h-5 w-5 accent-brand"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={(mode & STICKY) !== 0} onChange={() => toggle(STICKY)} className="h-5 w-5 accent-brand" />
              Sticky bit (<code className="font-mono">t</code>)
            </label>
          </div>
        </Panel>

        <Panel title="The same mode, three ways">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">ls -l shows</dt>
              <dd className="font-mono text-2xl" aria-live="polite">
                {lsMode(mode, kind)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Octal</dt>
              <dd className="font-mono">chmod {octal(mode)} {name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Symbolic</dt>
              <dd className="font-mono break-all">
                chmod {symbolicChmod(mode)} {name}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Each digit is one class: r = 4, w = 2, x = 1, added up. A leading 1 is the sticky bit.
          </p>
        </Panel>
      </div>

      <Panel title={`What the bits allow on this ${kind === 'dir' ? 'directory' : 'file'}`}>
        <ul className="space-y-2 text-sm">
          {CLASSES.map((who) => {
            const allowed = PERMS.filter((p) => has(mode, who, p))
            return (
              <li key={who}>
                <strong>{CLASS_LABELS[who]}:</strong>{' '}
                {allowed.length === 0 ? 'nothing.' : allowed.map((p) => params.meanings[kind][p]).join(' ')}
              </li>
            )
          })}
          {(mode & STICKY) !== 0 && (
            <li>
              <strong>Sticky bit:</strong> {params.sticky[kind]}
            </li>
          )}
        </ul>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Type a mode">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              readTyped()
            }}
          >
            <label className="sr-only" htmlFor="perm-typed">
              Octal or letters
            </label>
            <input
              id="perm-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="640 or rwxr-x---"
              spellCheck={false}
              autoCapitalize="off"
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono"
            />
            <button type="submit" className="rounded border px-3 py-1">
              Show
            </button>
          </form>
          {typedError && <p className="mt-2 text-sm text-red-600">{typedError}</p>}
        </Panel>

        <Panel title="Run chmod on it">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              runChmod()
            }}
          >
            <label htmlFor="perm-chmod" className="font-mono">
              chmod
            </label>
            <input
              id="perm-chmod"
              value={chmodArg}
              onChange={(e) => setChmodArg(e.target.value)}
              placeholder="g+w or o-r,u+x"
              spellCheck={false}
              autoCapitalize="off"
              className="w-40 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono"
            />
            <span className="font-mono">{name}</span>
            <button type="submit" className="rounded border px-3 py-1">
              Run
            </button>
          </form>
          {chmodResult && (
            <p role="status" className="mt-2 text-sm">
              {'error' in chmodResult ? (
                <span className="text-red-600">{chmodResult.error}</span>
              ) : (
                <>
                  <code className="font-mono">{lsMode(chmodResult.before, kind)}</code> → <code className="font-mono">{lsMode(chmodResult.after, kind)}</code>
                  {chmodResult.before === chmodResult.after && ' (nothing changed)'}
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Symbolic clauses change only what they name. Without u, g, o or a, chmod skips the bits the umask (022) masks.
          </p>
        </Panel>
      </div>

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
          <button
            type="button"
            onClick={() => setChecked(octal(mode) === current.answer && kind === current.kind)}
            className="mt-3 rounded bg-brand px-4 py-2 font-medium text-chalk"
          >
            Check my bits
          </button>
          {checked !== null && (
            <p role="status" className="mt-2 text-sm">
              <strong className={checked ? 'text-green-600' : 'text-red-600'}>
                {checked ? '✓ Right.' : `✗ Not yet: you have ${octal(mode)}.`}
              </strong>{' '}
              {checked && <Inline text={current.why} />}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
