import { type ReactNode, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { OutputItemsToggle } from '../components/OutputItemsToggle'
import { MOCK, OBJECTIVES, OBJECTIVE_BY_ID, TOPICS, TOPIC_BY_ID, objectivesOf } from '../content/blueprint'
import { ITEMS } from '../content/bank'
import type { Item } from '../content/schema'
import { weakAreaItems } from '../progress/readiness'
import { getProgress, recordAnswer, useProgress } from '../progress/store'
import { type Response, emptyResponse, grade, isAnswered } from '../quiz/grade'
import { ItemView } from '../quiz/ItemView'
import { objectiveWeights, practicePool } from '../quiz/pools'
import { shuffle } from '../quiz/random'
import { buildFocusSet, buildMixedSet, orderLeastMastered } from '../quiz/sampler'
import { ScoreTable } from '../quiz/ScoreTable'
import { SessionReview } from '../quiz/SessionReview'
import { ShortcutHint } from '../quiz/ShortcutHint'
import { useShortcuts } from '../quiz/shortcuts'

/** Sizes offered for a mixed set; the last one matches the real exam length. */
const MIX_SIZES = [10, 20, MOCK.items]

const MODES = [
  { focus: false, label: 'Any question', hint: 'Random order. Mixed sets are weighted by the exam objectives.' },
  {
    focus: true,
    label: 'Least mastered',
    hint: 'Within each objective, questions with the shortest run of correct answers come first (a wrong answer resets the run). Mixed sets keep the objectives’ weights.',
  },
]

export default function PracticePage() {
  const [params] = useSearchParams()
  const objectiveId = params.get('objective')
  const topicId = params.get('topic')
  const mix = Number(params.get('mix'))
  const focus = params.get('focus') === '1'
  // Progress is read once per selection (sessions keep their first order), so
  // answering during a session doesn't reshuffle it.
  const progress = getProgress()
  const pool = practicePool(ITEMS, progress.outputInPractice)
  const weights = objectiveWeights()
  const streakOf = (id: string) => progress.items[id]?.streak ?? 0
  const suffix = focus ? ': least mastered' : ''
  // Bumping the round re-samples the same kind of set and remounts the session.
  const [round, setRound] = useState(0)
  const again = () => setRound((r) => r + 1)

  if (params.get('weak')) {
    const items = shuffle(weakAreaItems(OBJECTIVES, pool, progress, weights))
    return <PracticeSession key={`weak|${round}`} items={items} label="Weak-spot drill" onAgain={again} />
  }
  if (mix > 0) {
    const items = focus ? buildFocusSet(pool, weights, mix, streakOf) : buildMixedSet(pool, weights, mix)
    return <PracticeSession key={`mix|${mix}|${focus}|${round}`} items={items} label={`Mixed set${suffix}`} onAgain={again} />
  }
  if (!objectiveId && !topicId) return <PracticePicker />

  const items = pool.filter((i) => (objectiveId ? i.objectiveId === objectiveId : i.objectiveId.startsWith(`${topicId}.`)))
  const label = objectiveId
    ? `${objectiveId} ${OBJECTIVE_BY_ID.get(objectiveId)?.title ?? ''}`
    : `Topic ${topicId}: ${TOPIC_BY_ID.get(topicId!)?.title ?? ''}`
  // Keying on the selection resets the session when the learner picks something else.
  return (
    <PracticeSession
      key={`${objectiveId}|${topicId}|${focus}|${round}`}
      items={focus ? orderLeastMastered(items, streakOf) : shuffle(items)}
      label={`${label}${suffix}`}
      onAgain={again}
    />
  )
}

function PracticePicker() {
  const progress = useProgress()
  const pool = practicePool(ITEMS, progress.outputInPractice)
  const [focus, setFocus] = useState(false)
  const count = (prefix: string) => pool.filter((i) => `${i.objectiveId}.`.startsWith(`${prefix}.`)).length
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Practice</h1>
      <p className="text-slate-600">
        Pick a topic or a single objective, or run a mixed set across the whole exam. You get feedback right after each question, with an
        explanation for every option. To pick single questions by topic and mastery, open the{' '}
        <Link to="/questions" className="text-brand-dark underline">
          question bank
        </Link>
        .
      </p>
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Question selection">
          {MODES.map((mode) => (
            <button
              key={mode.label}
              type="button"
              aria-pressed={focus === mode.focus}
              onClick={() => setFocus(mode.focus)}
              className={`rounded px-3 py-1 text-sm ${focus === mode.focus ? 'bg-brand text-chalk' : 'border border-slate-300 text-slate-700'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{MODES.find((m) => m.focus === focus)!.hint}</p>
      </div>
      <OutputItemsToggle part="practice" />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Mixed set</h2>
        <p className="mt-1 text-sm text-slate-600">
          Questions from every topic, drawn by objective weight like the mock exam, but untimed and with the answer revealed after each one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MIX_SIZES.map((n) => (
            <Link key={n} to={withMode(`?mix=${n}`, focus)} className="rounded border border-brand px-3 py-1 text-sm text-brand-dark hover:bg-brand/10">
              {n} questions
            </Link>
          ))}
        </div>
      </section>
      {TOPICS.map((t) => (
        <section key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">
            <PracticeLink to={withMode(`?topic=${t.id}`, focus)} count={count(t.id)}>
              Topic {t.id}: {t.title}
            </PracticeLink>
          </h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {objectivesOf(t.id).map((o) => (
              <li key={o.id} className="text-sm">
                <PracticeLink to={withMode(`?objective=${o.id}`, focus)} count={count(o.id)}>
                  {o.id} {o.title}
                </PracticeLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function withMode(search: string, focus: boolean) {
  return focus ? `${search}&focus=1` : search
}

function PracticeLink({ to, count, children }: { to: string; count: number; children: ReactNode }) {
  if (count === 0) {
    return (
      <span className="text-slate-400">
        {children} <span className="text-xs">(no questions yet)</span>
      </span>
    )
  }
  return (
    <Link to={to} className="text-brand-dark underline-offset-2 hover:underline">
      {children} <span className="text-xs text-slate-500">({count})</span>
    </Link>
  )
}

/** Runs `items` in the order given; callers decide how they are sampled and ordered. */
function PracticeSession({ items: initial, label, onAgain }: { items: Item[]; label: string; onAgain: () => void }) {
  const [items] = useState(initial)
  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState<Response | null>(() => (initial[0] ? emptyResponse(initial[0]) : null))
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<Record<string, Response>>({})
  const item = items[index]

  // Enter checks the answer, then moves on. Declared before the early returns below.
  useShortcuts({
    Enter: () => {
      if (!item || !response) return
      if (revealed) next()
      else if (isAnswered(item, response)) check()
    },
  })

  if (items.length === 0) {
    return (
      <p>
        No questions for this selection yet.{' '}
        <Link to="/practice" className="underline">
          Back to practice
        </Link>
      </p>
    )
  }

  const answered = items.filter((i) => i.id in answers)
  const right = answered.filter((i) => grade(i, answers[i.id]!)).length

  if (!item || !response) {
    const objectiveIds = [...new Set(answered.map((i) => i.objectiveId))].sort()
    const rows = objectiveIds.map((id) => {
      const xs = answered.filter((i) => i.objectiveId === id)
      return { id, label: OBJECTIVE_BY_ID.get(id)!.title, correct: xs.filter((i) => grade(i, answers[i.id]!)).length, total: xs.length }
    })
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Session complete: {label}</h1>
        <p>
          {right} / {answered.length} correct.
        </p>
        {/* A single-objective session would just repeat the total. */}
        {rows.length > 1 && <ScoreTable rows={rows} heading="Objective" />}
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={onAgain} className="rounded bg-brand px-4 py-2 font-medium text-chalk">
            Practise again
          </button>
          <Link to="/practice" className="underline">
            Back to practice
          </Link>
        </div>
        <SessionReview items={items} answers={answers} />
      </div>
    )
  }

  function check() {
    if (!isAnswered(item!, response!)) return
    recordAnswer(item!.id, grade(item!, response!))
    setAnswers((a) => ({ ...a, [item!.id]: response! }))
    setRevealed(true)
  }

  function next() {
    const following = items[index + 1]
    setIndex((i) => i + 1)
    setResponse(following ? emptyResponse(following) : null)
    setRevealed(false)
  }

  const correct = revealed && grade(item, response)
  return (
    <div className="space-y-6">
      <h1 className="sr-only">Practice: {label}</h1>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-slate-600">
        <span>{label}</span>
        <span>
          Question {index + 1} of {items.length} · {right}/{answered.length} correct
        </span>
      </div>
      <ItemView key={item.id} item={item} response={response} onChange={setResponse} revealed={revealed} keyboard onEnter={check} />
      {revealed && (
        <p role="status" className={`text-lg font-semibold ${correct ? 'text-green-600' : 'text-red-600'}`}>
          {correct ? '✓ Correct' : '✗ Not quite'}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <ShortcutHint items={[['1–6', 'or A–F select'], ['Enter', revealed ? 'next' : 'check']]} />
        {revealed ? (
          <button onClick={next} className="rounded bg-brand px-4 py-2 font-medium text-chalk">
            {index + 1 === items.length ? 'Finish' : 'Next question'}
          </button>
        ) : (
          <button
            onClick={check}
            disabled={!isAnswered(item, response)}
            className="rounded bg-brand px-4 py-2 font-medium text-chalk disabled:opacity-40"
          >
            Check answer
          </button>
        )}
      </div>
    </div>
  )
}
