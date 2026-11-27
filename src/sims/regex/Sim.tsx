import { useMemo, useState } from 'react'
import { Inline } from '../../components/Inline'
import { Panel, Stat } from '../ui'
import { MAX_PATTERN, type RegexParams, grepCommand, run } from './model'

export default function RegexSim({ params }: { params: RegexParams }) {
  const [pattern, setPattern] = useState(params.presets[0]!.pattern)
  const preset = params.presets.find((p) => p.pattern === pattern)
  const result = useMemo(() => run(pattern, params.log), [pattern, params.log])
  const printed = 'lines' in result ? result.lines.filter((l) => l.matched) : []

  return (
    <div className="space-y-6">
      <Panel title="Your pattern">
        <div className="space-y-3">
          <div>
            <label htmlFor="regex-pattern" className="text-sm font-medium">
              Extended regular expression
            </label>
            <input
              id="regex-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              maxLength={MAX_PATTERN + 10}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={'error' in result}
              aria-describedby="regex-status"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono"
            />
          </div>
          <p className="break-all rounded bg-code px-3 py-2 font-mono text-sm text-chalk">
            <span aria-hidden="true">$ </span>
            {grepCommand(pattern, params.file)}
          </p>
          <div id="regex-status" role="status" className="text-sm">
            {'error' in result ? (
              <p className="text-red-600">{result.error}</p>
            ) : (
              <p>
                <strong>
                  {printed.length} of {params.log.length} lines
                </strong>{' '}
                would be printed. The highlighted text is what the pattern matched.
              </p>
            )}
          </div>
          <div role="group" aria-label="Presets" className="flex flex-wrap gap-2">
            {params.presets.map((p) => (
              <button
                key={p.pattern}
                type="button"
                aria-pressed={p.pattern === pattern}
                onClick={() => setPattern(p.pattern)}
                className={`rounded border px-3 py-1 font-mono text-sm ${p.pattern === pattern ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
              >
                {p.pattern}
              </button>
            ))}
          </div>
          {preset && (
            <p className="text-sm">
              <strong>{preset.title}.</strong> <Inline text={preset.explain} />
            </p>
          )}
        </div>
      </Panel>

      <Panel title={`The file ${params.file}`}>
        <ol className="space-y-1 text-sm" aria-label={`Lines of ${params.file}`}>
          {'lines' in result
            ? result.lines.map((l) => (
                <li
                  key={l.n}
                  className={`grid grid-cols-[2rem_1fr] gap-2 border-l-4 py-0.5 pl-2 ${l.matched ? 'border-brand' : 'border-transparent text-slate-500'}`}
                >
                  <span className="text-right font-mono text-xs text-slate-500" aria-hidden="true">
                    {l.n}
                  </span>
                  <span className="whitespace-pre-wrap break-all font-mono">
                    <span className="sr-only">{l.matched ? 'Printed: ' : 'Not printed: '}</span>
                    {l.segments.map((s, k) =>
                      s.hit ? (
                        <mark key={k} className="rounded bg-accent px-0.5 text-black">
                          {s.text}
                        </mark>
                      ) : (
                        <span key={k}>{s.text}</span>
                      ),
                    )}
                  </span>
                </li>
              ))
            : params.log.map((text, k) => (
                <li key={k} className="grid grid-cols-[2rem_1fr] gap-2 py-0.5 pl-3 text-slate-500">
                  <span className="text-right font-mono text-xs" aria-hidden="true">
                    {k + 1}
                  </span>
                  <span className="whitespace-pre-wrap break-all font-mono">{text}</span>
                </li>
              ))}
        </ol>
        <p className="mt-2 text-xs text-slate-500">A green bar marks a line grep would print. Grey lines have no match.</p>
      </Panel>

      <Panel title="What grep prints">
        {'lines' in result ? (
          <>
            <pre className="overflow-x-auto rounded bg-code p-3 font-mono text-sm text-chalk" aria-label="grep output">
              {printed.length ? printed.map((l) => l.text).join('\n') : '(nothing: no line matches)'}
            </pre>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Lines printed" value={String(printed.length)} note="what grep -c would print" />
              <Stat label="Lines skipped" value={String(params.log.length - printed.length)} note="what grep -vE would print" />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Fix the pattern to see the output.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          This simulator accepts only the pattern syntax that behaves the same in grep -E and in a browser. Escapes such as <code className="font-mono">\d</code>, classes such as{' '}
          <code className="font-mono">[:alpha:]</code> and repeats like <code className="font-mono">{'{2,3}'}</code> are refused with an explanation.
        </p>
      </Panel>
    </div>
  )
}
