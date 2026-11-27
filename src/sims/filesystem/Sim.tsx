import { useState } from 'react'
import { Inline } from '../../components/Inline'
import { Panel } from '../ui'
import { type FilesystemParams, STORAGE_BADGE, STORAGE_LABEL, flatten, isRight } from './model'

export default function FilesystemSim({ params }: { params: FilesystemParams }) {
  const [selected, setSelected] = useState(params.directories[1]!.path)
  const [question, setQuestion] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const dir = params.directories.find((d) => d.path === selected)!
  const rows = flatten(params)
  const q = params.quiz[question]!

  function pickQuestion(n: number) {
    setQuestion(n)
    setPicked(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr]">
        <Panel title="The tree">
          <ul className="space-y-0.5" aria-label="Directories">
            {rows.map(({ dir: d, depth }) => {
              const name = d.path === '/' ? '/' : d.path.slice(d.path.lastIndexOf('/') + 1) + '/'
              const active = d.path === selected
              return (
                <li key={d.path} style={{ paddingLeft: `${depth * 0.75}rem` }}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={d.path}
                    onClick={() => setSelected(d.path)}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left font-mono text-sm ${active ? 'bg-brand text-chalk' : 'hover:bg-slate-100'}`}
                  >
                    <span aria-hidden="true">{name}</span>
                    {d.storage !== 'disk' && (
                      <span aria-hidden="true" className={`rounded border px-1 text-xs ${active ? 'border-chalk' : 'border-slate-300 text-slate-500'}`}>
                        {STORAGE_BADGE[d.storage]}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel>
          <div aria-live="polite" className="space-y-4">
            <div>
              <h2 className="break-all font-mono text-xl font-semibold">{dir.path}</h2>
              <p className="text-slate-600">{dir.role}</p>
              {dir.linkTo && (
                <p className="mt-1 text-sm">
                  On this Debian machine it is a symbolic link to <code className="font-mono">{dir.linkTo}</code>.
                </p>
              )}
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">What lives here</dt>
                <dd>
                  <Inline text={dir.contents} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Where it is stored</dt>
                <dd>
                  <strong className={dir.storage === 'pseudo' ? 'text-brand' : ''}>{STORAGE_LABEL[dir.storage]}.</strong> <Inline text={dir.storageNote} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">At TuxPixel</dt>
                <dd>
                  <Inline text={dir.atTuxPixel} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Seen on the practice machine</dt>
                <dd className="space-y-2">
                  {dir.examples.map((e) => (
                    <pre key={e.command} className="overflow-x-auto rounded bg-code p-3 font-mono text-chalk">
                      <span className="select-none text-slate-400">$ </span>
                      {e.command}
                      {'\n'}
                      {e.output}
                    </pre>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">For the exam</dt>
                <dd>
                  <Inline text={dir.examTip} />
                </dd>
              </div>
            </dl>
          </div>
        </Panel>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Where would you look?</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a question">
          {params.quiz.map((item, n) => (
            <button
              key={item.text}
              type="button"
              aria-pressed={n === question}
              onClick={() => pickQuestion(n)}
              className={`rounded border px-3 py-1 text-sm ${n === question ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
            >
              {n + 1}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p>
            <Inline text={q.text} />
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Directories to choose from">
            {q.options.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={picked === o}
                onClick={() => setPicked(o)}
                className={`rounded border px-3 py-1 font-mono text-sm ${picked === o ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
              >
                {o}
              </button>
            ))}
          </div>
          {picked !== null && (
            <p role="status" className="mt-3 text-sm">
              <strong className={isRight(q, picked) ? 'text-green-600' : 'text-red-600'}>{isRight(q, picked) ? '✓ Right.' : `✗ Not ${picked}.`}</strong>{' '}
              <Inline text={isRight(q, picked) ? q.why : 'Think about what kind of file it is, then try another directory.'} />
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
