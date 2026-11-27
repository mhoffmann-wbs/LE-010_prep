import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { childrenOf, depthOf, flatten, isRight, parentOf, paramsSchema } from './model'

const params = paramsSchema.parse(JSON.parse(readFileSync('src/content/sims/filesystem.json', 'utf8')).params)

// Every listing in the content file was run in the guest as mira (Debian 12,
// the same image the learner gets); this is what it printed.
const GUEST: Record<string, string> = {
  'ls / | head -5': 'bin\nboot\ndev\netc\nhome',
  'readlink /bin': 'usr/bin',
  'readlink /sbin': 'usr/sbin',
  'readlink /lib': 'usr/lib',
  'ls /lib/modules': '6.1.0-56-686',
  'ls /boot | grep vmlinuz': 'vmlinuz-6.1.0-56-686',
  "stat -c '%F' /dev/null": 'character special file',
  'df --output=fstype /dev | tail -1': 'devtmpfs',
  'cat /etc/hostname': 'tuxpixel',
  'ls /etc | head -3': 'adduser.conf\nalternatives\napparmor.d',
  'echo /home/*': '/home/ada /home/jonas /home/mira',
  'cat /proc/1/comm': 'le-init',
  'df --output=fstype /proc | tail -1': 'proc',
  "stat -c '%A %U' /root": 'drwx------ root',
  'df --output=fstype /run | tail -1': 'tmpfs',
  'ls /sys/class/net': 'lo',
  'df --output=fstype /sys | tail -1': 'sysfs',
  "stat -c '%A' /tmp": 'drwxrwxrwt',
  'df --output=fstype /tmp | tail -1': 'tmpfs',
  'ls /usr | head -4': 'bin\ngames\ninclude\nlib',
  'command -v tar gzip': '/usr/bin/tar\n/usr/bin/gzip',
  'ls /usr/sbin/useradd': '/usr/sbin/useradd',
  'echo $PATH': '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games',
  "ls /usr/share | grep -E '^(doc|man)$'": 'doc\nman',
  'ls /usr/share/doc | head -3': 'adduser\napt\nbase-files',
  'ls /var | head -4': 'backups\ncache\nlib\nlocal',
  'ls /var/log | head -3': 'alternatives.log\napt\nbtmp',
  "stat -c '%A' /var/tmp": 'drwxrwxrwt',
  'df --output=fstype /var/tmp | tail -1': '9p',
}

describe('filesystem model', () => {
  it('shows exactly the listings that were recorded in the guest', () => {
    const shown = params.directories.flatMap((d) => d.examples.map((e) => [e.command, e.output]))
    expect(Object.fromEntries(shown)).toEqual(GUEST)
  })

  it('lists parents before children, once each, starting at the root', () => {
    expect(params.directories[0]!.path).toBe('/')
    const seen = new Set<string>()
    const problems: string[] = []
    for (const d of params.directories) {
      if (seen.has(d.path)) problems.push(`duplicate ${d.path}`)
      const parent = parentOf(d.path)
      if (parent && !seen.has(parent)) problems.push(`${d.path} before ${parent}`)
      seen.add(d.path)
    }
    expect(problems).toEqual([])
  })

  it('covers the directories the objectives name', () => {
    const paths = params.directories.map((d) => d.path)
    for (const p of ['/', '/bin', '/usr/bin', '/sbin', '/usr/sbin', '/etc', '/dev', '/proc', '/sys', '/boot', '/var/log', '/tmp', '/var/tmp', '/home', '/usr/share/doc']) {
      expect(paths).toContain(p)
    }
  })

  it('marks /proc, /sys and /dev as pseudo, and /home and /var/log as disk', () => {
    const storage = (p: string) => params.directories.find((d) => d.path === p)!.storage
    expect(['/proc', '/sys', '/dev'].map(storage)).toEqual(['pseudo', 'pseudo', 'pseudo'])
    expect(['/home', '/var/log', '/var/tmp', '/etc'].map(storage)).toEqual(['disk', 'disk', 'disk', 'disk'])
    expect(storage('/run')).toBe('ram')
  })

  it('records the Debian 12 symbolic links', () => {
    const link = (p: string) => params.directories.find((d) => d.path === p)!.linkTo
    expect([link('/bin'), link('/sbin'), link('/lib')]).toEqual(['/usr/bin', '/usr/sbin', '/usr/lib'])
    expect(link('/usr/bin')).toBeUndefined()
  })

  it('computes depth, parents and children', () => {
    expect(depthOf('/')).toBe(0)
    expect(depthOf('/var/log')).toBe(2)
    expect(parentOf('/var/log')).toBe('/var')
    expect(parentOf('/etc')).toBe('/')
    expect(childrenOf(params, '/var').map((d) => d.path)).toEqual(['/var/log', '/var/tmp'])
    expect(flatten(params)).toHaveLength(params.directories.length)
  })

  it('has quiz questions whose options and answer are directories on the map, with the answer among the options', () => {
    const paths = new Set(params.directories.map((d) => d.path))
    for (const q of params.quiz) {
      expect(q.options).toContain(q.answer)
      expect(new Set(q.options).size).toBe(q.options.length)
      for (const o of q.options) expect(paths.has(o), `${q.text}: ${o}`).toBe(true)
      expect(isRight(q, q.answer)).toBe(true)
      expect(isRight(q, q.options.find((o) => o !== q.answer)!)).toBe(false)
    }
  })

  it('varies the correct answer across the quiz', () => {
    const answers = new Set(params.quiz.map((q) => q.answer))
    expect(answers.size).toBeGreaterThanOrEqual(10)
  })
})
