import { useState } from 'react'
import { Inline } from '../../components/Inline'
import { Choice, Panel } from '../ui'
import { type Action, type ArchiveParams, COMPRESSION_LABEL, type Compression, type Options, type Tool, buildCommand, matchesTask } from './model'

const TOOL_LABELS: { id: Tool; label: string }[] = [
  { id: 'tar', label: 'tar (bundle, then compress)' },
  { id: 'zip', label: 'zip / unzip' },
  { id: 'single', label: 'One file: gzip, bzip2, xz' },
]
const ACTION_LABELS: { id: Action; label: string }[] = [
  { id: 'create', label: 'Create' },
  { id: 'list', label: 'List' },
  { id: 'extract', label: 'Extract' },
]

export default function ArchiveSim({ params }: { params: ArchiveParams }) {
  const [opts, setOpts] = useState<Options>({ tool: 'tar', action: 'create', compression: 'gzip', verbose: false, elsewhere: false })
  const [sourceId, setSourceId] = useState(params.sources[0]!.id)
  const [task, setTask] = useState(0)
  const [checked, setChecked] = useState<boolean | null>(null)
  const source = params.sources.find((s) => s.id === sourceId)!
  const built = buildCommand(opts, source, params)
  const current = params.tasks[task]!

  const set = (patch: Partial<Options>) => {
    setOpts({ ...opts, ...patch })
    setChecked(null)
  }
  const compressions: Compression[] = opts.tool === 'single' ? ['gzip', 'bzip2', 'xz'] : ['none', 'gzip', 'bzip2', 'xz']
  const compressionMatters = opts.tool === 'tar' || opts.tool === 'single'
  const compression: Compression = opts.tool === 'single' && opts.compression === 'none' ? 'gzip' : opts.compression

  function pickTask(n: number) {
    const t = params.tasks[n]!
    setTask(n)
    setSourceId(t.source)
    setChecked(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Choose what to do">
          <div className="space-y-4">
            <Choice label="Tool" value={opts.tool} options={TOOL_LABELS} onChange={(tool) => set({ tool })} />
            <Choice label="Action" value={opts.action} options={ACTION_LABELS} onChange={(action) => set({ action })} />
            {compressionMatters ? (
              <Choice
                label="Compression"
                value={compression}
                options={compressions.map((c) => ({ id: c, label: COMPRESSION_LABEL[c] }))}
                onChange={(c) => set({ compression: c })}
              />
            ) : (
              <p className="text-sm text-slate-500">ZIP compresses every file by itself, so there is no compression to choose.</p>
            )}
            {opts.tool !== 'single' && (
              <Choice
                label="Folder to work on"
                value={sourceId}
                options={params.sources.map((s) => ({ id: s.id, label: s.label }))}
                onChange={(id) => {
                  setSourceId(id)
                  setChecked(null)
                }}
              />
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {opts.tool !== 'single' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.verbose} onChange={() => set({ verbose: !opts.verbose })} className="h-5 w-5 accent-brand" />
                  Verbose (<code className="font-mono">v</code>)
                </label>
              )}
              {opts.action === 'extract' && opts.tool !== 'single' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={opts.elsewhere} onChange={() => set({ elsewhere: !opts.elsewhere })} className="h-5 w-5 accent-brand" />
                  Into <code className="font-mono">{params.destination}</code> instead of here
                </label>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="The command">
          <p className="break-all rounded bg-code p-3 font-mono text-lg text-chalk" aria-live="polite">
            <span className="select-none text-slate-400">$ </span>
            {built.command}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">File</dt>
            <dd className="font-mono break-all">{built.archive}</dd>
            <dt className="text-slate-500">Extension</dt>
            <dd className="font-mono">{built.extension}</dd>
          </dl>
          {built.note && <p className="mt-3 text-sm">{built.note}</p>}
        </Panel>
      </div>

      <Panel title="What each part does">
        <ul className="space-y-1 text-sm">
          {built.parts.map((p, n) => (
            <li key={n} className="grid grid-cols-[minmax(4rem,9rem)_1fr] gap-3">
              <code className="font-mono break-all font-semibold">{p.text}</code>
              <span>{p.meaning}</span>
            </li>
          ))}
        </ul>
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
          <button type="button" onClick={() => setChecked(matchesTask({ ...opts, compression }, current) && sourceId === current.source)} className="mt-3 rounded bg-brand px-4 py-2 font-medium text-chalk">
            Check my command
          </button>
          {checked !== null && (
            <p role="status" className="mt-2 text-sm">
              <strong className={checked ? 'text-green-600' : 'text-red-600'}>{checked ? '✓ Right.' : '✗ Not yet: look at the tool, the action and the compression.'}</strong>{' '}
              {checked && <Inline text={current.why} />}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
