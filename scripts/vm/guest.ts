// Restores the saved guest in v86 (headless, in Node) the way the browser does
// (src/vm/emulator.ts): the compressed state, files fetched from rootfs/ on
// demand, the clock synced. Used by vm:smoke and content:verify.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { V86 } from 'v86'
import { VM_MEMORY_MB } from '../../src/vm/config.ts'
import { VmRunner, syncClock } from '../../src/vm/runner.ts'

export const VM_DIR = path.resolve(import.meta.dirname, '../../public/vm')
const STATE = path.join(VM_DIR, 'state.bin.zst')

export const guestBuilt = () => existsSync(STATE)

export async function restoreGuest(timeoutS?: number): Promise<{ emulator: V86; runner: VmRunner }> {
  const bytes = readFileSync(STATE)
  const snapshot = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const emulator = new V86({
    wasm_path: path.join(VM_DIR, 'v86.wasm'),
    memory_size: VM_MEMORY_MB * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    initial_state: { buffer: snapshot },
    filesystem: { baseurl: path.join(VM_DIR, 'rootfs') + '/' },
    uart1: true,
    autostart: true,
  })
  await new Promise<void>((resolve) => emulator.add_listener('emulator-started', () => resolve()))
  syncClock(emulator)
  return { emulator, runner: new VmRunner(emulator, snapshot, { timeoutS }) }
}
