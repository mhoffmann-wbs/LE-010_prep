import { describe, expect, it, vi } from 'vitest'
import type { V86 } from 'v86'
import { FIXTURE_FAILED, toBase64 } from './job'
import { RunError, VmRunner } from './runner'

/** Stands in for v86 and le-init: answers each job line on serial port 1. */
function fakeGuest(answer: (id: string) => { exit: number; output: string } | null) {
  let listener: (byte: number) => void = () => {}
  const sent: string[] = []
  const emulator = {
    add_listener: (_: string, l: (byte: number) => void) => (listener = l),
    restore_state: vi.fn<(state: ArrayBuffer) => Promise<void>>(async () => {}),
    serial_send_bytes: (_port: number, bytes: Uint8Array) => {
      const line = new TextDecoder().decode(bytes)
      sent.push(line)
      const m = /^job (\S+) /.exec(line)
      const reply = m && answer(m[1]!)
      if (reply) for (const c of `le-done ${m![1]} ${reply.exit} ${toBase64(reply.output)}\n`) listener(c.charCodeAt(0))
    },
  }
  return { emulator: emulator as unknown as V86, sent, restore: emulator.restore_state }
}

describe('VmRunner', () => {
  it('sends the job and decodes the answer', async () => {
    const guest = fakeGuest(() => ({ exit: 2, output: 'ls: cannot access\r\n' }))
    const r = await new VmRunner(guest.emulator, new ArrayBuffer(8)).run({ command: 'ls nope' })
    expect(r).toEqual({ exit: 2, output: 'ls: cannot access' })
    expect(guest.sent[0]).toMatch(/^job 1 [A-Za-z0-9+/=]+\n$/)
  })

  it('restores the snapshot and resyncs the clock before every run but the first', async () => {
    const guest = fakeGuest(() => ({ exit: 0, output: '' }))
    const runner = new VmRunner(guest.emulator, new ArrayBuffer(8))
    await Promise.all([runner.run({ command: 'a' }), runner.run({ command: 'b' }), runner.run({ command: 'c' })])
    expect(guest.restore).toHaveBeenCalledTimes(2)
    expect(guest.sent.filter((l) => l.startsWith('clock '))).toHaveLength(2)
  })

  it('runs a job that keeps the machine without restoring it', async () => {
    const guest = fakeGuest(() => ({ exit: 0, output: '' }))
    const runner = new VmRunner(guest.emulator, new ArrayBuffer(8))
    await runner.run({ command: 'setup' })
    await runner.run({ command: 'check' }, { keep: true })
    expect(guest.restore).not.toHaveBeenCalled()
    await runner.run({ command: 'again' })
    expect(guest.restore).toHaveBeenCalledTimes(1)
  })

  it('reports a fixture that fails to apply', async () => {
    const guest = fakeGuest(() => ({ exit: FIXTURE_FAILED, output: 'le-job: fixture failed at line 4' }))
    await expect(new VmRunner(guest.emulator, new ArrayBuffer(8)).run({ command: 'x' })).rejects.toMatchObject({ reason: 'fixture' })
  })

  it('times out when the guest never answers, and keeps serving later runs', async () => {
    const guest = fakeGuest((id) => (id === '1' ? null : { exit: 0, output: 'ok' }))
    const runner = new VmRunner(guest.emulator, new ArrayBuffer(8), { timeoutMs: 20 })
    await expect(runner.run({ command: 'hang' })).rejects.toBeInstanceOf(RunError)
    await expect(runner.run({ command: 'echo ok' })).resolves.toEqual({ exit: 0, output: 'ok' })
  })
})
