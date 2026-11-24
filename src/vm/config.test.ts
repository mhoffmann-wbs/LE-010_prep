import { describe, expect, it } from 'vitest'
import { VM_PROMPT, stripAnsi } from './config'

describe('stripAnsi', () => {
  it('reduces Debian’s colour prompt to the plain prompt', () => {
    const coloured = '\x1b]0;mira@tuxpixel: ~\x07\x1b[01;32mmira@tuxpixel\x1b[00m:\x1b[01;34m~\x1b[00m$ '
    expect(stripAnsi(coloured)).toBe(VM_PROMPT)
  })
})
