import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { Inline } from '../components/Inline'
import { EXAM_FORMAT, EXAM_IDS, OBJECTIVES, OBJECTIVE_BY_ID, SOURCES, TOPICS, linesFor, objectiveLabel, objectiveName, objectivesOf, topicName } from '../content/blueprint'
import { ITEMS } from '../content/bank'
import { EXERCISES } from '../content/exercises'
import { LESSONS } from '../content/lessons'
import { lessonComponents } from '../lessons/components'
import { setLessonRead, useProgress } from '../progress/store'

export default function LearnPage() {
  const { objectiveId } = useParams()
  return objectiveId ? <LessonView key={objectiveId} objectiveId={objectiveId} /> : <LessonIndex />
}

function LessonIndex() {
  const { lessonsRead, track } = useProgress()
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Learn</h1>
      <p className="text-slate-600">
        One lesson per exam objective: the big idea in plain words, a walkthrough with commands you can run in a real Linux, how
        TuxPixel Studio uses it, quick predict-the-output checks and the traps the exam likes to set. {lessonsRead.length} of{' '}
        {LESSONS.size} marked as read. The free{' '}
        <a href={SOURCES.learningMaterialsUrl} target="_blank" rel="noreferrer" className="text-brand-dark underline">
          LPI Learning Materials
        </a>{' '}
        are a good second explanation. Lessons teach exam 010-200; boxes mark what only one of the two exams asks.
      </p>
      {TOPICS.map((t) => (
        <section key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">{topicName(t.id, track)}</h2>
          <ul className="mt-2 space-y-1">
            {objectivesOf(t.id).map((o) => (
              <li key={o.id} className="flex items-baseline gap-2 text-sm">
                <span className="w-4 shrink-0">{lessonsRead.includes(o.id) ? '✓' : ''}</span>
                {LESSONS.has(o.id) ? (
                  <Link to={`/learn/${o.id}`} className="text-brand-dark hover:underline">
                    {objectiveName(o.id, track)}
                  </Link>
                ) : (
                  <span className="text-slate-400">{objectiveName(o.id, track)} (coming soon)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function LessonView({ objectiveId }: { objectiveId: string }) {
  const { lessonsRead, track } = useProgress()
  const objective = OBJECTIVE_BY_ID.get(objectiveId)
  const lesson = LESSONS.get(objectiveId)
  // The topic links sit at the bottom of the page, so start each lesson at the top
  // (the view is keyed by objective, so this runs once per lesson).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  if (!objective) {
    return (
      <p>
        No such objective.{' '}
        <Link to="/learn" className="underline">
          Back to Learn
        </Link>
      </p>
    )
  }
  const other = EXAM_IDS.find((e) => e !== track)!
  const onOtherOnly = (kind: 'areas' | 'terms') => {
    const mine = new Set(linesFor(objective, kind, track).map((l) => l.id))
    return linesFor(objective, kind, other).filter((l) => !mine.has(l.id))
  }
  const otherOnly = [...onOtherOnly('areas'), ...onOtherOnly('terms')]
  const read = lessonsRead.includes(objectiveId)
  const practiceCount = ITEMS.filter((i) => i.objectiveId === objectiveId).length
  const exercises = EXERCISES.filter((e) => e.objectiveId === objectiveId)

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-slate-500">
          <Link to="/learn" className="hover:underline">
            Learn
          </Link>{' '}
          / {topicName(objective.topicId, track)}
        </p>
        <h1 className="text-3xl font-bold">{objectiveName(objective.id, track)}</h1>
        <p className="text-sm text-slate-600">
          On exam {other}: {Object.values(objectiveLabel(objective, other)).join(' ')}.
        </p>
        <p className="text-sm text-slate-600">
          Weight {objective.weight}: about {objective.weight} of the exam’s {EXAM_FORMAT.items} questions.
          {lesson && ` Facts checked on ${lesson.meta.updated}.`}
        </p>
      </header>

      {lesson ? (
        <>
          <p className="rounded-lg border-l-4 border-brand bg-white p-4">
            <strong>In short:</strong> <Inline text={lesson.meta.tldr} />
          </p>
          <div className="prose max-w-none prose-a:text-brand-dark prose-code:before:content-none prose-code:after:content-none">
            <lesson.Content components={lessonComponents} />
          </div>
        </>
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">The lesson for this objective is coming soon.</p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">What the {track} objectives cover</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {linesFor(objective, 'areas', track).map((a) => (
              <li key={a.id}>{a.text}</li>
            ))}
          </ol>
          <h3 className="mt-3 text-sm font-semibold">Files, terms and utilities</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {linesFor(objective, 'terms', track).map((t) => (
              <li key={t.id}>{t.text}</li>
            ))}
          </ul>
          {otherOnly.length > 0 && (
            <>
              <h3 className="mt-3 text-sm font-semibold">Only on exam {other}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-500">
                {otherOnly.map((l) => (
                  <li key={l.id}>{l.text}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Sources and further reading</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {lesson?.meta.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer" className="text-brand-dark underline">
                  {link.title}
                </a>
              </li>
            ))}
            <li>
              <a href={SOURCES.learningMaterialsUrl} target="_blank" rel="noreferrer" className="text-brand-dark underline">
                LPI Learning Materials for {SOURCES.examCode}
              </a>{' '}
              (free; look for objective {objective.id})
            </li>
          </ul>
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-3">
        {lesson && (
          <button
            onClick={() => setLessonRead(objectiveId, !read)}
            className={`rounded px-4 py-2 font-medium ${read ? 'border border-brand text-brand-dark' : 'bg-brand text-chalk'}`}
          >
            {read ? '✓ Marked as read' : 'Mark as read'}
          </button>
        )}
        {practiceCount > 0 && (
          <Link to={`/practice?objective=${objectiveId}`} className="rounded border px-4 py-2">
            Practise this objective ({practiceCount})
          </Link>
        )}
        {practiceCount > 0 && (
          <Link to={`/questions?objective=${objectiveId}`} className="rounded border px-4 py-2">
            Browse its questions
          </Link>
        )}
        {exercises.length > 0 && (
          <Link to={`/exercises/${exercises[0]!.id}`} className="rounded border px-4 py-2">
            Try it in the terminal ({exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'})
          </Link>
        )}
        <Link to="/terminal" className="rounded border px-4 py-2">
          Open the terminal
        </Link>
      </footer>

      <LessonNav objectiveId={objectiveId} />
    </article>
  )
}

/** Previous and next lesson in blueprint order, skipping objectives without a lesson yet. */
function LessonNav({ objectiveId }: { objectiveId: string }) {
  const { track } = useProgress()
  const order = OBJECTIVES.map((o) => o.id).filter((id) => LESSONS.has(id) || id === objectiveId)
  const index = order.indexOf(objectiveId)
  const prev = order[index - 1]
  const next = order[index + 1]
  const card = (id: string, label: string, align: string) => (
    <Link to={`/learn/${id}`} className={`flex-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-brand ${align}`}>
      <span className="block text-xs text-slate-500">{label}</span>
      <span className="font-medium text-brand-dark">
        {objectiveName(id, track)}
      </span>
    </Link>
  )
  return (
    <nav aria-label="Lesson navigation" className="flex gap-3 border-t border-slate-200 pt-6">
      {prev && card(prev, '← Previous objective', '')}
      {next && card(next, 'Next objective →', 'ml-auto text-right')}
    </nav>
  )
}
