import type { V86 } from 'v86'
import { VM_MEMORY_MB } from './config'

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

/**
 * Restores the saved guest state and resolves once the machine runs. v86 is
 * imported here, so it stays out of every bundle that doesn't open a terminal.
 * File contents come from `rootfs/` on demand, when the guest first reads them.
 */
export async function startVm(): Promise<V86> {
  const { V86: Emulator } = await import('v86')
  const emulator = new Emulator({
    wasm_path: `${VM_BASE}v86.wasm`,
    memory_size: VM_MEMORY_MB * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    initial_state: { url: `${VM_BASE}state.bin.zst` },
    filesystem: { baseurl: `${VM_BASE}rootfs/` },
    uart1: true,
    autostart: true,
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
  })
  await new Promise<void>((resolve) => emulator.add_listener('emulator-started', () => resolve()))
  syncClock(emulator)
  return emulator
}

/** A restored snapshot keeps the clock of the moment it was saved; le-init sets it. */
function syncClock(emulator: V86) {
  const line = `clock ${Math.floor(Date.now() / 1000)}\n`
  emulator.serial_send_bytes(1, new TextEncoder().encode(line))
}
