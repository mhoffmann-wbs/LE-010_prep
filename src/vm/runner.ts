// Runs jobs (src/vm/job.ts) in a v86 guest over le-init's root control channel
// on the second serial port, one at a time. Every run after the first restores
// the snapshot, so each starts from the same clean machine, unless it asks to
// keep the machine as it is (an exercise's check after the learner's session).
// Used by lesson cells and exercises in the browser, and by the scripts in Node.
//
// Scripts import this file with Node, so runtime imports carry their extension.
import type { V86 } from 'v86'
import { FIXTURE_FAILED, JOB_TIMEOUT_S, type Job, cleanOutput, fromBase64, jobScript, toBase64 } from './job.ts'

export type RunResult = {
  /** What the command printed, cleaned with cleanOutput(). */
  output: string
  exit: number
}

export class RunError extends Error {
  readonly reason: 'timeout' | 'fixture'

  constructor(reason: 'timeout' | 'fixture', message: string) {
    super(message)
    this.reason = reason
  }
}

/** A restored snapshot keeps the clock of the moment it was saved; le-init sets it. */
export function syncClock(emulator: V86) {
  sendLine(emulator, `clock ${Math.floor(Date.now() / 1000)}`)
}

function sendLine(emulator: V86, line: string) {
  emulator.serial_send_bytes(1, new TextEncoder().encode(`${line}\n`))
}

export class VmRunner {
  private queue: Promise<unknown> = Promise.resolve()
  private line = ''
  private pending = new Map<string, (r: RunResult) => void>()
  private nextId = 1
  /** False until the first run changes the machine. */
  private dirty = false
  // Plain fields: Node's type stripping (the scripts) has no parameter properties.
  private readonly emulator: V86
  private readonly snapshot: ArrayBuffer
  private readonly timeoutS: number
  private readonly timeoutMs: number

  /**
   * @param snapshot the saved state (zstd-compressed is fine) that every run after the first restores
   * @param timeoutS seconds the guest lets a command run before killing it
   * @param timeoutMs how long a run may take, including the reset
   */
  constructor(
    emulator: V86,
    snapshot: ArrayBuffer,
    { timeoutS = JOB_TIMEOUT_S, timeoutMs = (timeoutS + 10) * 1000 }: { timeoutS?: number; timeoutMs?: number } = {},
  ) {
    this.emulator = emulator
    this.snapshot = snapshot
    this.timeoutS = timeoutS
    this.timeoutMs = timeoutMs
    emulator.add_listener('serial1-output-byte', (byte: number) => this.receive(byte))
  }

  /**
   * Queues a job; resolves with its output, or rejects with a RunError.
   * With `keep`, the job runs on the machine as it is, without the reset.
   */
  run(job: Job, { keep = false }: { keep?: boolean } = {}): Promise<RunResult> {
    const result = this.queue.then(() => this.exec(job, keep))
    this.queue = result.catch(() => {})
    return result
  }

  private async exec(job: Job, keep: boolean): Promise<RunResult> {
    if (this.dirty && !keep) {
      await this.emulator.restore_state(this.snapshot)
      syncClock(this.emulator)
    }
    this.dirty = true
    const id = String(this.nextId++)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        new Promise<RunResult>((resolve) => {
          this.pending.set(id, resolve)
          sendLine(this.emulator, `job ${id} ${toBase64(jobScript(job, this.timeoutS))}`)
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new RunError('timeout', `no answer after ${this.timeoutMs / 1000} s`)), this.timeoutMs)
        }),
      ])
      if (result.exit === FIXTURE_FAILED && result.output.startsWith('le-job:')) throw new RunError('fixture', result.output)
      return result
    } finally {
      clearTimeout(timer)
      this.pending.delete(id)
    }
  }

  private receive(byte: number) {
    if (byte !== 0x0a) {
      this.line += String.fromCharCode(byte)
      return
    }
    const m = /^le-done (\S+) (\d+) ?(\S*)\r?$/.exec(this.line)
    this.line = ''
    if (m) this.pending.get(m[1]!)?.({ exit: Number(m[2]), output: cleanOutput(fromBase64(m[3]!)) })
  }
}
