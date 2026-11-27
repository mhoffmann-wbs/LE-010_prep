import { describe, expect, it } from 'vitest'
import pipesJson from '../../content/sims/pipes.json'
import { ERR_FILE, OUT_FILE, type Spec, commandLine, describeRoutes, paramsSchema, places, simulate } from './model'
import recorded from './recorded.json'

// recorded.json holds 144 cases, one for every command (4) x stdout choice (screen, >, >>, and
// a pipe into wc -l, sort -r or head -n 1) x stderr choice (screen, 2>, 2>>, 2> /dev/null,
// 2>&1 after the redirection, 2>&1 before it). Each ran in the guest in a fresh directory
// holding build.log (5 lines), out.txt ("old output") and err.txt ("old error"). It records
// what appeared on the screen (stdout and stderr mixed, as in the terminal) and both files after.
const params = paramsSchema.parse(pipesJson.params)
const cases = recorded.cases as { command: string; spec: Spec; screen: string[]; files: Record<string, string[]> }[]

describe('pipes model against the guest', () => {
  it('has the whole matrix', () => {
    expect(cases).toHaveLength(144)
  })

  it.each(cases.map((c) => [c.command, c] as const))('%s', (_name, c) => {
    const outcome = simulate(c.spec, params)
    expect(outcome.command).toBe(c.command)
    expect(outcome.screen).toEqual(c.screen)
    expect(outcome.files[OUT_FILE]).toEqual(c.files[OUT_FILE])
    expect(outcome.files[ERR_FILE]).toEqual(c.files[ERR_FILE])
  })

  // The streams each command writes on its own are the params' copy; they were recorded by
  // running the command with the other stream sent to /dev/null.
  it('uses the guest-recorded streams as the commands', () => {
    for (const cmd of params.commands) {
      const apart = cases.find((c) => c.spec.command === cmd.id && c.spec.stdout === 'truncate' && c.spec.stderr === 'truncate')!
      expect(apart.files[OUT_FILE], cmd.id).toEqual(cmd.stdout.length ? cmd.stdout : [])
      expect(apart.files[ERR_FILE], cmd.id).toEqual(cmd.stderr)
    }
  })

  it('records the same build.log and old file contents as the params', () => {
    expect(params.buildLog).toEqual(['INFO build started', 'ERROR missing tile', 'WARN sprite too wide', 'ERROR disk full', 'INFO build finished'])
    expect(params.before).toEqual({ out: ['old output'], err: ['old error'] })
  })

  it('every preset is one of the recorded cases', () => {
    const keys = new Set(cases.map((c) => JSON.stringify(c.spec)))
    const missing = params.presets.filter((p) => !keys.has(JSON.stringify(p.spec))).map((p) => p.title)
    expect(missing).toEqual([])
  })
})

describe('pipes explanations', () => {
  const spec = (over: Partial<Spec>): Spec => ({ command: 'ls', stdout: 'screen', filter: 'wc', stderr: 'screen', ...over })

  it('knows where each stream points once the shell has read the line', () => {
    expect(places(spec({ stdout: 'truncate', stderr: 'merge' }))).toEqual({ stdout: OUT_FILE, stderr: OUT_FILE })
    expect(places(spec({ stdout: 'truncate', stderr: 'merge-first' }))).toEqual({ stdout: OUT_FILE, stderr: 'screen' })
    expect(places(spec({ stdout: 'pipe', stderr: 'merge-first' }))).toEqual({ stdout: 'pipe', stderr: 'pipe' })
    expect(places(spec({ stderr: 'null' }))).toEqual({ stdout: 'screen', stderr: 'null' })
  })

  it('builds the command lines people type', () => {
    expect(commandLine(spec({ stdout: 'truncate', stderr: 'merge' }), params.commands)).toBe('ls nothere build.log > out.txt 2>&1')
    expect(commandLine(spec({ stdout: 'truncate', stderr: 'merge-first' }), params.commands)).toBe('ls nothere build.log 2>&1 > out.txt')
    expect(commandLine(spec({ command: 'wc-stdin' }), params.commands)).toBe('wc -l < build.log')
  })

  it('explains the order trap and what a pipe carries', () => {
    expect(describeRoutes(spec({ stdout: 'truncate', stderr: 'merge-first' }), params).note).toMatch(/Only stdout moved/)
    expect(describeRoutes(spec({ stdout: 'pipe' }), params).note).toMatch(/only stdout/)
    expect(describeRoutes(spec({ command: 'wc-stdin' }), params).stdin).toMatch(/build\.log/)
  })
})
