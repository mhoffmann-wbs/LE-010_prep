import { describe, expect, it } from 'vitest'
import { applyChmod, lsMode, octal, parseMode, symbolicChmod } from './model'

const after = (start: number, arg: string) => {
  const r = applyChmod(start, arg)
  if ('error' in r) throw new Error(r.error)
  return octal(r.mode)
}

describe('permissions model', () => {
  it('writes ls -l letters, octal and an absolute symbolic chmod', () => {
    expect(lsMode(0o750, 'file')).toBe('-rwxr-x---')
    expect(lsMode(0o1777, 'dir')).toBe('drwxrwxrwt')
    expect(lsMode(0o1776, 'dir')).toBe('drwxrwxrwT')
    expect(octal(0o640)).toBe('640')
    expect(octal(0o1777)).toBe('1777')
    expect(symbolicChmod(0o750)).toBe('u=rwx,g=rx,o=')
    expect(symbolicChmod(0o1755)).toBe('u=rwx,g=rx,o=rx,+t')
  })

  it('reads typed octal and letters', () => {
    expect(parseMode('0640')).toEqual({ mode: 0o640 })
    expect(parseMode('1777')).toEqual({ mode: 0o1777 })
    expect(parseMode('drwxrwxrwt')).toEqual({ mode: 0o1777, kind: 'dir' })
    expect(parseMode('rw-r-----')).toEqual({ mode: 0o640, kind: undefined })
    expect(parseMode('4755')).toHaveProperty('error')
    expect(parseMode('rwx')).toHaveProperty('error')
  })

  // Each case was run with GNU chmod in the guest (umask 0022) and its result read with stat.
  it.each([
    [0o644, 'g+w', '664'],
    [0o644, 'o-r', '640'],
    [0o644, 'a+x', '755'],
    [0o755, 'go-rx', '700'],
    [0o640, 'u=rwx,g=rx', '750'],
    [0o777, 'o=', '770'],
    [0o644, 'u+x,g+x,o+x', '755'],
    [0o755, '+t', '1755'],
    [0o777, 'o+t', '1777'],
    [0o1777, 'o-x', '1776'],
    [0o1777, 'a-t', '777'],
    [0o750, '1750', '1750'],
    [0o644, 'ugo=r', '444'],
    [0o755, 'u-x,o+w', '657'],
    [0o644, 'a=rw,o-w', '664'],
    [0o1755, '=rx', '555'],
    [0o444, '+w', '644'],
    [0o644, '-r', '200'],
    [0o777, '=w', '200'],
    [0o600, '+x', '711'],
    [0o1777, '-t', '777'],
    [0o644, 'u+rwx,g-r,o=', '700'],
    [0o755, 'u+t', '755'],
    [0o755, 'g+t', '755'],
    [0o1755, 'u=rwx', '1755'],
    [0o1755, 'o=rx', '755'],
    [0o1755, 'a=rwx', '777'],
  ])('%o with chmod %s gives %s', (start, arg, want) => {
    expect(after(start, arg)).toBe(want)
  })

  it('rejects what it does not model', () => {
    expect(applyChmod(0o644, 'g=u')).toHaveProperty('error')
    expect(applyChmod(0o644, 'u+s')).toHaveProperty('error')
    expect(applyChmod(0o644, '4755')).toHaveProperty('error')
  })
})
