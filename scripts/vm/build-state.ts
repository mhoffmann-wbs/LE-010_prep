// Boots the guest built by build-image.sh once in v86 (headless, in Node), waits
// for mira's prompt and saves the machine state to public/vm/state.bin.zst, so the
// learner's terminal restores it instead of booting.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { V86 } from 'v86'
import { VM_MEMORY_MB, VM_PROMPT, stripAnsi } from '../../src/vm/config.ts'

const OUT = path.resolve(import.meta.dirname, '../../public/vm')
const BOOT_TIMEOUT_MS = 15 * 60_000

const emulator = new V86({
  wasm_path: path.join(OUT, 'v86.wasm'),
  bios: { url: path.join(OUT, 'seabios.bin') },
  vga_bios: { url: path.join(OUT, 'vgabios.bin') },
  memory_size: VM_MEMORY_MB * 1024 * 1024,
  vga_memory_size: 2 * 1024 * 1024,
  autostart: true,
  bzimage_initrd_from_filesystem: true,
  uart1: true,
  // From v86's Debian example: no Spectre mitigations in a sandbox, and
  // init_on_free zeroes freed memory so the state compresses well.
  cmdline: 'rw init=/sbin/le-init root=host9p console=ttyS0 quiet spectre_v2=off pti=off init_on_free=on',
  filesystem: {
    basefs: path.join(OUT, 'rootfs.json'),
    baseurl: path.join(OUT, 'rootfs') + '/',
  },
})

const started = Date.now()
let console0 = ''
let saving = false
const timer = setTimeout(() => fail(`no prompt after ${BOOT_TIMEOUT_MS / 60_000} minutes`), BOOT_TIMEOUT_MS)

emulator.add_listener('serial0-output-byte', (byte: number) => {
  const c = String.fromCharCode(byte)
  process.stdout.write(c)
  console0 += c
  if (!saving && stripAnsi(console0).endsWith(VM_PROMPT)) {
    saving = true
    console.error(`\nPrompt after ${((Date.now() - started) / 1000).toFixed(0)} s, saving state`)
    if (console0.includes('no job control')) fail('the login shell has no controlling terminal (see le-init)')
    // Let the shell settle, then clear the screen so a restore starts clean.
    emulator.serial0_send('clear\n')
    setTimeout(() => void save(), 3000)
  }
})

async function save() {
  clearTimeout(timer)
  const state = await emulator.save_state()
  const raw = path.join(OUT, 'state.bin')
  writeFileSync(raw, new Uint8Array(state))
  execFileSync('zstd', ['-19', '-f', '-q', raw, '-o', `${raw}.zst`], { stdio: 'inherit' })
  rmSync(raw)
  const size = readFileSync(`${raw}.zst`).byteLength
  console.error(`Saved ${raw}.zst (${(size / 1024 / 1024).toFixed(1)} MB)`)
  await emulator.destroy()
  process.exit(0)
}

function fail(message: string) {
  console.error(`\nbuild-state: ${message}`)
  process.exit(1)
}
