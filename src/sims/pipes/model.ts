// Pipes and redirection: where the three streams of one command go. The
// command line is composed from parts (a command, where stdout goes, where
// stderr goes, an optional filter after a pipe). What the command prints is
// recorded data in the params; the model decides where each line ends up and
// what is in each file afterwards. Every case in recorded.json was run in the
// guest, and model.test.ts checks the model against all of them.
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const lines = z.array(z.string())

export const STDOUT_MODES = ['screen', 'truncate', 'append', 'pipe'] as const
export type StdoutMode = (typeof STDOUT_MODES)[number]
export const STDERR_MODES = ['screen', 'truncate', 'append', 'null', 'merge', 'merge-first'] as const
export type StderrMode = (typeof STDERR_MODES)[number]
export const FILTER_IDS = ['wc', 'sort', 'head'] as const
export type FilterId = (typeof FILTER_IDS)[number]

export const OUT_FILE = 'out.txt'
export const ERR_FILE = 'err.txt'

export interface Spec {
  /** A command's id from the params. */
  command: string
  stdout: StdoutMode
  /** Only used when stdout is a pipe. */
  filter: FilterId
  stderr: StderrMode
}

const specSchema = z.object({
  command: nonEmpty,
  stdout: z.enum(STDOUT_MODES),
  filter: z.enum(FILTER_IDS),
  stderr: z.enum(STDERR_MODES),
})

export const paramsSchema = z.object({
  /** build.log, the file every command reads. */
  buildLog: z.array(nonEmpty).min(3),
  /** What out.txt and err.txt hold before the command runs, so truncating and appending differ. */
  before: z.object({ out: z.array(nonEmpty).min(1), err: z.array(nonEmpty).min(1) }),
  /** The commands to choose from and what each one writes to stdout and stderr on its own (recorded in the guest). */
  commands: z
    .array(
      z.object({
        id: nonEmpty,
        label: nonEmpty,
        /** The command as typed, with its own `<` if it has one. */
        text: nonEmpty,
        /** The file the command reads through `<`, if any. */
        stdinFile: z.string().optional(),
        stdout: lines,
        stderr: lines,
        explain: nonEmpty,
      }),
    )
    .min(3),
  presets: z.array(z.object({ title: nonEmpty, explain: nonEmpty, spec: specSchema })).min(5),
})

export type PipesParams = z.infer<typeof paramsSchema>
export type CommandDef = PipesParams['commands'][number]

export const FILTERS: Record<FilterId, { text: string; apply: (input: string[]) => string[] }> = {
  wc: { text: 'wc -l', apply: (input) => [String(input.length)] },
  // Byte order, which is what the guest produced for the recorded cases.
  sort: { text: 'sort -r', apply: (input) => [...input].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).reverse() },
  head: { text: 'head -n 1', apply: (input) => input.slice(0, 1) },
}

/** The same stream split by where the shell sends it. */
export type Place = 'screen' | 'pipe' | 'null' | typeof OUT_FILE | typeof ERR_FILE

/** Where stdout and stderr point once the shell has read the whole command line. */
export function places(spec: Spec): { stdout: Place; stderr: Place } {
  const stdout: Place = spec.stdout === 'screen' ? 'screen' : spec.stdout === 'pipe' ? 'pipe' : OUT_FILE
  let stderr: Place
  switch (spec.stderr) {
    case 'screen':
      stderr = 'screen'
      break
    case 'truncate':
    case 'append':
      stderr = ERR_FILE
      break
    case 'null':
      stderr = 'null'
      break
    case 'merge':
      stderr = stdout
      break
    case 'merge-first':
      // `2>&1` copies where stdout points at that moment: still the screen if a `>` comes later.
      // A pipe is set up before any redirection, so it is already in place.
      stderr = stdout === OUT_FILE ? 'screen' : stdout
      break
  }
  return { stdout, stderr }
}

/** Whether the file is emptied (`>`) or kept (`>>`) before the command writes to it. */
export const fileMode = (spec: Spec, file: typeof OUT_FILE | typeof ERR_FILE): 'truncate' | 'append' | undefined => {
  if (file === OUT_FILE) return spec.stdout === 'truncate' || spec.stdout === 'append' ? spec.stdout : undefined
  return spec.stderr === 'truncate' || spec.stderr === 'append' ? spec.stderr : undefined
}

/** The command line these parts make, in the order a person would type it. */
export function commandLine(spec: Spec, commands: readonly CommandDef[]): string {
  const cmd = commands.find((c) => c.id === spec.command)
  if (!cmd) throw new Error(`unknown command ${spec.command}`)
  const parts = [cmd.text]
  const stderr =
    spec.stderr === 'truncate' ? `2> ${ERR_FILE}` : spec.stderr === 'append' ? `2>> ${ERR_FILE}` : spec.stderr === 'null' ? '2> /dev/null' : spec.stderr === 'screen' ? '' : '2>&1'
  const stdout = spec.stdout === 'truncate' ? `> ${OUT_FILE}` : spec.stdout === 'append' ? `>> ${OUT_FILE}` : ''
  if (spec.stderr === 'merge-first' && spec.stdout !== 'screen') parts.push(stderr, stdout)
  else parts.push(stdout, stderr)
  let line = parts.filter(Boolean).join(' ')
  if (spec.stdout === 'pipe') line += ` | ${FILTERS[spec.filter].text}`
  return line
}

export interface Outcome {
  command: string
  places: { stdout: Place; stderr: Place }
  /** What appears on the screen, in order. */
  screen: string[]
  /** The two files after the command has run. */
  files: { [OUT_FILE]: string[]; [ERR_FILE]: string[] }
  /** What went into the pipe, if there is one. */
  piped: string[]
}

/**
 * Runs the spec. When two streams reach the same place, the command's errors come first,
 * because these commands complain about a missing file before they print anything.
 */
export function simulate(spec: Spec, params: Pick<PipesParams, 'before' | 'commands'>): Outcome {
  const cmd = params.commands.find((c) => c.id === spec.command)
  if (!cmd) throw new Error(`unknown command ${spec.command}`)
  const where = places(spec)
  const received = (place: Place) => [...(where.stderr === place ? cmd.stderr : []), ...(where.stdout === place ? cmd.stdout : [])]

  const piped = received('pipe')
  const afterFilter = spec.stdout === 'pipe' ? FILTERS[spec.filter].apply(piped) : []
  const written = (file: typeof OUT_FILE | typeof ERR_FILE, old: string[]) => {
    const mode = fileMode(spec, file)
    if (!mode) return old
    return mode === 'truncate' ? received(file) : [...old, ...received(file)]
  }
  return {
    command: commandLine(spec, params.commands),
    places: where,
    // Errors the shell sends straight to the screen come before the filter's result.
    screen: spec.stdout === 'pipe' ? [...(where.stderr === 'screen' ? cmd.stderr : []), ...afterFilter] : received('screen'),
    files: { [OUT_FILE]: written(OUT_FILE, params.before.out), [ERR_FILE]: written(ERR_FILE, params.before.err) },
    piped: spec.stdout === 'pipe' ? piped : [],
  }
}

const SCREEN_OR_FILE = (place: Place, spec: Spec) => {
  switch (place) {
    case 'screen':
      return 'the screen'
    case 'null':
      return '/dev/null, which throws it away'
    case 'pipe':
      return `the pipe, into ${FILTERS[spec.filter].text}`
    default: {
      const mode = fileMode(spec, place)
      return mode === 'append' ? `${place}, added at the end` : `${place}, emptied first`
    }
  }
}

/** One plain sentence per stream, for the diagram. */
export function describeRoutes(spec: Spec, params: Pick<PipesParams, 'commands'>) {
  const cmd = params.commands.find((c) => c.id === spec.command)
  const where = places(spec)
  const stdin = cmd?.stdinFile ? `the file ${cmd.stdinFile}, through <` : 'the keyboard, which this command does not read'
  let note: string | undefined
  if (spec.stderr === 'merge-first' && spec.stdout === 'truncate') {
    note = '2>&1 was read before > out.txt, so stderr copied the screen, where stdout still pointed at that moment. Only stdout moved to the file.'
  } else if (spec.stderr === 'merge-first' && spec.stdout === 'append') {
    note = '2>&1 was read before >> out.txt, so stderr copied the screen, where stdout still pointed at that moment. Only stdout moved to the file.'
  } else if (spec.stderr === 'merge' && where.stdout === OUT_FILE) {
    note = '2>&1 came after the redirection of stdout, so stderr copied the file and both streams land in out.txt.'
  } else if (spec.stderr === 'merge' && spec.stdout === 'pipe') {
    note = '2>&1 sends the errors into the pipe as well, so the next command counts and sorts them like any other line.'
  } else if (spec.stdout === 'pipe' && spec.stderr !== 'merge' && spec.stderr !== 'merge-first') {
    note = 'A pipe carries only stdout. Errors skip it and go where stderr points.'
  }
  return {
    stdin,
    stdout: SCREEN_OR_FILE(where.stdout, spec),
    stderr: spec.stderr === 'merge' || spec.stderr === 'merge-first' ? `${SCREEN_OR_FILE(where.stderr, spec)} (via 2>&1)` : SCREEN_OR_FILE(where.stderr, spec),
    note,
  }
}
