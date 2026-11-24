// Restores the saved state in v86 (headless, in Node) the way the browser does,
// runs a few commands and checks what they print. Run after vm:state.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { V86 } from 'v86'
import { VM_MEMORY_MB, stripAnsi } from '../../src/vm/config.ts'

const OUT = path.resolve(import.meta.dirname, '../../public/vm')

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
const emulator = new V86({
  wasm_path: path.join(OUT, 'v86.wasm'),
  memory_size: VM_MEMORY_MB * 1024 * 1024,
  vga_memory_size: 2 * 1024 * 1024,
  initial_state: { buffer: decompress(path.join(OUT, 'state.bin.zst')) },
  filesystem: { baseurl: path.join(OUT, 'rootfs') + '/' },
  uart1: true,
  autostart: true,
})

let output = ''
emulator.add_listener('serial0-output-byte', (byte: number) => {
  output += String.fromCharCode(byte)
})

await new Promise<void>((resolve) => emulator.add_listener('emulator-started', () => resolve()))
console.log(`Restored in ${((performance.now() - started) / 1000).toFixed(1)} s`)
emulator.serial_send_bytes(1, new TextEncoder().encode(`clock ${Math.floor(Date.now() / 1000)}\n`))

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

await emulator.destroy()
process.exit(failed ? 1 : 0)

function decompress(file: string): ArrayBuffer {
  // Node 22+ ships zstd in zlib.
  const { zstdDecompressSync } = process.getBuiltinModule('node:zlib') as typeof import('node:zlib')
  const bytes = zstdDecompressSync(readFileSync(file))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = performance.now() + timeoutMs
  while (performance.now() < end) {
    if (condition()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return condition()
}
