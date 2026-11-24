import { describe, expect, it } from 'vitest'
import { fixtureSchema } from '../content/fixture'
import { cleanOutput, defaultOwner, fixtureScript, fromBase64, jobScript, shellQuote, toBase64 } from './job'

const fixture = (data: unknown) => fixtureSchema.parse(data)

describe('job scripts', () => {
  it('round-trips UTF-8 through base64', () => {
    const text = 'Pixel Raiders – level ü\n\ttabs\n'
    expect(fromBase64(toBase64(text))).toBe(text)
  })

  it('single-quotes for bash', () => {
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`)
  })

  it('gives paths to the user whose home they are in, else root', () => {
    expect(defaultOwner('/home/jonas/a.txt')).toBe('jonas')
    expect(defaultOwner('/home/stranger/a.txt')).toBe('root')
    expect(defaultOwner('/srv/assets')).toBe('root')
  })

  it('creates missing parents for the entry owner, without touching existing ones', () => {
    const script = fixtureScript(fixture({ description: 'x', entries: [{ path: '/srv/assets/a.png', owner: 'ada', content: 'a' }] }))
    expect(script).toContain(`[ -d '/srv' ] || { mkdir '/srv' && chown ada:ada '/srv'; }`)
    expect(script).toContain(`[ -d '/srv/assets' ] || { mkdir '/srv/assets' && chown ada:ada '/srv/assets'; }`)
    expect(script).toContain(`chmod 644 '/srv/assets/a.png'`)
  })

  it('writes groups first, then entries, then setup steps as their user', () => {
    const script = fixtureScript(
      fixture({
        description: 'x',
        groups: [{ name: 'artists', members: ['ada'] }],
        entries: [{ path: '/home/mira/link', type: 'symlink', target: 'assets' }],
        setup: [{ user: 'jonas', run: "echo 'hi' > x" }],
      }),
    )
    const lines = script.split('\n')
    expect(lines[0]).toBe('getent group artists > /dev/null || groupadd artists')
    expect(lines).toContain(`ln -sfn 'assets' '/home/mira/link'`)
    expect(lines.at(-1)).toBe(`(cd /home/jonas && runuser -u jonas -- bash -c 'echo '\\''hi'\\'' > x')`)
  })

  it('runs the command as the user, in their home, under a pty', () => {
    const script = jobScript({ command: 'ls -l', user: 'root' })
    expect(script).toContain("<<'LE_CMD_EOF'\nls -l\nLE_CMD_EOF")
    expect(script).toContain('cd /root')
    expect(script).toMatch(/runuser -u root -- env -i HOME=\/root .*PATH=\/usr\/local\/sbin/)
    expect(jobScript({ command: 'ls' })).toMatch(/runuser -u mira -- env -i HOME=\/home\/mira .*PATH=\/usr\/local\/bin:\/usr\/bin:\/bin:/)
  })

  it('cleans output the way the learner reads it', () => {
    expect(cleanOutput('\x1b[01;34massets\x1b[0m  notes.txt\r\nnext\r\n')).toBe('assets  notes.txt\nnext')
  })
})

describe('fixture schema', () => {
  const errors = (data: unknown) => fixtureSchema.safeParse(data).error?.issues.map((i) => i.message) ?? []

  it('requires absolute paths without a trailing slash', () => {
    expect(errors({ description: 'x', entries: [{ path: 'notes.txt' }] })).toEqual(['must be an absolute path without a trailing slash'])
    expect(errors({ description: 'x', entries: [{ path: '/srv/' }] })).toEqual(['must be an absolute path without a trailing slash'])
  })

  it('ties targets to symlinks and content to files', () => {
    expect(errors({ description: 'x', entries: [{ path: '/a', type: 'symlink' }] })).toContain('symlinks need a target, and only symlinks have one')
    expect(errors({ description: 'x', entries: [{ path: '/a', type: 'dir', content: 'x' }] })).toContain('only files have content')
  })

  it('rejects duplicate paths and unknown users', () => {
    expect(errors({ description: 'x', entries: [{ path: '/a' }, { path: '/a' }] })).toContain('duplicate paths: /a')
    expect(errors({ description: 'x', entries: [{ path: '/a', owner: 'eve' }] })).toHaveLength(1)
  })
})
