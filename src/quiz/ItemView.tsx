import { OBJECTIVE_BY_ID } from '../content/blueprint'
import { COUNT_WORDS, type Item } from '../content/schema'
import { Inline } from '../components/Inline'
import { VM_PROMPT } from '../vm/config'
import { type Response, grade } from './grade'
import { type ShortcutMap, useShortcuts } from './shortcuts'

const LETTERS = 'ABCDEF'

export const KIND_LABELS: Record<Item['kind'], string> = {
  single: 'Multiple choice',
  multi: 'Multiple response',
  fill: 'Short input',
  output: 'Predict the output',
}

interface Props {
  item: Item
  response: Response
  onChange: (response: Response) => void
  /** When true, inputs lock and the key, every rationale and the explanation are shown. */
  revealed?: boolean
  /** Select options with 1–6 or A–F. Only one ItemView on screen should enable this. */
  keyboard?: boolean
  /** Enter in a text answer (fill, typed output) calls this, e.g. to check the answer. */
  onEnter?: () => void
}

type Of<K extends Item['kind']> = Extract<Item, { kind: K }>

export function ItemView({ item, response, onChange, revealed = false, keyboard = false, onEnter }: Props) {
  const objective = OBJECTIVE_BY_ID.get(item.objectiveId)!
  return (
    <article className="space-y-4" data-item-id={item.id}>
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {objective.id} · {objective.title} · <span className="normal-case">{KIND_LABELS[item.kind]}</span>
      </p>
      <p className="whitespace-pre-line text-lg leading-relaxed">
        <Inline text={item.stem} />
      </p>
      {item.kind === 'output' && <Command command={item.command} />}
      {item.kind === 'fill' ? (
        <FillAnswer item={item} response={response} onChange={onChange} revealed={revealed} onEnter={onEnter} />
      ) : item.kind === 'output' && item.mode === 'type' ? (
        <TypedOutput item={item} response={response} onChange={onChange} revealed={revealed} />
      ) : (
        <Options item={item} response={response} onChange={onChange} revealed={revealed} keyboard={keyboard} />
      )}
      {revealed && <Explanation text={item.explanation} />}
    </article>
  )
}

/** The command as it would appear in mira's terminal. */
function Command({ command }: { command: string }) {
  return (
    <pre className="rounded-lg bg-code p-3 font-mono text-sm text-[#e6edf3]">
      <span className="text-[#8fd9ad]">{VM_PROMPT}</span>
      {command}
    </pre>
  )
}

function Explanation({ text }: { text: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">Explanation</h3>
      <p className="mt-1 whitespace-pre-line">
        <Inline text={text} />
      </p>
    </section>
  )
}

/** A right/wrong mark that doesn't rely on colour alone. */
function Verdict({ right }: { right: boolean }) {
  return (
    <span className={`mr-1 font-semibold ${right ? 'text-green-700' : 'text-red-700'}`}>
      <span aria-hidden="true">{right ? '✓' : '✗'}</span>
      <span className="sr-only">{right ? 'Right: ' : 'Wrong: '}</span>
    </span>
  )
}

function Options({ item, response, onChange, revealed, keyboard }: { item: Of<'single'> | Of<'multi'> | Of<'output'> } & Omit<Props, 'item' | 'onEnter'>) {
  const options = item.options ?? []
  const multi = item.kind === 'multi'
  // Outputs are shown exactly as printed: monospace, with line breaks and leading spaces.
  const verbatim = item.kind === 'output'
  const selected = response.kind === 'multi' ? response.choices : 'choice' in response && response.choice !== null ? [response.choice] : []

  function toggle(i: number) {
    if (revealed) return
    if (item.kind === 'single') return onChange({ kind: 'single', choice: i })
    if (item.kind === 'output') return onChange({ kind: 'output', choice: i, text: '' })
    if (selected.includes(i)) return onChange({ kind: 'multi', choices: selected.filter((s) => s !== i) })
    // Like the real exam, don't allow more selections than the question asks for.
    if (selected.length < item.select) onChange({ kind: 'multi', choices: [...selected, i] })
  }

  const keys: ShortcutMap = {}
  options.forEach((_, i) => {
    keys[String(i + 1)] = () => toggle(i)
    keys[LETTERS[i]!.toLowerCase()] = () => toggle(i)
  })
  useShortcuts(keys, !!keyboard && !revealed)

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-slate-600">{multi ? `Choose ${COUNT_WORDS[item.select]}.` : 'Choose ONE.'}</legend>
      {options.map((option, i) => {
        const isSelected = selected.includes(i)
        const tone = !revealed
          ? isSelected
            ? 'border-brand bg-brand/5'
            : 'border-slate-200 bg-white hover:border-slate-400'
          : option.correct
            ? 'border-green-600 bg-green-50'
            : isSelected
              ? 'border-red-600 bg-red-50'
              : 'border-slate-200 bg-white opacity-80'
        return (
          <label key={i} className={`block cursor-pointer rounded-lg border-2 p-3 transition-colors ${tone}`}>
            <span className="flex gap-3">
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={item.id}
                checked={isSelected}
                disabled={revealed}
                onChange={() => toggle(i)}
                className="mt-1 accent-brand"
              />
              <span className="font-semibold">{LETTERS[i]}.</span>
              {verbatim ? (
                <pre className="min-w-0 overflow-x-auto font-mono text-sm">{option.text}</pre>
              ) : (
                <span>
                  <Inline text={option.text} />
                </span>
              )}
            </span>
            {revealed && (
              <span className="mt-2 block pl-7 text-sm text-slate-700">
                <span className="font-semibold">{option.correct ? '✓ ' : '✗ '}</span>
                <Inline text={option.rationale} />
              </span>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}

function FillAnswer({ item, response, onChange, revealed, onEnter }: { item: Of<'fill'> } & Omit<Props, 'item' | 'keyboard'>) {
  const text = response.kind === 'fill' ? response.text : ''
  const right = !!revealed && grade(item, response)
  return (
    <div className="space-y-2">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Your answer</span>
        <span className="flex min-w-0 flex-1 items-center gap-2 font-mono">
          {item.prefix && <span className="shrink-0">{item.prefix}</span>}
          <input
            type="text"
            value={text}
            disabled={revealed}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => onChange({ kind: 'fill', text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onEnter) {
                e.preventDefault()
                onEnter()
              }
            }}
            className={`w-full min-w-0 rounded border-2 bg-white px-2 py-1 ${!revealed ? 'border-slate-300' : right ? 'border-green-600' : 'border-red-600'}`}
          />
        </span>
      </label>
      {revealed && (
        <p className="text-sm">
          <Verdict right={right} />
          {item.accept.length > 1 ? 'Accepted answers: ' : 'Answer: '}
          {item.accept.map((a, i) => (
            <span key={a}>
              {i > 0 && ', '}
              <code className="rounded bg-slate-100 px-1 font-mono">{a}</code>
            </span>
          ))}
          {!item.caseSensitive && ' (any case)'}
        </p>
      )}
    </div>
  )
}

function TypedOutput({ item, response, onChange, revealed }: { item: Of<'output'> } & Omit<Props, 'item' | 'keyboard' | 'onEnter'>) {
  const text = response.kind === 'output' ? response.text : ''
  const right = !!revealed && grade(item, response)
  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-600">Type the output exactly, one line per line</span>
        <textarea
          value={text}
          disabled={revealed}
          rows={Math.max(2, item.output.split('\n').length + 1)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onChange({ kind: 'output', choice: null, text: e.target.value })}
          className={`w-full rounded border-2 bg-white p-2 font-mono text-sm ${!revealed ? 'border-slate-300' : right ? 'border-green-600' : 'border-red-600'}`}
        />
      </label>
      {revealed && (
        <div className="space-y-1 text-sm">
          <p>
            <Verdict right={right} />
            The command prints:
          </p>
          <pre className="rounded-lg bg-code p-3 font-mono text-[#e6edf3]">{item.output}</pre>
        </div>
      )}
    </div>
  )
}
