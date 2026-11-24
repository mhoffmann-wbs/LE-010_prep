import { Link } from 'react-router'
import { EXAM_FORMAT, SOURCES } from '../content/blueprint'

const PILLARS = [
  { title: 'Learn', text: 'One plain-language lesson per exam objective, built around a small indie game studio that runs on Linux.' },
  { title: 'Check', text: 'Practice questions in the exam’s formats with full explanations, and a timed 40-question mock exam.' },
  { title: 'Do', text: 'A real Linux terminal in your browser, auto-graded exercises, simulators, drills and flashcards.' },
]

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">LPI Linux Essentials ({SOURCES.examCode})</h1>
        <p className="text-lg text-slate-700">
          A free self-study course for the exam: {EXAM_FORMAT.items} questions in {EXAM_FORMAT.minutes} minutes, scored{' '}
          {EXAM_FORMAT.scaleMin}–{EXAM_FORMAT.scaleMax}, {EXAM_FORMAT.passScore} to pass. No Linux install needed.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-brand-dark">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.text}</p>
          </div>
        ))}
      </section>
      <section className="space-y-2 text-sm text-slate-600">
        <p>
          Lessons and questions are being written. Meanwhile, try the{' '}
          <Link to="/terminal" className="underline">
            Linux terminal
          </Link>
          .
        </p>
        <p>
          Based on the official{' '}
          <a href={SOURCES.objectivesUrl} className="underline">
            exam objectives v{SOURCES.objectivesVersion}
          </a>
          . The free{' '}
          <a href={SOURCES.learningMaterialsUrl} className="underline">
            LPI Learning Materials
          </a>{' '}
          are a good companion.
        </p>
      </section>
    </div>
  )
}
