/** Shared by the browser runtime and scripts/vm/build-state.ts. */

/** Guest RAM. The saved state holds all of it, so keep it small. */
export const VM_MEMORY_MB = 128

/** mira's bash prompt (Debian's default PS1) once colour codes are stripped. */
export const VM_PROMPT = 'mira@tuxpixel:~$ '

/** Removes ANSI escape sequences (colours, cursor moves) from terminal output. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g, '')
}
