// npm run transcripts:capture [-- <id> ...]
//
// Runs each transcript spec in specs.ts on real systems and writes what the
// commands printed to src/content/transcripts/<id>.json (PLAN.md §6a). The
// TuxPixel hosts are Debian 13 containers with systemd as PID 1, on a Docker
// network in the documentation ranges, so no address or name needs rewriting.
// Every transcript starts from fresh containers.
//
// Needs Docker. It sets net.core.fb_tunnels_only_for_init_net=2 in Docker
// Desktop's VM, so containers don't show the kernel's fallback tunnel devices
// (tunl0, gre0, …), which a real machine doesn't have; Docker resets it on restart.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Transcript, TranscriptStep } from '../../src/content/transcript'
import { renderScreen } from '../../src/vm/screen.ts'
import { HOSTS, type HostName, NETWORK, SPECS, type Spec, type Step } from './specs.ts'

const ROOT = join(import.meta.dirname, '../..')
const OUT = join(ROOT, 'src/content/transcripts')
const IMAGE = 'le010/capture'
const PREFIX = 'le-cap-'
const COLUMNS = 80

function sh(args: string[], input?: string): { status: number; out: string } {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300_000 })
  if (r.error) throw new Error(`docker ${args.slice(0, 3).join(' ')}…: ${r.error.message}`)
  return { status: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

function must(args: string[], input?: string): string {
  const r = sh(args, input)
  if (r.status !== 0) throw new Error(`docker ${args.join(' ')} failed (${r.status}):\n${r.out}`)
  return r.out
}

/** A Tcl word holding `text` literally. */
function tcl(text: string): string {
  let depth = 0
  for (const ch of text) {
    if (ch === '{') depth++
    if (ch === '}' && --depth < 0) break
  }
  if (depth !== 0 || text.includes('\\')) throw new Error(`can't quote for Tcl: ${text}`)
  return `{${text}}`
}

/** An expect script that runs the command in a login shell on an 80-column pty and answers its prompts. */
function expectScript(step: Step): string {
  const lines = [
    'set timeout 120',
    `set stty_init "rows 40 cols ${COLUMNS}"`,
    `spawn -noecho bash -lc ${tcl(step.command)}`,
  ]
  for (const [prompt, reply] of step.dialogue ?? []) {
    // A braced expect body is a list of pattern-action pairs only when it spans lines.
    lines.push(
      `expect {\n  -exact ${tcl(prompt)} {}\n  timeout { puts "\\nLE-CAPTURE: no prompt ${prompt.replace(/["[\]$\\{}]/g, '')}"; exit 98 }\n  eof { puts "\\nLE-CAPTURE: ended before the prompt"; exit 97 }\n}`,
    )
    lines.push(`after 200`)
    lines.push(`send -- [string cat ${tcl(reply)} "\\r"]`)
  }
  lines.push('expect {\n  eof {}\n  timeout { puts "\\nLE-CAPTURE: timeout"; exit 96 }\n}')
  lines.push('lassign [wait] pid spawnid oserr value')
  lines.push('exit $value')
  return lines.join('\n') + '\n'
}

const container = (host: HostName) => `${PREFIX}${host}`

function home(user: string) {
  return user === 'root' ? '/root' : `/home/${user}`
}

function runStep(step: Step): { output: string; exit: number } {
  const host = HOSTS[step.host]
  const dir = step.cwd ? `${home(step.user)}/${step.cwd.replace(/^~\/?/, '')}` : home(step.user)
  if (host.kind === 'debian') {
    const env = ['HOME=' + home(step.user), `USER=${step.user}`, `LOGNAME=${step.user}`, 'LANG=en_US.UTF-8', 'TERM=xterm-256color', 'SYSTEMD_PAGER=cat', 'DPKG_PAGER=cat']
    const r = sh(['exec', '-i', '-u', step.user, '-w', dir, ...env.flatMap((e) => ['-e', e]), container(step.host), 'expect', '-f', '-'], expectScript(step))
    if (r.status >= 96 && r.status <= 98) throw new Error(`${step.key}: ${r.out}`)
    return { output: renderScreen(r.out), exit: r.status }
  }
  if (step.dialogue) throw new Error(`${step.key}: prompts need a Debian host`)
  const r = sh(['exec', '-t', '-u', step.user, '-w', dir, '-e', 'TERM=xterm-256color', container(step.host), 'sh', '-c', `stty cols ${COLUMNS} rows 40; ${step.command}`])
  return { output: renderScreen(r.out), exit: r.status }
}

function startNetwork() {
  sh(['rm', '-f', ...Object.keys(HOSTS).map((h) => container(h as HostName)), `${PREFIX}dns`])
  sh(['network', 'rm', NETWORK.name])
  must(['network', 'create', '--subnet', NETWORK.subnet, '--gateway', NETWORK.gateway, '--ipv6', '--subnet', NETWORK.subnet6, '--gateway', NETWORK.gateway6, NETWORK.name])
  must(['run', '--rm', '--privileged', '--net=host', 'debian:trixie', 'sh', '-c', 'echo 2 > /proc/sys/net/core/fb_tunnels_only_for_init_net'])
  const records = Object.values(HOSTS)
    .filter((h) => h.kind === 'debian')
    .flatMap((h) => [`--host-record=${h.hostname}.${NETWORK.domain},${h.ip},${h.ip6}`, `--ptr-record=${h.ip.split('.').reverse().join('.')}.in-addr.arpa,${h.hostname}.${NETWORK.domain}`])
  must(['run', '-d', '--rm', '--name', `${PREFIX}dns`, '--network', NETWORK.name, '--ip', NETWORK.dns, IMAGE, 'dnsmasq', '-k', '--no-resolv', '--server=127.0.0.11', '--log-facility=-', ...records])
}

function startHost(name: HostName) {
  const h = HOSTS[name]
  sh(['rm', '-f', container(name)])
  const net = ['--network', NETWORK.name, '--ip', h.ip, '--ip6', h.ip6, '--hostname', h.hostname]
  if (h.kind === 'debian') {
    must(['run', '-d', '--rm', '--name', container(name), ...net, '--domainname', NETWORK.domain, '--privileged', '--cgroupns=private', '--tmpfs', '/run', '--tmpfs', '/run/lock', IMAGE])
    for (let i = 0; ; i++) {
      const state = sh(['exec', container(name), 'systemctl', 'is-system-running']).out.trim()
      if (state === 'running') break
      if (state === 'degraded' || i > 60) throw new Error(`${name}: systemd is ${state}\n${sh(['exec', container(name), 'systemctl', '--failed', '--no-pager']).out}`)
      spawnSync('sleep', ['0.5'])
    }
    // Docker writes /etc/hosts and /etc/resolv.conf at start. Replace them with
    // what a Debian install has: the installer's hosts file, and resolv.conf
    // from systemd-resolved, which forwards to the studio's DNS server.
    const fqdn = `${h.hostname}.${NETWORK.domain}`
    const hosts = `127.0.0.1\tlocalhost\n127.0.1.1\t${fqdn}\t${h.hostname}\n\n# The following lines are desirable for IPv6 capable hosts\n::1     localhost ip6-localhost ip6-loopback\nff02::1 ip6-allnodes\nff02::2 ip6-allrouters\n`
    must(['exec', '-i', container(name), 'sh', '-c', 'cat > /etc/hosts'], hosts)
    must(['exec', container(name), 'sh', '-c', `mkdir -p /etc/systemd/resolved.conf.d && printf '[Resolve]\\nDNS=${NETWORK.dns}\\nDomains=${NETWORK.domain}\\n' > /etc/systemd/resolved.conf.d/tuxpixel.conf && systemctl restart systemd-resolved && cat /run/systemd/resolve/stub-resolv.conf > /etc/resolv.conf`])
  } else {
    must(['run', '-d', '--rm', '--name', container(name), ...net, h.image, 'sleep', 'infinity'])
  }
}

function osName(name: HostName): string {
  return must(['exec', container(name), 'sh', '-c', '. /etc/os-release; echo "$PRETTY_NAME"']).trim()
}

function imageOf(name: HostName): string {
  const h = HOSTS[name]
  if (h.kind === 'debian') {
    const from = /^FROM (\S+)/m.exec(readFileSync(join(import.meta.dirname, 'Dockerfile'), 'utf8'))![1]
    return `${IMAGE}, built by scripts/capture-transcripts/Dockerfile from ${from}`
  }
  return must(['image', 'inspect', '--format', '{{index .RepoDigests 0}}', h.image]).trim()
}

function capture(spec: Spec): Transcript {
  const names = [...new Set([...spec.setup, ...spec.steps].map((s) => s.host))]
  for (const n of names) startHost(n)
  for (const s of spec.setup) {
    const r = runStep({ ...s, key: 'setup' })
    if (r.exit !== 0) throw new Error(`${spec.id} setup failed on ${s.host}: ${s.command}\n${r.output}`)
  }
  const steps: TranscriptStep[] = spec.steps.map((s) => {
    console.log(`  ${s.key}`)
    const r = runStep(s)
    return { key: s.key, host: s.host, user: s.user, cwd: s.cwd ?? '~', command: s.command, output: r.output, exit: r.exit }
  })
  const kernel = must(['exec', container(names[0]!), 'uname', '-r']).trim()
  const hosts = names.map((n) => ({ name: HOSTS[n].hostname, distro: osName(n), image: imageOf(n) }))
  for (const n of names) sh(['rm', '-f', container(n)])
  return {
    id: spec.id,
    description: spec.description,
    captured: new Date().toISOString().slice(0, 10),
    environment: [
      `Each host ran in a Docker container on Docker Desktop (arm64), so the kernel is Docker Desktop's (Linux ${kernel}), not the distribution's.`,
      ...(names.some((n) => HOSTS[n].kind === 'debian') ? ['On the Debian hosts, systemd runs as PID 1, as on a real machine.'] : []),
      `The hosts share a network in documentation address ranges (${NETWORK.subnet} and ${NETWORK.subnet6}, gateway ${NETWORK.gateway}). A dnsmasq container at ${NETWORK.dns} answers for ${NETWORK.domain}.`,
      'Commands ran in a login shell on an 80-column terminal, with the pagers of systemd and dpkg turned off (SYSTEMD_PAGER=cat, DPKG_PAGER=cat).',
      "Sockets on 127.0.0.11 belong to Docker's built-in DNS service, which every container on such a network has.",
      'nginx is set to start 2 worker processes rather than one per CPU, to keep process listings short.',
      ...spec.environment,
    ],
    hosts: hosts.map((h) => ({ ...h, name: h.name })),
    setup: spec.setup.map(({ host, user, command }) => ({ host: HOSTS[host].hostname, user, command })),
    steps: steps.map((s) => ({ ...s, host: HOSTS[s.host as HostName].hostname })),
  }
}

const wanted = process.argv.slice(2)
const specs = wanted.length ? SPECS.filter((s) => wanted.includes(s.id)) : SPECS
if (specs.length === 0) throw new Error(`no spec called ${wanted.join(', ')}`)
console.log('building the capture image…')
must(['build', '-q', '-t', IMAGE, import.meta.dirname])
startNetwork()
try {
  for (const spec of specs) {
    console.log(`${spec.id}:`)
    const t = capture(spec)
    const file = join(OUT, `${spec.id}.json`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(t, null, 2) + '\n')
    console.log(`  wrote ${file}`)
  }
} finally {
  sh(['rm', '-f', ...Object.keys(HOSTS).map((h) => container(h as HostName)), `${PREFIX}dns`])
  sh(['network', 'rm', NETWORK.name])
}
