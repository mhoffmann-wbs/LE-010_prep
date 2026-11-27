import { useState } from 'react'
import { Inline } from '../../components/Inline'
import { Choice, Panel } from '../ui'
import {
  ERR_FILE,
  FILTERS,
  FILTER_IDS,
  OUT_FILE,
  type FilterId,
  type PipesParams,
  type Spec,
  type StderrMode,
  type StdoutMode,
  describeRoutes,
  fileMode,
  simulate,
} from './model'

const STDOUT_OPTIONS: { id: StdoutMode; label: string }[] = [
  { id: 'screen', label: 'Screen' },
  { id: 'truncate', label: '> out.txt' },
  { id: 'append', label: '>> out.txt' },
  { id: 'pipe', label: '| next command' },
]

const STDERR_OPTIONS: { id: StderrMode; label: string }[] = [
  { id: 'screen', label: 'Screen' },
  { id: 'truncate', label: '2> err.txt' },
  { id: 'append', label: '2>> err.txt' },
  { id: 'null', label: '2> /dev/null' },
  { id: 'merge', label: '2>&1 after the >' },
  { id: 'merge-first', label: '2>&1 before the >' },
]

const FILTER_OPTIONS = FILTER_IDS.map((id) => ({ id, label: FILTERS[id].text }))

function Lines({ lines, label, empty }: { lines: string[]; label: string; empty: string }) {
  return (
    <pre aria-label={label} className="min-h-10 overflow-x-auto whitespace-pre-wrap break-all rounded bg-code p-3 font-mono text-sm text-chalk">
      {lines.length ? lines.join('\n') : empty}
    </pre>
  )
}

export default function PipesSim({ params }: { params: PipesParams }) {
  const [spec, setSpec] = useState<Spec>(params.presets[0]!.spec)
  const [presetTitle, setPresetTitle] = useState<string | null>(params.presets[0]!.title)
  const preset = params.presets.find((p) => p.title === presetTitle)
  const command = params.commands.find((c) => c.id === spec.command)!
  const outcome = simulate(spec, params)
  const routes = describeRoutes(spec, params)

  const change = (patch: Partial<Spec>) => {
    setSpec({ ...spec, ...patch })
    setPresetTitle(null)
  }

  return (
    <div className="space-y-6">
      <Panel title="Pick a TuxPixel command line">
        <div role="group" aria-label="Presets" className="flex flex-wrap gap-2">
          {params.presets.map((p) => (
            <button
              key={p.title}
              type="button"
              aria-pressed={p.title === presetTitle}
              onClick={() => {
                setSpec(p.spec)
                setPresetTitle(p.title)
              }}
              className={`rounded border px-3 py-1 text-sm ${p.title === presetTitle ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
            >
              {p.title}
            </button>
          ))}
        </div>
        {preset && <p className="mt-3 text-sm"><Inline text={preset.explain} /></p>}
      </Panel>

      <Panel title="Or build one from parts">
        <div className="space-y-4">
          <Choice label="Command" value={spec.command} options={params.commands.map((c) => ({ id: c.id, label: c.label }))} onChange={(id) => change({ command: id })} />
          <p className="text-sm text-slate-500"><Inline text={command.explain} /></p>
          <Choice label="Where stdout (stream 1) goes" value={spec.stdout} options={STDOUT_OPTIONS} onChange={(stdout) => change({ stdout })} />
          {spec.stdout === 'pipe' && <Choice<FilterId> label="The next command in the pipe" value={spec.filter} options={FILTER_OPTIONS} onChange={(filter) => change({ filter })} />}
          <Choice label="Where stderr (stream 2) goes" value={spec.stderr} options={STDERR_OPTIONS} onChange={(stderr) => change({ stderr })} />
          <p className="text-xs text-slate-500">
            The order of <code className="font-mono">2&gt;&amp;1</code> and <code className="font-mono">&gt; out.txt</code> only matters when stdout goes to a file.
          </p>
        </div>
      </Panel>

      <Panel title="The command line">
        <p className="break-all rounded bg-code px-3 py-2 font-mono text-sm text-chalk" aria-live="polite">
          <span aria-hidden="true">$ </span>
          {outcome.command}
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium">
              Standard input (0) <span className="font-normal text-slate-500">comes from</span>
            </dt>
            <dd>{routes.stdin}.</dd>
          </div>
          <div>
            <dt className="font-medium">
              Standard output (1) <span className="font-normal text-slate-500">goes to</span>
            </dt>
            <dd>{routes.stdout}.</dd>
          </div>
          <div>
            <dt className="font-medium">
              Standard error (2) <span className="font-normal text-slate-500">goes to</span>
            </dt>
            <dd>{routes.stderr}.</dd>
          </div>
        </dl>
        {routes.note && (
          <p role="note" className="mt-3 rounded border border-accent bg-page p-2 text-sm">
            {routes.note}
          </p>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="On the screen">
          <Lines lines={outcome.screen} label="Screen output" empty="(nothing is printed)" />
          {spec.stdout === 'pipe' && (
            <p className="mt-2 text-xs text-slate-500">
              <code className="font-mono">{FILTERS[spec.filter].text}</code> received {outcome.piped.length} {outcome.piped.length === 1 ? 'line' : 'lines'} through the pipe.
            </p>
          )}
        </Panel>

        <Panel title="The files afterwards">
          <div className="space-y-3">
            {([OUT_FILE, ERR_FILE] as const).map((file) => {
              const mode = fileMode(spec, file)
              const before = file === OUT_FILE ? params.before.out : params.before.err
              return (
                <div key={file}>
                  <p className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-mono font-medium">{file}</span>
                    <span className="text-xs text-slate-500">
                      {mode === 'truncate' ? 'emptied, then written' : mode === 'append' ? 'kept, new lines added' : 'not touched'}
                    </span>
                  </p>
                  <Lines lines={outcome.files[file]} label={`${file} afterwards`} empty="(empty file)" />
                  {mode && <p className="mt-1 text-xs text-slate-500">Before: {before.join(' / ')}</p>}
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
