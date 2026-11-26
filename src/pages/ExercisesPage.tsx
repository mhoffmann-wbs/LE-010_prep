import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Inline } from '../components/Inline'
import { ShellCommand } from '../components/ShellCommand'
import { EXAM_IDS, OBJECTIVES, OBJECTIVE_BY_ID, TOPICS, itemInExam, objectiveName, topicName } from '../content/blueprint'
import { type CheckReport, type Exercise, checkJob, parseCheck, startJob } from '../content/exercise'
import { EXERCISES, EXERCISE_BY_ID } from '../content/exercises'
import { FIXTURES } from '../content/fixtureBank'
import { recordExerciseCheck, useProgress } from '../progress/store'
import { type Vm, vmAvailable } from '../vm/emulator'
import { RunError, VmRunner } from '../vm/runner'
import type { TerminalControls } from '../vm/Terminal'

const Terminal = lazy(() => import('../vm/Terminal'))

export default function ExercisesPage() {
  const { exerciseId } = useParams()
  if (!exerciseId) return <ExerciseIndex />
  const exercise = EXERCISE_BY_ID.get(exerciseId)
  if (!exercise) {
    return (
      <p>
        No such exercise.{' '}
        <Link to="/exercises" className="underline">
          Back to Exercises
        </Link>
      </p>
    )
  }
  return <ExerciseView key={exerciseId} exercise={exercise} />
}

/** Exercises in blueprint order, then file order within an objective. */
const objectiveIndex = new Map(OBJECTIVES.map((o, i) => [o.id, i]))
const ORDERED = [...EXERCISES].sort((a, b) => objectiveIndex.get(a.objectiveId)! - objectiveIndex.get(b.objectiveId)! || a.id.localeCompare(b.id))

/** Exercises the learner's exam doesn't cover say which exam they are for. */
function ExamBadge({ exercise }: { exercise: Exercise }) {
  const { track } = useProgress()
  if (itemInExam(exercise, track)) return null
  const exam = EXAM_IDS.find((e) => itemInExam(exercise, e))
  return exam ? <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs text-slate-900">{exam} only</span> : null
}

function ExerciseIndex() {
  const { exercises, track } = useProgress()
  const solved = ORDERED.filter((e) => exercises[e.id]?.solvedAt).length
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Exercises</h1>
      <p className="text-slate-600">
        Small tasks to do yourself in a real Linux terminal, as Mira at TuxPixel Studio. Each one starts from a prepared set of files, and Check
        looks at what you did. Hints are revealed one at a time, and there is a model solution. {solved} of {ORDERED.length} solved.
      </p>
      {TOPICS.map((t) => {
        const list = ORDERED.filter((e) => OBJECTIVE_BY_ID.get(e.objectiveId)!.topicId === t.id)
        if (list.length === 0) return null
        return (
          <section key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{topicName(t.id, track)}</h2>
            <ul className="mt-2 space-y-1">
              {list.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2 text-sm">
                  <span className="w-4 shrink-0" aria-label={exercises[e.id]?.solvedAt ? 'solved' : undefined}>
                    {exercises[e.id]?.solvedAt ? '✓' : ''}
                  </span>
                  <Link to={`/exercises/${e.id}`} className="text-brand-dark hover:underline">
                    {e.title}
                  </Link>
                  <span className="text-xs text-slate-500">{objectiveName(e.objectiveId, track)}</span>
                  <ExamBadge exercise={e} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * Prompt text: paragraphs split by blank lines; paragraphs of "1. " or "- " lines
 * become lists, and a paragraph fenced with ``` is shown as a block (it may not
 * contain blank lines).
 */
function Prompt({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split(/\n\s*\n/).map((para, i) => {
        const lines = para.split('\n')
        if (para.startsWith('```'))
          return (
            <pre key={i} className="overflow-x-auto rounded border border-slate-300 bg-slate-50 p-3 font-mono text-sm">
              {lines.slice(1, lines.at(-1) === '```' ? -1 : undefined).join('\n')}
            </pre>
          )
        if (lines.every((l) => /^\d+\. /.test(l)))
          return (
            <ol key={i} className="list-decimal space-y-1 pl-6">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\d+\. /, '')} />
                </li>
              ))}
            </ol>
          )
        if (lines.every((l) => l.startsWith('- ')))
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.slice(2)} />
                </li>
              ))}
            </ul>
          )
        return (
          <p key={i}>
            <Inline text={para} />
          </p>
        )
      })}
    </div>
  )
}

type Machine = { state: 'unknown' | 'missing' | 'starting' | 'ready' | 'busy' } | { state: 'error'; message: string }

function ExerciseView({ exercise: ex }: { exercise: Exercise }) {
  const { exercises, track } = useProgress()
  const stat = exercises[ex.id]
  const objectiveId = ex.objectiveId
  const [machine, setMachine] = useState<Machine>({ state: 'unknown' })
  const [report, setReport] = useState<CheckReport | null>(null)
  const [hintsShown, setHintsShown] = useState(0)
  const [solutionShown, setSolutionShown] = useState(false)
  const runner = useRef<VmRunner | null>(null)
  const controls = useRef<TerminalControls | null>(null)
  const fixture = ex.fixture ? FIXTURES[ex.fixture] : undefined

  useEffect(() => {
    window.scrollTo(0, 0)
    void vmAvailable().then((ok) => setMachine({ state: ok ? 'starting' : 'missing' }))
  }, [])

  // Applies the fixture while the terminal waits at mira's prompt.
  const onStart = useCallback(
    async (vm: Vm, terminal: TerminalControls) => {
      const r = new VmRunner(vm.emulator, vm.snapshot)
      try {
        await r.run(startJob(fixture))
        runner.current = r
        controls.current = terminal
        setMachine({ state: 'ready' })
      } catch (e) {
        setMachine({ state: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    },
    [fixture],
  )

  const check = async () => {
    if (!runner.current) return
    setMachine({ state: 'busy' })
    setReport(null)
    try {
      const result = await runner.current.run(checkJob(ex), { keep: true })
      const parsed = parseCheck(result.exit, result.output)
      recordExerciseCheck(ex.id, parsed.passed)
      setReport(parsed)
    } catch (e) {
      const message = e instanceof RunError && e.reason === 'timeout' ? 'The check took too long. Is a command still running in the terminal? Press Ctrl+C, then check again.' : String(e)
      setReport({ passed: false, rows: [], other: message })
    } finally {
      setMachine({ state: 'ready' })
    }
  }

  const reset = async () => {
    if (!runner.current) return
    setMachine({ state: 'busy' })
    setReport(null)
    try {
      await runner.current.run(startJob(fixture))
      controls.current?.refresh()
      setMachine({ state: 'ready' })
    } catch (e) {
      setMachine({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const index = ORDERED.indexOf(ex)
  const prev = ORDERED[index - 1]
  const next = ORDERED[index + 1]
  const usable = machine.state === 'ready'

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-slate-500">
          <Link to="/exercises" className="hover:underline">
            Exercises
          </Link>{' '}
          /{' '}
          <Link to={`/learn/${objectiveId}`} className="hover:underline">
            {objectiveName(objectiveId, track)}
          </Link>
        </p>
        <h1 className="text-3xl font-bold">
          {ex.title}
          <ExamBadge exercise={ex} />
        </h1>
        {stat?.solvedAt && <p className="text-sm text-slate-600">✓ Solved</p>}
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <Prompt text={ex.prompt} />
        <p className="mt-3 text-sm text-slate-600">
          You are logged in as <code>mira</code> (password <code>tuxpixel</code>) in her home directory, <code>/home/mira</code>.
        </p>
      </section>

      {machine.state === 'unknown' && <p className="text-slate-500">Checking for the Linux image…</p>}
      {machine.state === 'missing' && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          The Linux image isn’t built yet. Run <code>npm run vm:build</code> and then <code>npm run vm:state</code>.
        </p>
      )}
      {machine.state !== 'unknown' && machine.state !== 'missing' && (
        <section className="space-y-3">
          <Suspense fallback={<p className="text-slate-500">Loading the terminal…</p>}>
            <Terminal onStart={onStart} />
          </Suspense>
          {machine.state === 'error' && <p className="text-sm text-red-700">The exercise could not start: {machine.message}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void check()}
              disabled={!usable}
              className="rounded bg-accent px-4 py-2 font-medium text-slate-900 disabled:opacity-50"
            >
              {machine.state === 'busy' ? 'Working…' : 'Check'}
            </button>
            <button
              type="button"
              onClick={() => void reset()}
              disabled={!usable}
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Start over
            </button>
          </div>
        </section>
      )}

      {report && <Report report={report} next={next} />}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Stuck?</h2>
        {ex.hints.slice(0, hintsShown).map((hint, i) => (
          <p key={i} className="rounded bg-slate-50 p-3 text-sm">
            <strong>Hint {i + 1}:</strong> <Inline text={hint} />
          </p>
        ))}
        <div className="flex flex-wrap gap-3">
          {hintsShown < ex.hints.length && (
            <button type="button" onClick={() => setHintsShown((n) => n + 1)} className="rounded border border-brand px-3 py-1.5 text-sm text-brand-dark">
              Show hint {hintsShown + 1} of {ex.hints.length}
            </button>
          )}
          {!solutionShown && (
            <button type="button" onClick={() => setSolutionShown(true)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              {stat?.attempts ? 'Show the solution' : 'Show the solution (try first!)'}
            </button>
          )}
        </div>
        {solutionShown && (
          <div className="space-y-1">
            <p className="text-sm text-slate-600">One way to solve it (yours can differ and still pass):</p>
            <ShellCommand command={ex.solution.trimEnd()} />
          </div>
        )}
      </section>

      <nav aria-label="Exercise navigation" className="flex gap-3 border-t border-slate-200 pt-6">
        {prev && <NavCard ex={prev} label="← Previous exercise" align="" />}
        {next && <NavCard ex={next} label="Next exercise →" align="ml-auto text-right" />}
      </nav>
    </article>
  )
}

function NavCard({ ex, label, align }: { ex: Exercise; label: string; align: string }) {
  return (
    <Link to={`/exercises/${ex.id}`} className={`flex-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-brand ${align}`}>
      <span className="block text-xs text-slate-500">{label}</span>
      <span className="font-medium text-brand-dark">{ex.title}</span>
    </Link>
  )
}

function Report({ report, next }: { report: CheckReport; next?: Exercise }) {
  const met = report.rows.filter((r) => r.passed).length
  return (
    <section aria-label="Check results" className={`space-y-3 rounded-lg border-2 p-4 ${report.passed ? 'border-green-600 bg-green-50' : 'border-red-600 bg-white'}`}>
      <h2 className="font-semibold">
        {report.passed ? '✓ All checks passed. Well done!' : report.rows.length ? `${met} of ${report.rows.length} checks passed.` : 'The check could not run.'}
      </h2>
      {report.rows.length > 0 && (
        <ul className="space-y-1">
          {report.rows.map((row, i) => (
            <li key={i} className="text-sm">
              <span className={row.passed ? 'text-green-600' : 'text-red-700'}>{row.passed ? '✓' : '✗'}</span> <Inline text={row.text} />
            </li>
          ))}
        </ul>
      )}
      {report.other && <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2 font-mono text-xs">{report.other}</pre>}
      {report.passed && next && (
        <Link to={`/exercises/${next.id}`} className="inline-block rounded bg-brand px-4 py-2 font-medium text-chalk">
          Next exercise →
        </Link>
      )}
    </section>
  )
}
