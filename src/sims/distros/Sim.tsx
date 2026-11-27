import { useState } from 'react'
import { Panel } from '../ui'
import { type Distro, type DistrosParams, type TreeNode, familyTree, lineage } from './model'

const EXAM_LABEL = { '010-200': '010-200', '010-160': '010-160' } as const

function ExamBadges({ d }: { d: Distro }) {
  if (d.exams.length === 0) return <span className="rounded border border-slate-300 px-1.5 text-xs text-slate-500">on neither exam</span>
  return (
    <>
      {d.exams.map((e) => (
        <span key={e} className="rounded border border-brand px-1.5 text-xs text-brand-dark">
          {EXAM_LABEL[e]}
        </span>
      ))}
    </>
  )
}

function Branch({ node, selected, path, onPick }: { node: TreeNode; selected: string; path: string[]; onPick: (id: string) => void }) {
  const d = node.distro
  const isSelected = d.id === selected
  const onPath = path.includes(d.id)
  return (
    <li>
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => onPick(d.id)}
        className={`rounded border px-2 py-1 text-left text-sm ${isSelected ? 'border-brand bg-brand text-chalk' : onPath ? 'border-brand' : 'border-slate-300'} ${d.ended ? 'italic' : ''}`}
      >
        {d.name}
      </button>
      {node.children.length > 0 && (
        <ul className="ml-3 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
          {node.children.map((c) => (
            <Branch key={c.distro.id} node={c} selected={selected} path={path} onPick={onPick} />
          ))}
        </ul>
      )}
    </li>
  )
}

function Detail({ d, params }: { d: Distro; params: DistrosParams }) {
  const family = params.families.find((f) => f.id === d.family)!
  const model = params.models.find((m) => m.id === d.model)
  const parent = params.distros.find((x) => x.id === d.parent)
  return (
    <Panel title={d.name}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ExamBadges d={d} />
        {d.ended && <span className="rounded border border-slate-300 px-1.5 text-xs">ended</span>}
      </div>
      <p className="text-sm">{d.summary}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Family and tools</dt>
          <dd>
            {family.name}
            {family.tools && <span className="font-mono"> ({family.tools})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Built from</dt>
          <dd>{parent ? `${parent.name}. ${d.relation}` : d.relation}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Made by</dt>
          <dd>{d.maker}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Release model</dt>
          <dd>{model ? model.name : 'None of its own'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">New releases</dt>
          <dd>{d.cadence}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Support</dt>
          <dd>{d.support}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm">
        <strong>Watch out:</strong> {d.watchOut}
      </p>
    </Panel>
  )
}

function Models({ params }: { params: DistrosParams }) {
  return (
    <Panel title="Release models compared">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="py-1 pr-2">Model</th>
              <th scope="col" className="py-1 pr-2">Idea</th>
              <th scope="col" className="py-1 pr-2">New software</th>
              <th scope="col" className="py-1 pr-2">Risk</th>
              <th scope="col" className="py-1">Examples</th>
            </tr>
          </thead>
          <tbody>
            {params.models.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 align-top">
                <th scope="row" className="py-2 pr-2 font-semibold">{m.name}</th>
                <td className="py-2 pr-2">{m.idea}</td>
                <td className="py-2 pr-2">{m.newSoftware}</td>
                <td className="py-2 pr-2">{m.risk}</td>
                <td className="py-2">{m.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Scenarios({ params }: { params: DistrosParams }) {
  const [picked, setPicked] = useState<Record<number, string>>({})
  const name = (id: string) => params.models.find((m) => m.id === id)?.name ?? id
  const right = params.scenarios.filter((s, n) => picked[n] === s.answer).length
  const answered = Object.keys(picked).length
  return (
    <Panel title="Which release model?">
      <p className="mb-3 text-sm" aria-live="polite">
        {right} of {params.scenarios.length} right{answered < params.scenarios.length ? ` (${answered} answered)` : ''}.
      </p>
      <ol className="space-y-4">
        {params.scenarios.map((s, n) => {
          const choice = picked[n]
          return (
            <li key={s.text} className="text-sm">
              <p className="mb-2">{s.text}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Release model for scenario ${n + 1}`}>
                {s.options.map((o) => {
                  const state = choice === undefined ? 'border-slate-300' : o === s.answer ? 'border-brand bg-brand text-chalk' : o === choice ? 'border-red-600 text-red-600' : 'border-slate-300 text-slate-400'
                  return (
                    <button key={o} type="button" disabled={choice !== undefined} aria-pressed={choice === o} onClick={() => setPicked((p) => ({ ...p, [n]: o }))} className={`rounded border px-3 py-1 text-left ${state}`}>
                      {name(o)}
                    </button>
                  )
                })}
              </div>
              {choice !== undefined && (
                <p className="mt-2" role="status">
                  <strong>{choice === s.answer ? 'Right.' : `Not quite. The answer is ${name(s.answer)}.`}</strong> {s.why}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      {answered > 0 && (
        <button type="button" onClick={() => setPicked({})} className="mt-4 rounded border px-3 py-1 text-sm">
          Start over
        </button>
      )}
    </Panel>
  )
}

export default function DistrosSim({ params }: { params: DistrosParams }) {
  const [selected, setSelected] = useState('rhel')
  const current = params.distros.find((d) => d.id === selected) ?? params.distros[0]!
  const path = lineage(params.distros, current.id)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="The families">
          <p className="mb-3 text-xs text-slate-500">Click a distribution. A line from a child up to its parent means “built from” or “tracks”. Italic names have ended.</p>
          <div className="space-y-4">
            {params.families.map((f) => (
              <section key={f.id} aria-label={f.name}>
                <h3 className="font-semibold">{f.name}</h3>
                <p className="mb-1 text-xs text-slate-500">{f.tools || 'No package family of its own'}</p>
                <ul className="space-y-1">
                  {familyTree(params.distros, f.id).map((n) => (
                    <Branch key={n.distro.id} node={n} selected={current.id} path={path} onPick={setSelected} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>
        <div className="space-y-4" aria-live="polite">
          <Detail d={current} params={params} />
          {params.notes.map((n) => (
            <Panel key={n.title} title={n.title}>
              <p className="text-sm">{n.text}</p>
            </Panel>
          ))}
        </div>
      </div>
      <Models params={params} />
      <Scenarios params={params} />
    </div>
  )
}
