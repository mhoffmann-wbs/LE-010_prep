// Builds the script that runs one command in the guest, shared by the browser
// runner (src/vm/runner.ts), content:verify (Docker) and the v86 spot check, so
// all three run exactly the same thing. The script runs as root: it applies the
// fixture, then runs the command as the user in their home directory under a
// pseudo-terminal 80 columns wide, as the learner's terminal would (`ls` prints
// columns, stderr is mixed into stdout).
//
// Scripts import this file with Node, so runtime imports carry their extension.
import type { Fixture } from '../content/fixture'
import { stripAnsi } from './config.ts'

/** Every fixture file gets this time, so `ls -l` prints the same thing on every run. */
export const FIXTURE_TIME = '2026-11-02 09:30'

/** Bump when the job script changes in a way the text below doesn't show. */
export const JOB_VERSION = 1

/** Seconds a command may run before it's killed. */
export const JOB_TIMEOUT_S = 10

export const DEFAULT_USER = 'mira'

/** Fixture users and the guest's own; anything else would fail at chown. */
export const USERS = ['root', 'mira', 'jonas', 'ada'] as const
export type User = (typeof USERS)[number]

export type Job = {
  command: string
  /** Defaults to mira. */
  user?: User
  fixture?: Fixture
}

const home = (user: string) => (user === 'root' ? '/root' : `/home/${user}`)

/** Single-quotes a string for bash. */
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** UTF-8 safe base64, in Node and the browser. */
export function toBase64(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
}

/** The owner a path gets when the fixture doesn't say: the user whose home it's in, else root. */
export function defaultOwner(path: string): User {
  const m = /^\/home\/([^/]+)/.exec(path)
  return m && (USERS as readonly string[]).includes(m[1]!) ? (m[1] as User) : 'root'
}

/** Exit status of a job whose fixture failed, so runners can tell it from the command's own. */
export const FIXTURE_FAILED = 125

/** Shell lines that create the fixture's groups and files, then run its setup steps. */
export function fixtureScript(fixture: Fixture): string {
  const lines: string[] = []
  for (const g of fixture.groups) {
    lines.push(`getent group ${g.name} > /dev/null || groupadd ${g.name}`)
    for (const m of g.members) lines.push(`usermod -aG ${g.name} ${m}`)
  }
  for (const e of fixture.entries) {
    const owner = e.owner ?? defaultOwner(e.path)
    const group = e.group ?? owner
    const p = shellQuote(e.path)
    // Missing parents belong to the entry's owner; existing ones stay as they are.
    for (const dir of ancestors(e.path)) lines.push(`[ -d ${shellQuote(dir)} ] || { mkdir ${shellQuote(dir)} && chown ${owner}:${group} ${shellQuote(dir)}; }`)
    if (e.type === 'dir') lines.push(`mkdir -p ${p}`)
    else if (e.type === 'symlink') lines.push(`ln -sfn ${shellQuote(e.target!)} ${p}`)
    else lines.push(`base64 -d > ${p} <<'LE_EOF'`, toBase64(e.content ?? ''), 'LE_EOF')
    lines.push(`chown -h ${owner}:${group} ${p}`)
    if (e.type !== 'symlink') lines.push(`chmod ${e.mode ?? (e.type === 'dir' ? '755' : '644')} ${p}`)
  }
  for (const step of fixture.setup ?? []) {
    const user = step.user ?? DEFAULT_USER
    lines.push(`(cd ${home(user)} && runuser -u ${user} -- bash -c ${shellQuote(step.run)})`)
  }
  return lines.join('\n')
}

/** "/a/b/c" → ["/a", "/a/b"] */
function ancestors(path: string): string[] {
  const parts = path.split('/').slice(1, -1)
  return parts.map((_, i) => `/${parts.slice(0, i + 1).join('/')}`)
}

/** Debian's /etc/login.defs: what PATH a login shell gets. */
const PATHS = {
  user: '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games',
  root: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
}

/** The whole script for one run, executed by bash as root. */
export function jobScript({ command, user = DEFAULT_USER, fixture }: Job): string {
  const h = home(user)
  return [
    `# le-job v${JOB_VERSION}`,
    `trap 'echo "le-job: fixture failed at line $LINENO"; exit ${FIXTURE_FAILED}' ERR`,
    // Anything the fixture creates or changes is newer than this stamp.
    'touch -d "@$(( $(date +%s) - 2 ))" /run/le-stamp',
    fixture ? fixtureScript(fixture) : '',
    `find /home /root /srv /opt /etc /tmp /var/tmp -newer /run/le-stamp -exec touch -h -d ${shellQuote(FIXTURE_TIME)} {} + 2> /dev/null || true`,
    "cat > /run/le-cmd <<'LE_CMD_EOF'",
    command,
    'LE_CMD_EOF',
    'chmod 644 /run/le-cmd',
    'trap - ERR',
    `cd ${h}`,
    [
      `runuser -u ${user} -- env -i`,
      `HOME=${h} USER=${user} LOGNAME=${user} SHELL=/bin/bash PATH=${user === 'root' ? PATHS.root : PATHS.user}`,
      'LANG=en_US.UTF-8 TERM=xterm-256color',
      // timeout kills the command's whole process group and exits with 124.
      `script -qec 'stty cols 80 rows 24; umask 022; exec timeout -k 1 ${JOB_TIMEOUT_S} bash /run/le-cmd' /dev/null < /dev/null`,
    ].join(' '),
  ]
    .filter(Boolean)
    .join('\n')
}

/** What a run printed, as the learner reads it: no colours, no carriage returns, no final newline. */
export function cleanOutput(raw: string): string {
  return stripAnsi(raw).replace(/\r\n/g, '\n').replace(/\r/g, '').replace(/\n$/, '')
}
