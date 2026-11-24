import { setToggle, useProgress } from '../progress/store'

const COPY = {
  practice: {
    key: 'outputInPractice',
    label: 'Include “predict the output” questions in practice',
  },
  mock: {
    key: 'outputInMock',
    label: 'Include “predict the output” questions in the mock exam',
  },
} as const

/**
 * The learner's choice to see "predict the output" items. They train reading
 * commands, but the exam has no such format, so the mock leaves them out by default.
 */
export function OutputItemsToggle({ part }: { part: keyof typeof COPY }) {
  const progress = useProgress()
  const { key, label } = COPY[part]
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={progress[key]} onChange={(e) => setToggle(key, e.target.checked)} className="mt-1 accent-brand" />
      <span>
        {label}
        <span className="block text-xs text-slate-500">
          These show a command and ask what it prints, checked against a real Linux system. The exam doesn’t use this format, but reading
          commands this way is how its multiple-choice and short-input questions are solved.
        </span>
      </span>
    </label>
  )
}
