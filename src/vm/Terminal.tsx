import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'
import type { V86 } from 'v86'
import { type Vm, startVm } from './emulator'

/** Lets the page that owns the terminal redraw it after it changed the machine (a reset). */
export type TerminalControls = { refresh(): void }

type Status = { state: 'loading' } | { state: 'ready'; seconds: number } | { state: 'error'; message: string }

/** The terminal's scrollback and screen as plain text: rows that wrapped are joined, trailing blank lines dropped. */
function screenText(term: XTerm): string {
  const buffer = term.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    const text = line?.translateToString(true) ?? ''
    if (line?.isWrapped && lines.length) lines[lines.length - 1] += text
    else lines.push(text)
  }
  return lines.join('\n').trimEnd()
}

/**
 * The learner's terminal: xterm.js wired to the guest's first serial port.
 * The guest runs a login shell for mira, so this is a real bash session.
 * `onStart` runs once the machine is up and before the learner can type, e.g.
 * to apply an exercise's fixture. A new `onStart` starts a new machine, so keep it
 * stable (useCallback).
 *
 * For screen readers, xterm's screen-reader mode announces new output, Shift+Esc
 * leaves the terminal (Tab belongs to bash), and "Terminal text" shows everything
 * printed so far as plain text that can be read line by line.
 */
export default function Terminal({ onStart }: { onStart?: (vm: Vm, controls: TerminalControls) => Promise<void> }) {
  const container = useRef<HTMLDivElement>(null)
  const mirrorButton = useRef<HTMLButtonElement>(null)
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [mirror, setMirror] = useState<string | null>(null)
  // Read by the output handler, so the text updates only while it is shown.
  const mirrorOpen = useRef(false)
  const readMirror = useRef<() => void>(() => {})

  useEffect(() => {
    const term = new XTerm({
      convertEol: false,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 14,
      screenReaderMode: true,
      theme: { background: '#0d1117', foreground: '#e6edf3', cursor: '#f5b800' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container.current!)
    fit.fit()
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'Escape' && e.shiftKey) {
        mirrorButton.current?.focus()
        return false
      }
      return true
    })
    readMirror.current = () => setMirror(screenText(term))

    let emulator: V86 | undefined
    let disposed = false
    const started = performance.now()
    // Bytes arrive one at a time; write them to xterm once per frame.
    let pending: number[] = []
    let frame = 0
    const flush = () => {
      frame = 0
      term.write(Uint8Array.from(pending), () => {
        if (mirrorOpen.current) readMirror.current()
      })
      pending = []
    }

    startVm()
      .then(async (vm) => {
        if (disposed) {
          void vm.emulator.destroy()
          return
        }
        emulator = vm.emulator
        vm.emulator.add_listener('serial0-output-byte', (byte: number) => {
          pending.push(byte)
          if (!frame) frame = requestAnimationFrame(flush)
        })
        // Tell bash the window size, then ask for a fresh prompt.
        const refresh = () => {
          term.reset()
          vm.emulator.serial0_send(`stty cols ${term.cols} rows ${term.rows}; clear\n`)
          term.focus()
        }
        await onStart?.(vm, { refresh })
        if (disposed) return
        term.onData((data) => vm.emulator.serial0_send(data))
        refresh()
        setStatus({ state: 'ready', seconds: (performance.now() - started) / 1000 })
      })
      .catch((e: unknown) => setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) }))

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      void emulator?.destroy()
      readMirror.current = () => {}
      term.dispose()
    }
  }, [onStart])

  const toggleMirror = () => {
    mirrorOpen.current = !mirrorOpen.current
    if (mirrorOpen.current) readMirror.current()
    else setMirror(null)
  }

  return (
    <div className="space-y-2">
      <div ref={container} role="region" aria-label="Linux terminal" className="h-[28rem] rounded-lg bg-[#0d1117] p-2" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-500">
        <p role="status">
          {status.state === 'loading' && 'Starting Linux…'}
          {status.state === 'ready' && `Linux ready in ${status.seconds.toFixed(1)} s.`}
          {status.state === 'error' && `Linux could not start: ${status.message}`}
        </p>
        <p>
          Shift+Esc leaves the terminal.{' '}
          <button ref={mirrorButton} type="button" onClick={toggleMirror} aria-expanded={mirror !== null} className="underline">
            {mirror === null ? 'Show terminal text' : 'Hide terminal text'}
          </button>
        </p>
      </div>
      {mirror !== null && (
        <pre
          tabIndex={0}
          aria-label="Terminal text"
          className="max-h-80 overflow-auto rounded-lg border border-slate-300 bg-white p-3 text-sm whitespace-pre-wrap text-slate-800"
        >
          {mirror || '(nothing printed yet)'}
        </pre>
      )}
    </div>
  )
}
