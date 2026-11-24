import type { V86 } from 'v86'
import { VM_MEMORY_MB } from './config'
import { VmRunner, syncClock } from './runner'

/** Where the deploy (or `npm run vm:build && npm run vm:state`) puts the guest. */
export const VM_BASE = `${import.meta.env.BASE_URL}vm/`

/** True when the guest image has been built and served next to the app. */
export async function vmAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${VM_BASE}state.bin.zst`, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

export type Vm = {
  emulator: V86
  /** The saved state as downloaded (zstd); restore_state() takes it as it is. */
  snapshot: ArrayBuffer
}

/**
 * Restores the saved guest state and resolves once the machine runs. v86 is
 * imported here, so it stays out of every bundle that doesn't open a terminal.
 * File contents come from `rootfs/` on demand, when the guest first reads them.
 */
export async function startVm(): Promise<Vm> {
  const [{ V86: Emulator }, snapshot] = await Promise.all([
    import('v86'),
    fetch(`${VM_BASE}state.bin.zst`).then((res) => {
      if (!res.ok) throw new Error(`state.bin.zst: HTTP ${res.status}`)
      return res.arrayBuffer()
    }),
  ])
  const emulator = new Emulator({
    wasm_path: `${VM_BASE}v86.wasm`,
    memory_size: VM_MEMORY_MB * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    initial_state: { buffer: snapshot },
    filesystem: { baseurl: `${VM_BASE}rootfs/` },
    uart1: true,
    autostart: true,
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
  })
  await new Promise<void>((resolve) => emulator.add_listener('emulator-started', () => resolve()))
  syncClock(emulator)
  return { emulator, snapshot }
}

let shared: Promise<VmRunner> | undefined

/**
 * The machine behind lesson cells and other one-shot runs: started on first use
 * and shared by every page. A failed start is forgotten, so the next run retries.
 */
export function sharedRunner(): Promise<VmRunner> {
  shared ??= startVm().then(({ emulator, snapshot }) => new VmRunner(emulator, snapshot))
  shared.catch(() => (shared = undefined))
  return shared
}
