import { Link } from 'react-router'

// One entry per Explore tool, added as each gets built (PLAN.md §6).
const TOOLS = [
  {
    to: '/explore/drills',
    title: 'Drills',
    text: 'Quick rounds that match TuxPixel tasks to commands and files, and sorters for licences, distribution families, builtins, paths and devices.',
  },
  {
    to: '/explore/flashcards',
    title: 'Flashcards',
    text: 'Spaced review of commands, files and terms, one deck per exam topic, plus decks of your own that you can share.',
  },
]

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Explore</h1>
      <p className="text-slate-600">
        Tools that make the facts stick between lessons and practice: quick drills and spaced-review flashcards. For hands-on work, use the{' '}
        <Link to="/exercises" className="text-brand-dark underline">
          exercises
        </Link>{' '}
        and the{' '}
        <Link to="/terminal" className="text-brand-dark underline">
          terminal
        </Link>
        .
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.to} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">
              <Link to={t.to} className="text-brand-dark underline-offset-2 hover:underline">
                {t.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
