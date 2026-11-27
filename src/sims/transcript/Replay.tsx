import { useState } from 'react'
import { Inline } from '../../components/Inline'
import { TRANSCRIPT_BY_ID } from '../../content/transcripts'
import type { Transcript, TranscriptStep } from '../../content/transcript'
import { Panel } from '../ui'
import { type Question, type ReplayParams, type Scene, choices, promptOf, splitAt } from './model'

/** The transcript simulators: scenes that replay captured commands one at a time, then questions answered from that output. */
export default function Replay({ params }: { params: ReplayParams }) {
  const transcript = TRANSCRIPT_BY_ID.get(params.transcript)
  const [sceneIndex, setSceneIndex] = useState(0)
  if (!transcript) return <p className="text-red-600">No transcript called “{params.transcript}”.</p>
  const scene = params.scenes[sceneIndex]!
  return (
    <div className="space-y-6">
      <nav aria-label="Scenes" className="flex flex-wrap gap-2">
        {params.scenes.map((s, n) => (
          <button
            key={s.title}
            type="button"
            aria-current={n === sceneIndex ? 'step' : undefined}
            onClick={() => setSceneIndex(n)}
            className={`rounded border px-3 py-1 text-sm ${n === sceneIndex ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
          >
            {n + 1}. {s.title}
          </button>
        ))}
      </nav>
      {/* Keyed so each scene starts with nothing replayed and nothing answered. */}
      <SceneView key={sceneIndex} scene={scene} transcript={transcript} />
      {sceneIndex < params.scenes.length - 1 && (
        <button type="button" onClick={() => setSceneIndex(sceneIndex + 1)} className="rounded border px-4 py-2">
          Next scene: {params.scenes[sceneIndex + 1]!.title} →
        </button>
      )}
      <Provenance transcript={transcript} />
    </div>
  )
}

function SceneView({ scene, transcript }: { scene: Scene; transcript: Transcript }) {
  const steps = scene.steps.map((key) => transcript.steps.find((s) => s.key === key)).filter((s): s is TranscriptStep => s !== undefined)
  const [shown, setShown] = useState(1)
  const [highlight, setHighlight] = useState<Question['evidence'] | null>(null)
  const next = steps[shown]
  const done = shown >= steps.length
  return (
    <section className="space-y-4" aria-labelledby="scene-title">
      <h2 id="scene-title" className="text-xl font-semibold">
        {scene.title}
      </h2>
      <p>
        <Inline text={scene.text} />
      </p>
      <ol className="space-y-3">
        {steps.slice(0, shown).map((step) => (
          <li key={step.key}>
            <StepView step={step} highlight={highlight?.step === step.key ? highlight.text : undefined} />
            {scene.notes?.[step.key] && (
              <p className="mt-1 text-sm text-slate-600">
                <Inline text={scene.notes[step.key]!} />
              </p>
            )}
          </li>
        ))}
      </ol>
      {!done && next && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShown(shown + 1)} className="rounded bg-brand px-4 py-2 font-medium text-chalk">
            Run <code className="font-mono">{next.command.split('\n')[0]}</code>
          </button>
          <button type="button" onClick={() => setShown(steps.length)} className="rounded border px-4 py-2">
            Show all
          </button>
        </div>
      )}
      {done && scene.questions.length > 0 && (
        <Panel title="Read the output">
          <ol className="space-y-5">
            {scene.questions.map((q) => (
              <li key={q.prompt}>
                <QuestionView question={q} onAnswered={() => setHighlight(q.evidence)} />
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </section>
  )
}

function StepView({ step, highlight }: { step: TranscriptStep; highlight?: string }) {
  const parts = highlight ? splitAt(step.output, highlight) : null
  return (
    <pre className="overflow-x-auto rounded-lg bg-code p-3 font-mono text-sm text-[#e6edf3]">
      <span className="select-none text-[#8fd9ad]">{promptOf(step)}</span>
      {step.command}
      {step.output && '\n'}
      {parts ? (
        <>
          {parts[0]}
          <mark className="rounded bg-accent px-0.5 text-slate-900">{parts[1]}</mark>
          {parts[2]}
        </>
      ) : (
        step.output
      )}
      {step.exit !== 0 && <span className="mt-1 block select-none text-xs text-[#9aa4b2]">(exit status {step.exit})</span>}
    </pre>
  )
}

function QuestionView({ question, onAnswered }: { question: Question; onAnswered: () => void }) {
  const [pick, setPick] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <p className="font-medium">
        <Inline text={question.prompt} />
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={question.prompt}>
        {choices(question).map((c) => {
          const tone =
            pick === null ? 'border-slate-300' : c === question.answer ? 'border-green-600 bg-green-50' : c === pick ? 'border-red-600 bg-red-50' : 'border-slate-200 text-slate-400'
          return (
            <button
              key={c}
              type="button"
              disabled={pick !== null}
              aria-pressed={pick === c}
              onClick={() => {
                setPick(c)
                onAnswered()
              }}
              className={`rounded border px-3 py-1 text-left text-sm ${tone}`}
            >
              <Inline text={c} />
            </button>
          )
        })}
      </div>
      {pick !== null && (
        <p role="status" className="text-sm">
          <strong className={pick === question.answer ? 'text-green-600' : 'text-red-600'}>{pick === question.answer ? '✓ Right.' : '✗ Not quite.'}</strong>{' '}
          <Inline text={question.why} /> The highlighted text in the output shows it.
        </p>
      )}
    </div>
  )
}

function Provenance({ transcript }: { transcript: Transcript }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Where this output comes from</summary>
      <div className="mt-2 space-y-2 text-slate-700">
        <p>
          Every command here really ran, and its output is exactly what it printed, captured on {transcript.captured} by the app’s capture
          script. Times, fingerprints and process ids are from that run.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {transcript.hosts.map((h) => (
            <li key={h.name}>
              <code className="font-mono">{h.name}</code>: {h.distro}
            </li>
          ))}
          {transcript.environment.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {transcript.setup.length > 0 && (
          <>
            <p>Before the first command, the capture prepared the hosts with:</p>
            {transcript.setup.map((s, n) => (
              <pre key={n} className="overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs">
                {promptOf({ ...s, cwd: '~' })}
                {s.command}
              </pre>
            ))}
          </>
        )}
      </div>
    </details>
  )
}
