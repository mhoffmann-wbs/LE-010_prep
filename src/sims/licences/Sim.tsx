import { useState } from 'react'
import { Choice, Panel } from '../ui'
import { type Answers, DEFAULT_ANSWERS, type Licence, type LicencesParams, type Scope, kindOf, noMatchHint, recommend } from './model'

const yn = (b: boolean) => (b ? 'yes' : 'no')
const YES_NO = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
] as const

function LicenceCard({ licence }: { licence: Licence }) {
  return (
    <article className="rounded border border-slate-200 p-3">
      <h3 className="font-semibold">
        {licence.name} <span className="font-mono text-sm text-slate-500">({licence.short})</span>
      </h3>
      <p className="text-xs uppercase tracking-wide text-slate-500">{kindOf(licence)}</p>
      <p className="mt-1 text-sm">{licence.summary}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {licence.conditions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm">
        <strong>Watch out:</strong> {licence.watchOut}
      </p>
    </article>
  )
}

function Scenarios({ params }: { params: LicencesParams }) {
  const [picked, setPicked] = useState<Record<number, string>>({})
  const byId = new Map(params.licences.map((l) => [l.id, l]))
  const right = params.scenarios.filter((s, n) => picked[n] === s.answer).length
  const answered = Object.keys(picked).length
  return (
    <Panel title="TuxPixel scenarios">
      <p className="mb-3 text-sm" aria-live="polite">
        {right} of {params.scenarios.length} right{answered < params.scenarios.length ? ` (${answered} answered)` : ''}.
      </p>
      <ol className="space-y-4">
        {params.scenarios.map((s, n) => {
          const choice = picked[n]
          return (
            <li key={s.text} className="text-sm">
              <p className="mb-2">{s.text}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Licence for scenario ${n + 1}`}>
                {s.options.map((o) => {
                  const isPicked = choice === o
                  const state = choice === undefined ? '' : o === s.answer ? 'border-brand bg-brand text-chalk' : isPicked ? 'border-red-600 text-red-600' : 'border-slate-300 text-slate-400'
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={choice !== undefined}
                      aria-pressed={isPicked}
                      onClick={() => setPicked((p) => ({ ...p, [n]: o }))}
                      className={`rounded border px-3 py-1 ${choice === undefined ? 'border-slate-300' : state}`}
                    >
                      {byId.get(o)?.short ?? o}
                    </button>
                  )
                })}
              </div>
              {choice !== undefined && (
                <p className="mt-2" role="status">
                  <strong>{choice === s.answer ? 'Right.' : `Not ${byId.get(choice)?.short}. The answer is ${byId.get(s.answer)?.short}.`}</strong> {s.why}
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

export default function LicencesSim({ params }: { params: LicencesParams }) {
  const [a, setA] = useState<Answers>(DEFAULT_ANSWERS)
  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }))
  const results = recommend(params.licences, a)
  const fitting = results.filter((r) => r.verdict.fits)
  const ruledOut = results.filter((r) => !r.verdict.fits)
  const isCode = a.kind === 'code'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="What do you want?">
          <div className="space-y-4">
            <Choice
              label="What are you licensing?"
              value={a.kind}
              options={[
                { id: 'code', label: 'Code (the game engine)' },
                { id: 'content', label: 'Art, music or docs' },
              ]}
              onChange={(kind) => set({ kind })}
            />
            <Choice
              label="Must changed copies that others pass on keep the same terms?"
              value={a.share}
              options={[
                { id: 'none', label: 'No, they may close them' },
                { id: 'same', label: 'Yes (copyleft)' },
              ]}
              onChange={(share) => set({ share })}
            />
            {isCode && a.share === 'same' && (
              <Choice<Scope>
                label="How far should that reach?"
                value={a.scope}
                options={[
                  { id: 'program', label: 'The whole program' },
                  { id: 'library', label: 'Only the library itself' },
                  { id: 'network', label: 'Also web service users' },
                ]}
                onChange={(scope) => set({ scope })}
              />
            )}
            <Choice label="May others use it commercially?" value={yn(a.commercial)} options={YES_NO} onChange={(v) => set({ commercial: v === 'yes' })} />
            <Choice label="May others share changed versions?" value={yn(a.changes)} options={YES_NO} onChange={(v) => set({ changes: v === 'yes' })} />
            <Choice label="Must they credit you?" value={yn(a.credit)} options={YES_NO} onChange={(v) => set({ credit: v === 'yes' })} />
          </div>
        </Panel>

        <Panel title={fitting.length === 1 ? 'The licence that fits' : 'The licences that fit'}>
          <div aria-live="polite" className="space-y-3">
            {fitting.length === 0 ? <p className="text-sm">{noMatchHint(a)}</p> : fitting.map((r) => <LicenceCard key={r.licence.id} licence={r.licence} />)}
          </div>
        </Panel>
      </div>

      <Panel title="Ruled out, and why">
        <ul className="space-y-2 text-sm">
          {ruledOut.map((r) => (
            <li key={r.licence.id}>
              <strong>{r.licence.short}:</strong> {r.verdict.problems[0]}
              {r.verdict.problems.length > 1 && <span className="text-slate-500"> (and {r.verdict.problems.length - 1} more)</span>}
            </li>
          ))}
        </ul>
      </Panel>

      <Scenarios params={params} />
    </div>
  )
}
