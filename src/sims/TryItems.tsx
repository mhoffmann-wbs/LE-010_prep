import { useState } from 'react'
import { ITEMS } from '../content/bank'
import { itemInExam } from '../content/blueprint'
import type { Item } from '../content/schema'
import { recordAnswer, useProgress } from '../progress/store'
import { emptyResponse, grade, isAnswered } from '../quiz/grade'
import { ItemView } from '../quiz/ItemView'

/** "Now you try": the simulator's bank items on the learner's exam, each checked and recorded like a practice answer. */
export function TryItems({ itemIds }: { itemIds: readonly string[] }) {
  const { track } = useProgress()
  const items = itemIds.map((id) => ITEMS.find((i) => i.id === id)).filter((i): i is Item => i !== undefined && itemInExam(i, track))
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Now you try</h2>
      <ol className="space-y-8">
        {items.map((item, n) => (
          <li key={item.id} aria-label={`Question ${n + 1} of ${items.length}`} className="rounded-lg border border-slate-200 bg-white p-4">
            <TryItem item={item} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function TryItem({ item }: { item: Item }) {
  const [response, setResponse] = useState(() => emptyResponse(item))
  const [revealed, setRevealed] = useState(false)
  const correct = revealed && grade(item, response)

  function check() {
    recordAnswer(item.id, grade(item, response))
    setRevealed(true)
  }

  return (
    <div className="space-y-4">
      <ItemView item={item} response={response} onChange={setResponse} revealed={revealed} onEnter={() => !revealed && isAnswered(item, response) && check()} />
      {revealed ? (
        <p role="status" className={`font-semibold ${correct ? 'text-green-600' : 'text-red-600'}`}>
          {correct ? '✓ Correct' : '✗ Not quite'}
        </p>
      ) : (
        <button onClick={check} disabled={!isAnswered(item, response)} className="rounded bg-brand px-4 py-2 font-medium text-chalk disabled:opacity-40">
          Check answer
        </button>
      )}
    </div>
  )
}
