import { Link } from 'react-router'
import { ExamSettings } from '../components/ExamSettings'
import { EXAM_FORMAT, EXAM_PROFILES, MOCK, SOURCES, TOPICS, objectiveLabel, objectivesOf, topicLabel, topicWeight } from '../content/blueprint'
import { useProgress } from '../progress/store'

const PILLARS = [
  { to: '/learn', title: 'Learn', text: 'One plain-language lesson per exam objective, built around a small indie game studio that runs on Linux.' },
  { to: '/practice', title: 'Check', text: 'Practice questions in the exam’s formats with full explanations, and a timed 40-question mock exam.' },
  { to: '/terminal', title: 'Do', text: 'A real Linux terminal in your browser, auto-graded exercises, simulators, drills and flashcards.' },
]

export default function HomePage() {
  const { track } = useProgress()
  const profile = EXAM_PROFILES[track]
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">LPI Linux Essentials ({track})</h1>
        <p className="text-lg text-slate-700">
          A free self-study course for the exam: {EXAM_FORMAT.items} questions in {EXAM_FORMAT.minutes} minutes, scored{' '}
          {EXAM_FORMAT.scaleMin}–{EXAM_FORMAT.scaleMax}, {EXAM_FORMAT.passScore} to pass. No Linux install needed: a real{' '}
          <Link to="/terminal" className="underline">
            Linux terminal
          </Link>{' '}
          runs in your browser.
        </p>
        <ExamSettings />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <Link key={p.to} to={p.to} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand">
            <h2 className="text-lg font-semibold text-brand-dark">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.text}</p>
          </Link>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The exam objectives</h2>
        <p className="text-sm text-slate-600">
          Each weight point is one question on the exam, and in this app’s {MOCK.items}-question mock exam.{' '}
          <a href={profile.objectivesUrl} className="underline">
            Official objectives v{profile.version}
          </a>
          . The free{' '}
          <a href={SOURCES.learningMaterialsUrl} className="underline">
            LPI Learning Materials
          </a>{' '}
          are a good companion.
        </p>
        {TOPICS.map((t) => (
          <details key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="flex cursor-pointer justify-between gap-4 font-semibold">
              <span>
                Topic {topicLabel(t, track).id}: {topicLabel(t, track).title}
              </span>
              <span className="shrink-0 font-normal text-slate-500">{topicWeight(t.id)} questions</span>
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {objectivesOf(t.id).map((o) => (
                <li key={o.id} className="flex justify-between gap-4">
                  <Link to={`/learn/${o.id}`} className="text-brand-dark hover:underline">
                    <span className="font-medium">{objectiveLabel(o, track).id}</span> {objectiveLabel(o, track).title}
                  </Link>
                  <span className="shrink-0 text-slate-500">weight {o.weight}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  )
}
