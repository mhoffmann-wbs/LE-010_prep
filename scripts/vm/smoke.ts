// Restores the saved state in v86 (headless, in Node) the way the browser does,
// types a few commands into mira's terminal and checks what they print, then
// checks the job runner behind lesson cells and content:verify. Run after vm:state.
import { stripAnsi } from '../../src/vm/config.ts'
import type { Job } from '../../src/vm/job.ts'
import { restoreGuest } from './guest.ts'

/** Each command's output must match its pattern. */
const CHECKS: { command: string; expect: RegExp }[] = [
  { command: 'whoami; hostname', expect: /mira\r?\ntuxpixel/ },
  { command: 'tty', expect: /\/dev\/ttyS0/ },
  { command: 'date +%Y', expect: new RegExp(String(new Date().getFullYear())) },
  { command: 'man -w ls', expect: /\/usr\/share\/man\/man1\/ls\.1\.gz/ },
  { command: 'tar --version | head -n 1', expect: /tar \(GNU tar\)/ },
  { command: 'ls -ld /tmp', expect: /^drwxrwxrwt/m },
  { command: 'id', expect: /groups=1000\(mira\),27\(sudo\)/ },
  // Ctrl+C must reach the foreground program (job control works).
  { command: 'sleep 30', expect: /\$ $/ },
]

const started = performance.now()
const { emulator, runner } = await restoreGuest()
console.log(`Restored in ${((performance.now() - started) / 1000).toFixed(1)} s`)

let output = ''
emulator.add_listener('serial0-output-byte', (byte: number) => {
  output += String.fromCharCode(byte)
})

let failed = 0
for (const { command, expect } of CHECKS) {
  output = ''
  const t = performance.now()
  emulator.serial0_send(`${command}\n`)
  if (command.startsWith('sleep')) {
    await waitFor(() => stripAnsi(output).includes(command), 10_000)
    emulator.serial0_send('\x03')
  }
  const ok = await waitFor(() => expect.test(stripAnsi(output).split(command).slice(1).join(command)) && /\$ $/.test(stripAnsi(output)), 20_000)
  const ms = performance.now() - t
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${command} (${ms.toFixed(0)} ms)${ok ? '' : `\n${stripAnsi(output)}`}`)
  if (!ok) failed++
}

// The job runner: each run starts from the snapshot, fixtures apply, statuses come back.
const RUNNER_CHECKS: { name: string; job: Job; expect: { exit: number; output: RegExp } }[] = [
  { name: 'a run as mira', job: { command: 'touch /tmp/left-behind; whoami; pwd; tty' }, expect: { exit: 0, output: /^mira\n\/home\/mira\n\/dev\/pts\/\d+$/ } },
  { name: 'the next run starts clean', job: { command: 'ls /tmp/left-behind' }, expect: { exit: 2, output: /No such file/ } },
  {
    name: 'a fixture, as jonas',
    job: { command: 'ls -l /srv/x', user: 'jonas', fixture: { description: 'smoke', groups: [], entries: [{ path: '/srv/x/a.txt', type: 'file', content: 'a\n', owner: 'jonas', mode: '640' }] } },
    expect: { exit: 0, output: /^total \d+\n-rw-r----- 1 jonas jonas 2 Nov  2 09:30 a\.txt$/ },
  },
  { name: 'exit status', job: { command: 'false' }, expect: { exit: 1, output: /^$/ } },
  { name: 'a command that hangs is killed', job: { command: 'sleep 60' }, expect: { exit: 124, output: /^$/ } },
]
for (const { name, job, expect } of RUNNER_CHECKS) {
  const t = performance.now()
  const r = await runner.run(job)
  const ok = r.exit === expect.exit && expect.output.test(r.output)
  console.log(`${ok ? 'ok  ' : 'FAIL'} runner: ${name} (${(performance.now() - t).toFixed(0)} ms)${ok ? '' : `\n${JSON.stringify(r)}`}`)
  if (!ok) failed++
}

await emulator.destroy()
process.exit(failed ? 1 : 0)

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = performance.now() + timeoutMs
  while (performance.now() < end) {
    if (condition()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return condition()
}
