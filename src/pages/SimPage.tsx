import { Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { objectiveName } from '../content/blueprint'
import type { Sim } from '../content/schema'
import { SIMS, SIM_BY_ID } from '../content/sims'
import { Inline } from '../components/Inline'
import { useProgress } from '../progress/store'
import { SIM_REGISTRY } from '../sims/registry'
import { TryItems } from '../sims/TryItems'

export default function SimPage() {
  const { simId } = useParams()
  if (!simId) return <SimList />
  const sim = SIM_BY_ID.get(simId)
  if (!sim || !SIM_REGISTRY.has(simId)) return <h1 className="text-2xl font-semibold">No simulator called “{simId}”</h1>
  // Keying on the id resets every control when moving to another simulator.
  return <SimView key={sim.id} sim={sim} />
}

function SimList() {
  const { track } = useProgress()
  const sims = SIMS.filter((s) => SIM_REGISTRY.has(s.id))
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Simulators</h1>
      <p className="text-slate-600">
        Try the ideas behind the commands: work out permissions, walk the filesystem, follow a pipe. The service, SSH, network and user simulators
        replay output recorded on a real Debian system, for the tools the in-browser terminal can’t run. Each simulator ends with a few exam-style
        questions.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {sims.map((s) => (
          <li key={s.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{s.objectives.map((o) => objectiveName(o, track).split(' ')[0]).join(', ')}</p>
            <h2 className="mt-1 font-semibold">
              <Link to={`/explore/sims/${s.id}`} className="text-brand-dark underline-offset-2 hover:underline">
                {s.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <Inline text={s.description} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SimView({ sim }: { sim: Sim }) {
  const { track } = useProgress()
  const entry = SIM_REGISTRY.get(sim.id)!
  const params = entry.params.safeParse(sim.params)
  const Component = entry.Component
  return (
    <article className="space-y-6">
      <Link to="/explore/sims" className="text-sm text-slate-600 hover:underline">
        ← Simulators
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{sim.title}</h1>
        <p className="text-lg text-slate-700">
          <Inline text={sim.intro} />
        </p>
      </header>

      {params.success ? (
        <Suspense fallback={<p className="text-slate-500">Loading the simulator…</p>}>
          <Component params={params.data as never} />
        </Suspense>
      ) : (
        <p className="text-red-600">This simulator's data is invalid: {params.error.message}</p>
      )}

      <section className="rounded-lg border border-brand/40 bg-brand/5 p-4">
        <h2 className="mb-2 font-semibold">For the exam</h2>
        <ul className="list-disc space-y-1 pl-5">
          {sim.takeaways.map((t) => (
            <li key={t}>
              <Inline text={t} />
            </li>
          ))}
        </ul>
      </section>

      <TryItems itemIds={sim.tryItems} />

      <footer className="space-y-3 border-t border-slate-200 pt-4 text-sm">
        <div>
          <h2 className="font-semibold">Sources</h2>
          <ul className="mt-1 list-disc pl-5">
            {sim.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer" className="text-brand-dark underline">
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex flex-wrap gap-2">
          {sim.objectives.map((o) => (
            <Link key={o} to={`/learn/${o}`} className="rounded border px-3 py-1">
              Lesson {objectiveName(o, track)}
            </Link>
          ))}
        </p>
      </footer>
    </article>
  )
}
