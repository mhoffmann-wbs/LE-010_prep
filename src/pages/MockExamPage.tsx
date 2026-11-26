import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { OutputItemsToggle } from '../components/OutputItemsToggle'
import { ASSUMED_PASS_FRACTION, EXAM_FORMAT, MOCK } from '../content/blueprint'
import { ITEMS } from '../content/bank'
import { getProgress, recordAnswer, recordMockResult, useProgress } from '../progress/store'
import { type Response, emptyResponse, grade, isAnswered } from '../quiz/grade'
import { ItemView } from '../quiz/ItemView'
import { type MockScore, scoreMock } from '../quiz/results'
import { type MockExam, buildMockExam } from '../quiz/sampler'
import { ScoreTable } from '../quiz/ScoreTable'
import { ShortcutHint } from '../quiz/ShortcutHint'
import { useShortcuts } from '../quiz/shortcuts'

type Answers = Record<string, Response>

/** Items the learner has answered before, so a new mock prefers fresh ones. */
const seenItems = () => new Set(Object.entries(getProgress().items).flatMap(([id, s]) => (s.attempts > 0 ? [id] : [])))

const newExam = (): MockExam => {
  const { track, outputInMock } = getProgress()
  return buildMockExam(ITEMS, track, outputInMock, seenItems())
}

export default function MockExamPage() {
  const [exam, setExam] = useState<MockExam | null>(null)
  const [result, setResult] = useState<{ score: MockScore; answers: Answers } | null>(null)
  // Keys the runner so a new exam starts with a fresh clock, answers and flags.
  const [attempt, setAttempt] = useState(0)

  function start() {
    setExam(newExam())
    setResult(null)
    setAttempt((a) => a + 1)
  }

  if (result && exam) return <MockResults exam={exam} score={result.score} answers={result.answers} onRestart={start} />
  if (exam) {
    return (
      <MockRunner
        key={attempt}
        exam={exam}
        onSubmit={(answers) => {
          const score = scoreMock(exam.items, exam.exam, (item) => grade(item, answers[item.id]!))
          const at = Date.now()
          for (const item of exam.items) recordAnswer(item.id, grade(item, answers[item.id]!), at)
          recordMockResult({
            at,
            exam: exam.exam,
            output: exam.output,
            correct: score.correct,
            total: score.total,
            percent: score.percent,
            scaled: score.scaled,
            passed: score.passed,
            topics: score.topics.map(({ id, correct, total }) => ({ id, correct, total })),
          })
          setResult({ score, answers })
        }}
      />
    )
  }
  return <MockIntro onStart={start} />
}

function MockIntro({ onStart }: { onStart: () => void }) {
  useProgress() // re-render when the output-items toggle changes
  const preview = newExam()
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Mock exam</h1>
      <p>
        The real exam has {EXAM_FORMAT.items} questions in {EXAM_FORMAT.minutes} minutes, one for each weight point of the objectives, so this
        mock draws the same way. Results are a scaled score from {EXAM_FORMAT.scaleMin} to {EXAM_FORMAT.scaleMax}, and you need{' '}
        {EXAM_FORMAT.passScore} to pass.
      </p>
      <p>
        There is no feedback until you submit, and you can flag questions and review them before submitting. Unanswered questions count as
        wrong.
      </p>
      <OutputItemsToggle part="mock" />
      <p className="text-sm text-slate-600">
        Want a mixed set without the clock and with feedback after every question? Run a{' '}
        <Link to="/practice" className="text-brand-dark underline">
          mixed set
        </Link>{' '}
        on the Practice page.
      </p>
      {preview.shortfall > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          The question bank is still growing. This mock has <strong>{preview.items.length}</strong> questions, and its time limit is scaled
          to the real exam's pace: <strong>{preview.minutes} min</strong>.
        </p>
      )}
      <button onClick={onStart} disabled={preview.items.length === 0} className="rounded bg-brand px-5 py-2 font-medium text-chalk disabled:opacity-40">
        Start the mock exam
      </button>
    </div>
  )
}

function MockRunner({ exam, onSubmit }: { exam: MockExam; onSubmit: (answers: Answers) => void }) {
  const [deadline] = useState(() => Date.now() + exam.minutes * 60_000)
  const [now, setNow] = useState(() => Date.now())
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>(() => Object.fromEntries(exam.items.map((i) => [i.id, emptyResponse(i)])))
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState(false)
  // Once the review screen has been reached, items offer a way straight back to it.
  const [reviewed, setReviewed] = useState(false)

  const submit = useCallback(() => onSubmit(answers), [answers, onSubmit])
  const remaining = Math.max(0, deadline - now)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (remaining === 0) submit()
  }, [remaining, submit])

  const item = exam.items[index]!
  const unanswered = exam.items.filter((i) => !isAnswered(i, answers[i.id]!)).length

  function toggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isLast = index + 1 === exam.items.length
  const openReview = () => {
    setReviewing(true)
    setReviewed(true)
  }
  const goNext = () => (isLast ? openReview() : setIndex((i) => i + 1))
  // M for "mark": F is an answer letter on six-option items.
  useShortcuts(
    {
      Enter: goNext,
      ArrowRight: goNext,
      ArrowLeft: () => setIndex((i) => Math.max(0, i - 1)),
      m: () => toggleFlag(item.id),
      ...(reviewed && { r: openReview }),
    },
    !reviewing,
  )

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Mock exam</h1>
      <div className="sticky top-0 z-10 flex items-center justify-between rounded bg-header px-4 py-2 text-chalk">
        <span>{reviewing ? 'Review' : `Question ${index + 1} of ${exam.items.length}`}</span>
        <span className="font-mono" aria-label="time remaining">
          {formatClock(remaining)}
        </span>
      </div>

      {reviewing ? (
        <div className="space-y-4">
          <p>
            {unanswered === 0 ? 'All questions answered.' : `${unanswered} question(s) not answered.`} {flagged.size} flagged.
          </p>
          <ol className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {exam.items.map((i, n) => (
              <li key={i.id}>
                <button
                  onClick={() => {
                    setIndex(n)
                    setReviewing(false)
                  }}
                  className={`w-full rounded border px-2 py-1 text-sm ${isAnswered(i, answers[i.id]!) ? 'border-brand bg-brand/10' : 'border-slate-300 bg-white'} ${
                    flagged.has(i.id) ? 'ring-2 ring-accent' : ''
                  }`}
                >
                  {n + 1}
                  {flagged.has(i.id) ? ' ⚑' : ''}
                </button>
              </li>
            ))}
          </ol>
          <div className="flex justify-between">
            <button onClick={() => setReviewing(false)} className="rounded border px-4 py-2">
              Back to questions
            </button>
            <button onClick={submit} className="rounded bg-brand-dark px-4 py-2 font-medium text-chalk">
              Submit exam
            </button>
          </div>
        </div>
      ) : (
        <>
          <ItemView
            key={item.id}
            item={item}
            response={answers[item.id]!}
            onChange={(r) => setAnswers((a) => ({ ...a, [item.id]: r }))}
            keyboard
            onEnter={goNext}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => setIndex((i) => i - 1)} disabled={index === 0} className="rounded border px-4 py-2 disabled:opacity-40">
              Previous
            </button>
            <button onClick={() => toggleFlag(item.id)} className="rounded border px-4 py-2">
              {flagged.has(item.id) ? 'Unflag' : 'Flag for review'}
            </button>
            {reviewed && (
              <button onClick={openReview} className="rounded border px-4 py-2">
                Back to review
              </button>
            )}
            <button onClick={goNext} className="rounded bg-brand px-4 py-2 text-chalk">
              {isLast ? 'Review' : 'Next'}
            </button>
          </div>
          <ShortcutHint
            items={[
              ['1–6', 'or A–F select'],
              ['Enter', isLast ? 'review' : 'next'],
              ['← →', 'move'],
              ['M', 'flag'],
              ...(reviewed ? [['R', 'review'] satisfies [string, string]] : []),
            ]}
          />
        </>
      )}
    </div>
  )
}

function MockResults({ exam, score, answers, onRestart }: { exam: MockExam; score: MockScore; answers: Answers; onRestart: () => void }) {
  const [showReview, setShowReview] = useState(false)
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">{score.passed ? 'Pass' : 'Not yet: keep practising'}</h1>
        <p className="text-lg">
          Estimated scaled score <strong>{score.scaled}</strong> · pass at {EXAM_FORMAT.passScore}
        </p>
        <p>
          {score.correct}/{score.total} questions correct ({score.percent}%).
        </p>
        <p className="text-xs text-slate-500">
          The scaled score is an estimate. LPI sets the pass mark per exam form and doesn't publish it as a percentage, so this app assumes you
          need about {Math.round(ASSUMED_PASS_FRACTION * 100)}% correct to reach {EXAM_FORMAT.passScore}.
          {exam.shortfall > 0 && ` This mock had ${exam.shortfall} fewer questions than the real exam's ${MOCK.items}.`}
        </p>
        <ScoreTable rows={score.topics} heading="Topic" />
        <details>
          <summary className="cursor-pointer text-sm text-brand-dark">By objective</summary>
          <div className="mt-2">
            <ScoreTable rows={score.objectives} heading="Objective" />
          </div>
        </details>
      </section>
      <div className="flex gap-3">
        <button onClick={() => setShowReview((v) => !v)} className="rounded border px-4 py-2">
          {showReview ? 'Hide answers' : 'Review answers'}
        </button>
        <button onClick={onRestart} className="rounded bg-brand px-4 py-2 text-chalk">
          Start a new mock exam
        </button>
      </div>
      {showReview &&
        exam.items.map((item, n) => (
          <section key={item.id} className="border-t border-slate-200 pt-6">
            <p className="mb-2 text-sm text-slate-500">Question {n + 1}</p>
            <ItemView item={item} response={answers[item.id]!} onChange={() => {}} revealed />
          </section>
        ))}
    </div>
  )
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
