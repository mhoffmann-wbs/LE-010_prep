import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Inline } from '../components/Inline'
import { OBJECTIVE_BY_ID, objectiveLabel } from '../content/blueprint'
import { DRILL_DECKS, DRILL_DECK_BY_ID, cardIds } from '../content/drills'
import type { DrillDeck } from '../content/schema'
import { type DrillQuestion, ROUND_SIZE, buildRound } from '../drills/round'
import { getProgress, recordDrillRound, useProgress } from '../progress/store'
import { ShortcutHint } from '../quiz/ShortcutHint'
import { useShortcuts } from '../quiz/shortcuts'

export default function DrillsPage() {
  const { deckId } = useParams()
  const [params] = useSearchParams()
  const deck = deckId ? DRILL_DECK_BY_ID.get(deckId) : undefined
  // Bumping the round re-samples the deck and remounts the runner.
  const [round, setRound] = useState(0)
  if (!deckId) return <DeckList />
  if (!deck) return <h1 className="text-2xl font-semibold">No drill called “{deckId}”</h1>
  const misses = params.get('misses') === '1'
  return <DrillRunner key={`${deck.id}|${misses}|${round}`} deck={deck} misses={misses} onAgain={() => setRound((r) => r + 1)} />
}

function missesOf(deck: DrillDeck, missed: readonly string[]): string[] {
  const ids = new Set(cardIds(deck))
  return missed.filter((id) => ids.has(id))
}

function DeckList() {
  const progress = useProgress()
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Drills</h1>
      <p className="text-slate-600">
        Fast rounds of {ROUND_SIZE} cards. <strong>Which command?</strong> and <strong>Which file?</strong> decks give a TuxPixel task and four
        answers to pick from; <strong>sorters</strong> put each item in the right group. Cards you miss are kept, so you can replay just those.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {DRILL_DECKS.map((deck) => {
          const stat = progress.drills[deck.id]
          const misses = missesOf(deck, progress.drillMisses).length
          const size = cardIds(deck).length
          return (
            <li key={deck.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {deck.kind === 'which' ? 'Pick one' : 'Sorter'} · {size} cards · {deck.objectives.map((o) => objectiveLabel(OBJECTIVE_BY_ID.get(o)!, progress.track).id).join(', ')}
              </p>
              <h2 className="mt-1 font-semibold">{deck.title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-600">{deck.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {stat ? `Best ${stat.best}% · longest run ${stat.bestStreak} · ${stat.rounds} ${stat.rounds === 1 ? 'round' : 'rounds'}` : 'Not played yet'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/explore/drills/${deck.id}`} className="rounded bg-brand px-3 py-1 text-sm font-medium text-chalk">
                  Play a round<span className="sr-only">: {deck.title}</span>
                </Link>
                {misses > 0 && (
                  <Link to={`/explore/drills/${deck.id}?misses=1`} className="rounded border border-brand px-3 py-1 text-sm text-brand-dark">
                    Replay {misses} missed<span className="sr-only">: {deck.title}</span>
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function useElapsed(running: boolean) {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  return now - start
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A choice as shown: a which-deck's answer text (with `code` spans), or a sorter's bucket label. */
function ChoiceLabel({ deck, id }: { deck: DrillDeck; id: string }) {
  return deck.kind === 'which' ? <Inline text={id} /> : <>{deck.buckets.find((b) => b.id === id)?.label ?? id}</>
}

function DrillRunner({ deck, misses, onAgain }: { deck: DrillDeck; misses: boolean; onAgain: () => void }) {
  const [questions] = useState<DrillQuestion[]>(() =>
    buildRound(deck, misses ? { only: new Set(missesOf(deck, getProgress().drillMisses)) } : {}),
  )
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const elapsed = useElapsed(!done)
  const q = questions[index]
  const picked = picks[index]

  useShortcuts(
    {
      ...Object.fromEntries((q?.choices ?? []).map((id, i) => [String(i + 1), () => picked === undefined && pick(id)])),
      Enter: () => picked !== undefined && next(),
    },
    !done,
  )

  if (questions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{deck.title}</h1>
        <p>
          No missed cards left in this deck.{' '}
          <Link to="/explore/drills" className="underline">
            Back to the drills
          </Link>
        </p>
      </div>
    )
  }

  function pick(id: string) {
    setPicks((p) => [...p, id])
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1)
      return
    }
    const right = questions.filter((x, i) => picks[i] === x.answer)
    let streak = 0
    let run = 0
    questions.forEach((x, i) => {
      run = picks[i] === x.answer ? run + 1 : 0
      streak = Math.max(streak, run)
    })
    recordDrillRound(deck.id, {
      correct: right.length,
      total: questions.length,
      streak,
      hit: right.map((x) => x.id),
      missed: questions.filter((x, i) => picks[i] !== x.answer).map((x) => x.id),
    })
    setDone(true)
  }

  const correctSoFar = questions.filter((x, i) => picks[i] === x.answer).length

  if (done) {
    const missed = questions.filter((x, i) => picks[i] !== x.answer)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Round complete: {deck.title}</h1>
        <p>
          {correctSoFar} / {questions.length} correct in {clock(elapsed)}.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={onAgain} className="rounded bg-brand px-4 py-2 font-medium text-chalk">
            {misses ? 'Replay misses again' : 'Play another round'}
          </button>
          <Link to="/explore/drills" className="underline">
            Back to the drills
          </Link>
        </div>
        {missed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Missed cards</h2>
            {missed.map((x) => (
              <div key={x.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
                <p>
                  <Inline text={x.prompt} />
                </p>
                <p className="mt-1">
                  <span className="text-red-600">You picked <ChoiceLabel deck={deck} id={picks[questions.indexOf(x)]!} /></span> ·{' '}
                  <span className="text-green-700">Answer: <ChoiceLabel deck={deck} id={x.answer} /></span>
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
    )
  }

  const revealed = picked !== undefined
  const right = picked === q!.answer
  return (
    <div className="space-y-6">
      <h1 className="sr-only">{deck.title}</h1>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-slate-600">
        <span>
          {deck.title}
          {misses && ': missed cards'}
        </span>
        <span>
          Card {index + 1} of {questions.length} · {correctSoFar} correct ·{' '}
          <span aria-label="time elapsed">{clock(elapsed)}</span>
        </span>
      </div>
      <p className="text-lg">
        <Inline text={q!.prompt} />
      </p>
      <div className={`grid gap-2 ${deck.kind === 'which' ? 'sm:grid-cols-2' : 'sm:grid-flow-col sm:auto-cols-fr'}`} role="group" aria-label="Choices">
        {q!.choices.map((id, i) => {
          const isAnswer = revealed && id === q!.answer
          const isWrongPick = revealed && id === picked && !right
          return (
            <button
              key={id}
              type="button"
              disabled={revealed}
              onClick={() => pick(id)}
              className={`rounded border px-3 py-2 text-left ${
                isAnswer ? 'border-green-600 bg-green-600/10' : isWrongPick ? 'border-red-600 bg-red-600/10' : 'border-slate-300 bg-white'
              } ${revealed ? '' : 'hover:border-brand'}`}
            >
              <span className="mr-2 font-mono text-xs text-slate-500">{i + 1}</span>
              <ChoiceLabel deck={deck} id={id} />
            </button>
          )
        })}
      </div>
      {revealed && (
        <div className="space-y-2">
          <p role="status" className={`text-lg font-semibold ${right ? 'text-green-600' : 'text-red-600'}`}>
            {right ? (
              '✓ Correct'
            ) : (
              <>
                ✗ It’s <ChoiceLabel deck={deck} id={q!.answer} />
              </>
            )}
          </p>
          {q!.why && (
            <p className="text-slate-700">
              <Inline text={q!.why} />
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <ShortcutHint items={[[`1–${q!.choices.length}`, 'pick'], ['Enter', 'next']]} />
        {revealed && (
          <button onClick={next} className="rounded bg-brand px-4 py-2 font-medium text-chalk">
            {index + 1 === questions.length ? 'Finish' : 'Next card'}
          </button>
        )}
      </div>
    </div>
  )
}
