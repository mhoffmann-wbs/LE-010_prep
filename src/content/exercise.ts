// Zod schema for terminal exercises (PLAN.md §6c), and the jobs that run them.
// Exercises live as JSON arrays in src/content/exercises/<objectiveId>.json. The
// learner works in a real terminal as mira after the fixture is applied; Check
// then runs the exercise's `check` script on that same machine. content:verify
// proves each check with the solution (it must pass) and without (it must fail).
//
// Scripts import this file with Node, so runtime imports carry their extension.
import { z } from 'zod'
import { DEFAULT_USER, type Job, PATHS } from '../vm/job.ts'
import { type Fixture, FIXTURE_NAME } from './fixture.ts'
import { AREA_ID, OBJECTIVE_ID } from './schema.ts'

const nonEmpty = z.string().trim().min(1)

export const exerciseSchema = z
  .object({
    /** `${objectiveId}-eNN`, e.g. "013.1-e02". Stored in progress: never renumber or reuse. */
    id: z.string().regex(/^01[1-5]\.[1-4]-e\d{2}$/),
    objectiveId: z.string().regex(OBJECTIVE_ID),
    /** Key knowledge area ids the exercise practises; they decide which exams it is on. */
    areas: z.array(z.string().regex(AREA_ID)).min(1),
    title: nonEmpty,
    /** Paragraphs split by blank lines; "- " or "1. " paragraphs are lists, a ``` paragraph a block. */
    prompt: nonEmpty,
    /** The file tree the exercise starts from. */
    fixture: z.string().regex(FIXTURE_NAME).optional(),
    hints: z.array(nonEmpty).min(1).max(3),
    /** Commands that solve it, typed as mira in her home directory; the check must pass after them. */
    solution: nonEmpty,
    /**
     * Bash run as root in /home/mira after the learner's session. `ok "…"` reports a
     * met requirement, `no "…"` an unmet one (and fails the check); any other exit
     * status but 0 fails it too.
     */
    check: nonEmpty,
  })
  .refine((e) => e.id.startsWith(`${e.objectiveId}-`), { message: 'the id must start with the objective id', path: ['id'] })

export type Exercise = z.infer<typeof exerciseSchema>

export const exerciseFileSchema = z.array(exerciseSchema)

const HOME = `/home/${DEFAULT_USER}`

/** What starts an exercise: the fixture, applied as the learner's terminal waits at mira's prompt. */
export function startJob(fixture?: Fixture): Job {
  return { command: ':', fixture }
}

/** The check, as root in mira's home, with the `ok` and `no` helpers. */
export function checkCommand(ex: Pick<Exercise, 'check'>): string {
  return [
    'status=0',
    `ok() { printf '✓ %s\\n' "$*"; }`,
    `no() { printf '✗ %s\\n' "$*"; status=1; }`,
    `cd ${HOME}`,
    ex.check.trimEnd(),
    'exit $status',
  ].join('\n')
}

/** Runs the check on the learner's machine as it is now. */
export function checkJob(ex: Pick<Exercise, 'check'>): Job {
  return { command: checkCommand(ex), user: 'root' }
}

/**
 * For content:verify: the solution typed as mira, then the check. A command in
 * it may fail on purpose (an error to redirect), so only the check decides. Runs as root, so the check sees the machine the way it would
 * after a learner's session.
 */
export function solutionCommand(ex: Pick<Exercise, 'solution' | 'check'>): string {
  return [
    "cat > /run/le-solution <<'LE_SOLUTION_EOF'",
    'umask 022',
    ex.solution.trimEnd(),
    'LE_SOLUTION_EOF',
    'chmod 644 /run/le-solution',
    `cd ${HOME}`,
    `runuser -u ${DEFAULT_USER} -- env -i HOME=${HOME} USER=${DEFAULT_USER} LOGNAME=${DEFAULT_USER} SHELL=/bin/bash PATH=${PATHS.user} LANG=en_US.UTF-8 TERM=xterm-256color bash /run/le-solution > /dev/null 2>&1`,
    checkCommand(ex),
  ].join('\n')
}

export type CheckReport = {
  passed: boolean
  /** The check's `ok` and `no` lines. */
  rows: { passed: boolean; text: string }[]
  /** Anything else it printed (an error), or why it couldn't run. */
  other: string
}

/** Splits a check's output into its ✓ and ✗ lines and anything else. */
export function parseCheck(exit: number, output: string): CheckReport {
  const rows: CheckReport['rows'] = []
  const other: string[] = []
  for (const line of output.split('\n')) {
    const m = /^([✓✗]) (.*)$/.exec(line)
    if (m) rows.push({ passed: m[1] === '✓', text: m[2]! })
    else if (line.trim()) other.push(line)
  }
  return { passed: exit === 0, rows, other: other.join('\n') }
}
