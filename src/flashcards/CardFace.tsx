import { Inline } from '../components/Inline'
import type { StudyCard } from './decks'

/** Text with `backtick` code spans; blank lines separate paragraphs. */
export function CardText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            <Inline text={p.trim()} />
          </p>
        ))}
    </>
  )
}

/** The question side, plus the answer once `revealed`. */
export function CardFace({ card, revealed }: { card: StudyCard; revealed: boolean }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-lg">
        <CardText text={card.front} />
      </div>
      {revealed && (
        <section aria-label="Answer" className="space-y-2 border-t border-slate-200 pt-4">
          <CardText text={card.back} />
        </section>
      )}
    </div>
  )
}
