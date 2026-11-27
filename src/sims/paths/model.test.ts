import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { expandTilde, matchesTask, paramsSchema, resolvePath } from './model'

const params = paramsSchema.parse(JSON.parse(readFileSync('src/content/sims/paths.json', 'utf8')).params)

// Each case was run in the guest as mira, after creating the tree in
// paths.json under ~: `realpath -m <typed>` gave the absolute path and
// `test -e` / `test -d` gave the status (dir, file or missing). The shell
// expanded the tildes, as it does for the learner.
const GUEST: [cwd: string, typed: string, absolute: string, status: string][] = [
  ["/home/mira","pixel-raiders","/home/mira/pixel-raiders","missing"],
  ["/home/mira/studio","pixel-raiders/assets","/home/mira/studio/pixel-raiders/assets","dir"],
  ["/home/mira/studio","../builds","/home/mira/builds","missing"],
  ["/home/mira/studio","/tmp","/tmp","dir"],
  ["/home/mira/studio","~jonas","/home/jonas","dir"],
  ["/home/mira/studio","~","/home/mira","dir"],
  ["/home/mira/studio","~/studio/./builds/../pixel-raiders","/home/mira/studio/pixel-raiders","dir"],
  ["/home/mira/studio","~/studio","/home/mira/studio","dir"],
  ["/tmp","~ada/x","/home/ada/x","missing"],
  ["/etc","/etc/hostname","/etc/hostname","file"],
  ["/etc","hostname","/etc/hostname","file"],
  ["/home/mira/studio/pixel-raiders/assets/sprites","../../../builds","/home/mira/studio/builds","dir"],
  ["/home/mira/studio/pixel-raiders/assets/sprites","../../../../..","/home","dir"],
  ["/home/mira/studio/pixel-raiders/assets/sprites","../../../../../../../..","/","dir"],
  ["/home/mira/studio","builds/../nothere/..","/home/mira/studio","missing"],
  ["/home/mira/studio","nothere/../builds","/home/mira/studio/builds","missing"],
  ["/home/mira/studio","./pixel-raiders/./notes.txt","/home/mira/studio/pixel-raiders/notes.txt","file"],
  ["/home/mira/studio","pixel-raiders/notes.txt/x","/home/mira/studio/pixel-raiders/notes.txt/x","missing"],
  ["/home/mira/studio","pixel-raiders/notes.txt/..","/home/mira/studio/pixel-raiders","missing"],
  ["/home/mira/studio","~bob","/home/mira/studio/~bob","missing"],
  ["/home/mira/studio","~bob/x","/home/mira/studio/~bob/x","missing"],
  ["/home/mira/studio","a~","/home/mira/studio/a~","missing"],
  ["/home/mira","//home///mira//studio/","/home/mira/studio","dir"],
  ["/home/mira","Studio","/home/mira/Studio","missing"],
  ["/home/mira",".bashrc","/home/mira/.bashrc","file"],
  ["/home/mira",".","/home/mira","dir"],
  ["/","..","/","dir"],
  ["/","../home","/home","dir"],
  ["/home/mira","/","/","dir"],
  ["/etc","/","/","dir"],
  ["/home/mira","../jonas","/home/jonas","dir"],
  ["/home/mira/studio/builds","../pixel-raiders/assets","/home/mira/studio/pixel-raiders/assets","dir"],
  ["/tmp","~/studio/pixel-raiders/assets/sprites/hero.png","/home/mira/studio/pixel-raiders/assets/sprites/hero.png","file"],
  ["/home/mira","studio/pixel-raiders/assets/sprites/..","/home/mira/studio/pixel-raiders/assets","dir"],
  ["/home/mira/studio/pixel-raiders","../../../..","/","dir"],
  ["/home/mira","~mira","/home/mira","dir"],
  ["/home/mira","~/","/home/mira","dir"],
  ["/home/mira","~jonas/..","/home","dir"],
  ["/home/mira","/home/ada/","/home/ada","dir"],
]

describe('paths model', () => {
  it.each(GUEST)('from %s, %s resolves like the guest', (cwd, typed, absolute, status) => {
    const r = resolvePath(cwd, typed, params)
    if ('error' in r) throw new Error(r.error)
    expect(r.absolute).toBe(absolute)
    expect(r.status).toBe(status)
  })

  it('shows one step per name and ends on the result', () => {
    const r = resolvePath('/home/mira/studio', 'builds/../pixel-raiders', params)
    if ('error' in r) throw new Error(r.error)
    expect(r.steps.map((s) => [s.token, s.path])).toEqual([
      ['/home/mira/studio', '/home/mira/studio'],
      ['builds', '/home/mira/studio/builds'],
      ['..', '/home/mira/studio'],
      ['pixel-raiders', '/home/mira/studio/pixel-raiders'],
    ])
    expect(r.kind).toBe('relative')
  })

  it('tells absolute, relative and tilde paths apart', () => {
    const kind = (t: string) => (resolvePath('/tmp', t, params) as { kind: string }).kind
    expect(kind('/etc')).toBe('absolute')
    expect(kind('x/y')).toBe('relative')
    expect(kind('~jonas')).toBe('tilde')
    expect(kind('~bob')).toBe('relative')
    expect(kind('a~')).toBe('relative')
  })

  it('expands only a leading tilde', () => {
    expect(expandTilde('~/x', params)).toMatchObject({ word: '/home/mira/x', home: '/home/mira' })
    expect(expandTilde('~ada', params)).toMatchObject({ word: '/home/ada' })
    expect(expandTilde('~bob', params)).toEqual({ word: '~bob' })
    expect(expandTilde('x/~', params)).toEqual({ word: 'x/~' })
    expect(expandTilde('~+', params)).toHaveProperty('error')
  })

  it('says unknown, not missing, under a directory the tree shows only in part', () => {
    const r = resolvePath('/home/mira', '/etc/passwd', params)
    if ('error' in r) throw new Error(r.error)
    expect(r.status).toBe('unknown')
    const deep = resolvePath('/home/mira', '/tmp/x/y', params)
    expect((deep as { status: string }).status).toBe('unknown')
  })

  it('rejects empty input and words with spaces', () => {
    expect(resolvePath('/tmp', '  ', params)).toHaveProperty('error')
    expect(resolvePath('/tmp', 'a b', params)).toHaveProperty('error')
  })

  it('has tasks that a sensible answer solves and a wrong style does not', () => {
    const [up, tilde] = params.tasks
    expect(matchesTask('../../../builds', up!.cwd, up!, params)).toBe(true)
    expect(matchesTask('/home/mira/studio/builds', up!.cwd, up!, params)).toBe(false)
    expect(matchesTask('~jonas', tilde!.cwd, tilde!, params)).toBe(true)
    expect(matchesTask('/home/jonas', tilde!.cwd, tilde!, params)).toBe(false)
    for (const t of params.tasks) {
      const goal = resolvePath(t.cwd, t.goal, params)
      expect((goal as { status: string }).status).not.toBe('missing')
    }
  })
})
