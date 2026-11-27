import { describe, expect, it } from 'vitest'
import { renderScreen } from './screen'

describe('renderScreen', () => {
  it('keeps plain lines and drops colours, titles and trailing space', () => {
    expect(renderScreen('\x1b]0;mira@build: ~\x07\x1b[01;32mok\x1b[00m  \r\nnext\r\n\r\n')).toBe('ok\nnext')
  })

  it('overwrites a line after a carriage return, as a progress counter does', () => {
    expect(renderScreen('  0%\r 50%\r100% done\n')).toBe('100% done')
  })

  it('applies cursor-up redraws and line erases, as dnf does', () => {
    expect(renderScreen('repo A  10%\nrepo B   0%\n\x1b[2A\rrepo A 100%\x1b[K\n\rrepo B 100%\x1b[K\n')).toBe('repo A 100%\nrepo B 100%')
  })

  it('leaves out a status line drawn between save and restore cursor, as apt and apk do', () => {
    expect(renderScreen('Unpacking tree ...\n\x1b7\x1b[40;0f\x1b[42mProgress: [ 40%]\x1b[49m\x1b8Setting up tree ...\n')).toBe('Unpacking tree ...\nSetting up tree ...')
  })

  it('handles backspace and erase to the start of a line', () => {
    expect(renderScreen('abc\bX\n')).toBe('abX')
    expect(renderScreen('abcdef\x1b[3D\x1b[1K\n')).toBe('    ef')
  })
})
