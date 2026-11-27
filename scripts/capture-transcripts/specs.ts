// What `npm run transcripts:capture` runs (PLAN.md §6a). Each spec lists setup
// commands (run first, output not kept but listed in the transcript) and the
// steps whose output the simulators replay. A step's `dialogue` answers prompts
// in order: [text the program prints, what the user types]. Step keys are what
// the simulators refer to, so keep them when changing a spec.

export const NETWORK = {
  name: 'le-cap-net',
  domain: 'tuxpixel.example',
  subnet: '192.0.2.0/24',
  gateway: '192.0.2.1',
  subnet6: '2001:db8:1::/64',
  gateway6: '2001:db8:1::1',
  dns: '192.0.2.53',
}

interface Host {
  /** `debian`: the capture image with systemd; `plain`: another distribution's image, idle, used as root. */
  kind: 'debian' | 'plain'
  image: string
  hostname: string
  ip: string
  ip6: string
}

export const HOSTS = {
  /** Mira's laptop. */
  tuxpixel: { kind: 'debian', image: 'le010/capture', hostname: 'tuxpixel', ip: '192.0.2.10', ip6: '2001:db8:1::10' },
  /** The studio's build server. */
  build: { kind: 'debian', image: 'le010/capture', hostname: 'build', ip: '192.0.2.20', ip6: '2001:db8:1::20' },
  fedora: { kind: 'plain', image: 'fedora:43', hostname: 'fedora', ip: '192.0.2.101', ip6: '2001:db8:1::101' },
  alma: { kind: 'plain', image: 'almalinux:10', hostname: 'alma', ip: '192.0.2.102', ip6: '2001:db8:1::102' },
  opensuse: { kind: 'plain', image: 'opensuse/leap:16.0', hostname: 'opensuse', ip: '192.0.2.103', ip6: '2001:db8:1::103' },
  alpine: { kind: 'plain', image: 'alpine:3.22', hostname: 'alpine', ip: '192.0.2.104', ip6: '2001:db8:1::104' },
} satisfies Record<string, Host>

export type HostName = keyof typeof HOSTS

export interface Command {
  host: HostName
  user: string
  command: string
  /** Relative to the user's home, e.g. "~/builds". */
  cwd?: string
  dialogue?: [prompt: string, reply: string][]
}

export interface Step extends Command {
  key: string
}

export interface Spec {
  id: string
  description: string
  /** Notes on this capture beyond the shared ones. */
  environment: string[]
  setup: Command[]
  steps: Step[]
}

const SUDO: [string, string] = ['[sudo] password for mira: ', 'tuxpixel']

const GAME_SERVER = `#!/bin/bash
# Stand-in for the Pixel Raiders game server: it reads its settings and stays running.
conf=/etc/pixel-raiders/server.conf
if [ ! -r "$conf" ]; then
  echo "pixel-raiders-server: cannot read $conf" >&2
  exit 1
fi
. "$conf"
echo "Pixel Raiders server 1.1: map $MAP, up to $MAX_PLAYERS players"
while sleep 30; do echo "players online: 0"; done
`

const GAME_UNIT = `[Unit]
Description=Pixel Raiders game server
After=network.target

[Service]
User=pixelraiders
ExecStart=/usr/local/bin/pixel-raiders-server

[Install]
WantedBy=multi-user.target
`

const root = (host: HostName, command: string): Command => ({ host, user: 'root', command })
const write = (host: HostName, path: string, text: string, mode = '644'): Command =>
  root(host, `cat > ${path} <<'LE_EOF'\n${text}LE_EOF\nchmod ${mode} ${path}`)

export const SPECS: Spec[] = [
  {
    id: 'services',
    description: 'Mira checks nginx and the Pixel Raiders game server on the build server with systemctl, reads their logs with journalctl and /var/log/syslog, and looks at the kernel messages with dmesg.',
    environment: [
      'rsyslog was installed so that /var/log/syslog exists; since Debian 12 it is no longer installed by default, and the systemd journal keeps the logs.',
      'The game server is a stand-in script (see the setup), so its log lines are what that script prints.',
    ],
    setup: [
      root('build', 'useradd --system --no-create-home --shell /usr/sbin/nologin pixelraiders && mkdir -p /etc/pixel-raiders'),
      write('build', '/usr/local/bin/pixel-raiders-server', GAME_SERVER, '755'),
      write('build', '/etc/systemd/system/pixel-raiders-server.service', GAME_UNIT),
      root('build', 'systemctl daemon-reload'),
      { host: 'build', user: 'mira', command: "cat > server.conf <<'LE_EOF'\nMAP=lava-caves\nMAX_PLAYERS=8\nLE_EOF" },
    ],
    steps: [
      { key: 'status-nginx', host: 'build', user: 'mira', command: 'systemctl status nginx' },
      { key: 'stop-nginx', host: 'build', user: 'mira', command: 'sudo systemctl stop nginx', dialogue: [SUDO] },
      { key: 'status-nginx-stopped', host: 'build', user: 'mira', command: 'systemctl status nginx' },
      { key: 'start-nginx', host: 'build', user: 'mira', command: 'sudo systemctl start nginx' },
      { key: 'is-active-nginx', host: 'build', user: 'mira', command: 'systemctl is-active nginx' },
      { key: 'start-game', host: 'build', user: 'mira', command: 'sudo systemctl start pixel-raiders-server' },
      { key: 'status-game-failed', host: 'build', user: 'mira', command: 'systemctl status pixel-raiders-server' },
      { key: 'journal-game', host: 'build', user: 'mira', command: 'sudo journalctl -u pixel-raiders-server' },
      { key: 'copy-config', host: 'build', user: 'mira', command: 'sudo cp server.conf /etc/pixel-raiders/' },
      { key: 'restart-game', host: 'build', user: 'mira', command: 'sudo systemctl restart pixel-raiders-server' },
      { key: 'status-game', host: 'build', user: 'mira', command: 'systemctl status pixel-raiders-server' },
      { key: 'enable-game', host: 'build', user: 'mira', command: 'sudo systemctl enable pixel-raiders-server' },
      { key: 'is-enabled-game', host: 'build', user: 'mira', command: 'systemctl is-enabled pixel-raiders-server' },
      { key: 'journal-boot', host: 'build', user: 'mira', command: 'sudo journalctl -b | head -n 12' },
      { key: 'syslog', host: 'build', user: 'mira', command: 'sudo tail -n 6 /var/log/syslog' },
      { key: 'dmesg-mira', host: 'build', user: 'mira', command: 'dmesg' },
      { key: 'dmesg', host: 'build', user: 'mira', command: 'sudo dmesg | head -n 8' },
    ],
  },
  {
    id: 'ssh',
    description: 'Mira makes an SSH key on her laptop, logs in to the build server with her password, installs her key with ssh-copy-id, logs in with the key, copies a release with scp, and sees what happens when her private key is readable by others.',
    environment: ['Mira leaves the key passphrase empty so the capture can log in unattended; a passphrase protects the key if the laptop is stolen.'],
    setup: [
      { host: 'tuxpixel', user: 'mira', command: 'head -c 300000 /dev/urandom > pixel-raiders-1.1.tar.gz' },
      { host: 'build', user: 'mira', command: 'mkdir builds' },
    ],
    steps: [
      {
        key: 'keygen',
        host: 'tuxpixel',
        user: 'mira',
        command: 'ssh-keygen -t ed25519',
        dialogue: [
          ['(/home/mira/.ssh/id_ed25519): ', ''],
          ['(empty for no passphrase): ', ''],
          ['same passphrase again: ', ''],
        ],
      },
      { key: 'ls-ssh', host: 'tuxpixel', user: 'mira', command: 'ls -l ~/.ssh' },
      { key: 'cat-pub', host: 'tuxpixel', user: 'mira', command: 'cat ~/.ssh/id_ed25519.pub' },
      {
        key: 'first-login',
        host: 'tuxpixel',
        user: 'mira',
        command: 'ssh build.tuxpixel.example',
        dialogue: [
          ['(yes/no/[fingerprint])? ', 'yes'],
          ['password: ', 'tuxpixel'],
          ['$ ', 'hostname'],
          ['$ ', 'exit'],
        ],
      },
      { key: 'known-hosts', host: 'tuxpixel', user: 'mira', command: 'cat ~/.ssh/known_hosts' },
      { key: 'copy-id', host: 'tuxpixel', user: 'mira', command: 'ssh-copy-id build.tuxpixel.example', dialogue: [['password: ', 'tuxpixel']] },
      { key: 'key-login', host: 'tuxpixel', user: 'mira', command: 'ssh build.tuxpixel.example hostname' },
      { key: 'authorized-keys', host: 'build', user: 'mira', command: 'cat ~/.ssh/authorized_keys' },
      { key: 'ls-authorized', host: 'build', user: 'mira', command: 'ls -la ~/.ssh' },
      { key: 'scp', host: 'tuxpixel', user: 'mira', command: 'scp pixel-raiders-1.1.tar.gz build.tuxpixel.example:builds/' },
      { key: 'scp-check', host: 'tuxpixel', user: 'mira', command: 'ssh build.tuxpixel.example ls -l builds' },
      { key: 'key-open', host: 'tuxpixel', user: 'mira', command: 'chmod 644 ~/.ssh/id_ed25519' },
      { key: 'login-key-open', host: 'tuxpixel', user: 'mira', command: 'ssh build.tuxpixel.example hostname', dialogue: [['password: ', 'tuxpixel']] },
      { key: 'key-fix', host: 'tuxpixel', user: 'mira', command: 'chmod 600 ~/.ssh/id_ed25519' },
      { key: 'login-key-fixed', host: 'tuxpixel', user: 'mira', command: 'ssh build.tuxpixel.example hostname' },
    ],
  },
  {
    id: 'network',
    description: "Mira reads her laptop's network setup: addresses, routes, listening ports, name resolution, and pings to the build server.",
    environment: [
      'net-tools (ifconfig, route and netstat, which exam 010-160 lists) was installed for the capture; iproute2 (ip and ss) replaces it.',
      'The laptop runs nginx and the OpenSSH server, so ss and netstat have something to list.',
    ],
    setup: [root('build', 'true')],
    steps: [
      { key: 'ip-addr', host: 'tuxpixel', user: 'mira', command: 'ip addr show' },
      { key: 'ip-route', host: 'tuxpixel', user: 'mira', command: 'ip route show' },
      { key: 'ip6-route', host: 'tuxpixel', user: 'mira', command: 'ip -6 route show' },
      { key: 'ss', host: 'tuxpixel', user: 'mira', command: 'ss -tulpn' },
      { key: 'ss-sudo', host: 'tuxpixel', user: 'mira', command: 'sudo ss -tulpn', dialogue: [SUDO] },
      { key: 'resolv-conf', host: 'tuxpixel', user: 'mira', command: 'cat /etc/resolv.conf' },
      { key: 'hosts', host: 'tuxpixel', user: 'mira', command: 'cat /etc/hosts' },
      { key: 'resolvectl', host: 'tuxpixel', user: 'mira', command: 'resolvectl status' },
      { key: 'host-build', host: 'tuxpixel', user: 'mira', command: 'host build.tuxpixel.example' },
      { key: 'host-reverse', host: 'tuxpixel', user: 'mira', command: 'host 192.0.2.20' },
      { key: 'host-debian', host: 'tuxpixel', user: 'mira', command: 'host www.debian.org' },
      { key: 'ping', host: 'tuxpixel', user: 'mira', command: 'ping -c 3 build.tuxpixel.example' },
      { key: 'ping6', host: 'tuxpixel', user: 'mira', command: 'ping -c 2 2001:db8:1::20' },
      { key: 'ping-missing', host: 'tuxpixel', user: 'mira', command: 'ping -c 2 files.tuxpixel.example' },
      { key: 'ifconfig', host: 'tuxpixel', user: 'mira', command: 'ifconfig' },
      { key: 'ifconfig-path', host: 'tuxpixel', user: 'mira', command: '/sbin/ifconfig' },
      { key: 'route', host: 'tuxpixel', user: 'mira', command: '/sbin/route -n' },
      { key: 'netstat', host: 'tuxpixel', user: 'mira', command: 'sudo netstat -tulpn' },
    ],
  },
  {
    id: 'users',
    description: 'On the build server, Mira creates an account for Jonas, sets his password, adds him to a new group, and checks who is logged in and who logged in before.',
    environment: [
      'Ada is logged in to the build server over SSH from the laptop during the capture, so w, who and last have a session to show.',
      "wtmpdb and libpam-wtmpdb were installed. Debian 13's util-linux no longer provides last; the release notes name wtmpdb as its replacement, and the wtmpdb package also installs a last command.",
    ],
    setup: [
      root('build', 'userdel -r jonas'),
      {
        host: 'tuxpixel',
        user: 'ada',
        command:
          `setsid nohup expect -c 'spawn ssh -tt -o StrictHostKeyChecking=accept-new build.tuxpixel.example; expect {password: }; send "tuxpixel[format %c 13]"; expect {$ }; send "top[format %c 13]"; sleep 3600' < /dev/null > /dev/null 2>&1 & sleep 5`,
      },
    ],
    steps: [
      { key: 'id-mira', host: 'build', user: 'mira', command: 'id' },
      { key: 'useradd', host: 'build', user: 'mira', command: 'sudo useradd -m -s /bin/bash jonas', dialogue: [SUDO] },
      { key: 'passwd-line', host: 'build', user: 'mira', command: 'grep jonas /etc/passwd' },
      { key: 'shadow-denied', host: 'build', user: 'mira', command: 'grep jonas /etc/shadow' },
      { key: 'shadow-new', host: 'build', user: 'mira', command: 'sudo grep jonas /etc/shadow' },
      {
        key: 'passwd',
        host: 'build',
        user: 'mira',
        command: 'sudo passwd jonas',
        dialogue: [
          ['New password: ', 'tuxpixel'],
          ['Retype new password: ', 'tuxpixel'],
        ],
      },
      { key: 'shadow-set', host: 'build', user: 'mira', command: 'sudo grep jonas /etc/shadow' },
      { key: 'groupadd', host: 'build', user: 'mira', command: 'sudo groupadd artists' },
      { key: 'usermod', host: 'build', user: 'mira', command: 'sudo usermod -aG artists jonas' },
      { key: 'group-line', host: 'build', user: 'mira', command: 'grep -E "^(artists|jonas):" /etc/group' },
      { key: 'id-jonas', host: 'build', user: 'mira', command: 'id jonas' },
      { key: 'skel', host: 'build', user: 'mira', command: 'ls -A /etc/skel' },
      { key: 'home-denied', host: 'build', user: 'mira', command: 'ls -A /home/jonas' },
      { key: 'home', host: 'build', user: 'mira', command: 'sudo ls -lA /home/jonas' },
      {
        key: 'su',
        host: 'build',
        user: 'mira',
        command: 'su - jonas',
        dialogue: [
          ['Password: ', 'tuxpixel'],
          ['$ ', 'whoami'],
          ['$ ', 'exit'],
        ],
      },
      {
        key: 'sudo-i',
        host: 'build',
        user: 'mira',
        command: 'sudo -i',
        dialogue: [
          ['# ', 'whoami'],
          ['# ', 'exit'],
        ],
      },
      { key: 'w', host: 'build', user: 'mira', command: 'w' },
      { key: 'who', host: 'build', user: 'mira', command: 'who' },
      { key: 'last', host: 'build', user: 'mira', command: 'last' },
      { key: 'wtmpdb-last', host: 'build', user: 'mira', command: 'wtmpdb last' },
      { key: 'which-last', host: 'build', user: 'mira', command: 'ls -l /usr/bin/last' },
    ],
  },
  {
    id: 'packages',
    description: 'The same job, installing the small tree program, checking it and removing it again, with the package tools of Debian, Fedora, AlmaLinux, openSUSE and Alpine.',
    environment: ['Each distribution ran in its official container image, logged in as root, with the package lists as the image ships them (Debian empties them, so apt update runs first).'],
    setup: [],
    steps: [
      { key: 'apt-update', host: 'tuxpixel', user: 'root', command: 'apt update' },
      { key: 'apt-search', host: 'tuxpixel', user: 'root', command: "apt search --names-only '^tree$'" },
      { key: 'apt-install', host: 'tuxpixel', user: 'root', command: 'apt install -y tree' },
      { key: 'dpkg-l', host: 'tuxpixel', user: 'root', command: 'dpkg -l tree' },
      { key: 'dpkg-files', host: 'tuxpixel', user: 'root', command: 'dpkg -L tree' },
      { key: 'apt-get-remove', host: 'tuxpixel', user: 'root', command: 'apt-get remove -y tree' },
      { key: 'dnf-install', host: 'fedora', user: 'root', command: 'dnf install -y tree' },
      { key: 'rpm-q', host: 'fedora', user: 'root', command: 'rpm -q tree' },
      { key: 'rpm-qf', host: 'fedora', user: 'root', command: 'rpm -qf /usr/bin/tree' },
      { key: 'dnf-remove', host: 'fedora', user: 'root', command: 'dnf remove -y tree' },
      { key: 'yum-install', host: 'alma', user: 'root', command: 'yum install -y tree' },
      { key: 'yum-remove', host: 'alma', user: 'root', command: 'yum remove -y tree' },
      { key: 'yum-is-dnf', host: 'alma', user: 'root', command: 'ls -l /usr/bin/yum' },
      { key: 'zypper-install', host: 'opensuse', user: 'root', command: 'zypper --non-interactive install tree' },
      { key: 'zypper-rpm-q', host: 'opensuse', user: 'root', command: 'rpm -q tree' },
      { key: 'zypper-remove', host: 'opensuse', user: 'root', command: 'zypper --non-interactive remove tree' },
      { key: 'apk-add', host: 'alpine', user: 'root', command: 'apk add tree' },
      { key: 'apk-info', host: 'alpine', user: 'root', command: 'apk info tree' },
      { key: 'apk-del', host: 'alpine', user: 'root', command: 'apk del tree' },
    ],
  },
]
