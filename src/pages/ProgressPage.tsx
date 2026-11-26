import { type ChangeEvent, useState } from 'react'
import { Link } from 'react-router'
import { ExamSettings } from '../components/ExamSettings'
import { OutputItemsToggle } from '../components/OutputItemsToggle'
import { EXAM_FORMAT, OBJECTIVES, OBJECTIVE_BY_ID, TOPICS, objectiveLabel, topicLabel } from '../content/blueprint'
import { ITEMS } from '../content/bank'
import { objectiveReadiness, weightedReadiness } from '../progress/readiness'
import { exportProgress, importProgress, useProgress } from '../progress/store'
import { objectiveWeights, practicePool } from '../quiz/pools'

const pct = (n: number) => `${Math.round(n * 100)}%`

export default function ProgressPage() {
  const progress = useProgress()
  const pool = practicePool(ITEMS, progress.track, progress.outputInPractice)
  const weights = objectiveWeights()
  const rows = objectiveReadiness(OBJECTIVES, pool, progress)
  const topics = TOPICS.map((t) => ({ ...t, label: topicLabel(t, progress.track), readiness: weightedReadiness(rows.filter((r) => r.objectiveId.startsWith(`${t.id}.`)), weights) }))
  const weakest = rows.filter((r) => pool.some((i) => i.objectiveId === r.objectiveId)).sort((a, b) => a.readiness - b.readiness).slice(0, 5)
  const mocks = progress.mockResults.filter((m) => m.exam === progress.track)
  const lastMock = mocks.at(-1)

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Progress</h1>
        <p className="text-slate-600">
          Readiness for exam {progress.track} is the share of each objective's questions you can currently answer, weighted like the exam.
          It's a study guide, not a score prediction.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Weighted readiness" value={pct(weightedReadiness(rows, weights))} />
        <Stat label="Last mock (estimate)" value={lastMock ? String(lastMock.scaled) : '–'} hint={`pass at ${EXAM_FORMAT.passScore}`} />
        <Stat label="Questions answered" value={String(pool.filter((i) => progress.items[i.id]).length)} hint={`of ${pool.length}`} />
        <Stat label="Mocks taken" value={String(mocks.length)} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">By topic</h2>
        <ul className="mt-3 space-y-2">
          {topics.map((t) => (
            <li key={t.id}>
              <div className="flex justify-between gap-4 text-sm">
                <span>
                  {t.label.id} {t.label.title}
                </span>
                <span className="font-mono">{pct(t.readiness)}</span>
              </div>
              <div className="mt-1 h-2 rounded bg-slate-100" role="presentation">
                <div className="h-2 rounded bg-brand" style={{ width: pct(t.readiness) }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Weakest objectives</h2>
          <Link to="/practice?weak=1" className="rounded bg-brand-dark px-4 py-2 text-sm font-medium text-chalk">
            Run the weak-spot drill
          </Link>
        </div>
        {weakest.length === 0 && <p className="mt-3 text-sm text-slate-500">No questions yet.</p>}
        <ul className="mt-3 space-y-1 text-sm">
          {weakest.map((r) => (
            <li key={r.objectiveId} className="flex justify-between gap-4">
              <Link to={`/practice?objective=${r.objectiveId}`} className="text-brand-dark hover:underline">
                {Object.values(objectiveLabel(OBJECTIVE_BY_ID.get(r.objectiveId)!, progress.track)).join(' ')}
              </Link>
              <span className="shrink-0 text-slate-500">
                {pct(r.coverage)} seen · {pct(r.accuracy)} right
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <ExamSettings />
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Question formats</h2>
        <OutputItemsToggle part="practice" />
        <OutputItemsToggle part="mock" />
      </section>

      <YourData />
    </div>
  )
}

/** Progress lives in this browser only, so learners can move it between devices as a file. */
function YourData() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function download() {
    const url = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `le-010-progress-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // let the same file be picked again
    if (!file) return
    if (!window.confirm('Importing replaces all progress in this browser. Continue?')) return
    try {
      importProgress(await file.text())
      setMessage({ ok: true, text: `Imported progress from ${file.name}.` })
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message })
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">Your data</h2>
      <p className="mt-1 text-sm text-slate-600">
        Progress is saved in this browser only. Export it to keep a backup or to continue on another device, then import the file there.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={download} className="rounded border px-4 py-2 text-sm">
          Export progress
        </button>
        <label className="cursor-pointer rounded border px-4 py-2 text-sm">
          Import progress
          <input type="file" accept="application/json,.json" onChange={upload} className="sr-only" />
        </label>
      </div>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
