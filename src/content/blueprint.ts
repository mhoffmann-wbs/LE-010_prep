// The Linux Essentials blueprint, verbatim from the objectives v2.0 page (exam
// 010-200, checked 2026-11-24), typos included. Single source of truth for
// topics, objectives, weights, key knowledge areas and terms: mock-exam
// allocation, question targets, readiness and the content tests all derive from
// this file. When the objectives change, update this file first.

export const SOURCES = {
  objectivesUrl: 'https://www.lpi.org/our-certifications/exam-010-objectives/',
  overviewUrl: 'https://www.lpi.org/our-certifications/linux-essentials-overview/',
  changesUrl: 'https://wiki.lpi.org/wiki/Linux_Essentials_Summary_Version_1.6_To_2.0',
  faqUrl: 'https://www.lpi.org/about-lpi/frequently-asked-questions/',
  pricingUrl: 'https://www.lpi.org/exam-pricing/',
  learningMaterialsUrl: 'https://learning.lpi.org/en/learning-materials/010-200/',
  objectivesVersion: '2.0',
  examCode: '010-200',
} as const

/**
 * Checked 2026-11-24.
 * - items, minutes: overview and objectives pages.
 * - scale and pass mark: the LPI FAQ ("Each LPI exam is ranked on a scale from
 *   200 to 800, with a passing score of 500"). The cut is set psychometrically,
 *   so the app's scaled score is always labelled an estimate.
 * - formats: no official LPI page lists them. An LPI-hosted trainer post
 *   (https://www.lpi.org/blog/2026/02/12/how-i-scored-100-on-the-linux-essentials-exam/)
 *   says "multiple choice, multiple response, and short input", about 010-160.
 */
export const EXAM_FORMAT = {
  items: 40,
  minutes: 60,
  scaleMin: 200,
  scaleMax: 800,
  passScore: 500,
  formats: ['multiple choice', 'multiple response', 'short input'],
  previousExam: { code: '010-160', version: '1.6', availableUntil: 'April 2027' },
} as const

/** The app's mock exam: real length and time, one question per weight point. */
export const MOCK = { items: EXAM_FORMAT.items, minutes: EXAM_FORMAT.minutes }

/** Bank items per weight point (PLAN.md §4): 600 in all. */
export const ITEMS_PER_WEIGHT = 15

/** Every key knowledge area needs at least this many items. */
export const MIN_ITEMS_PER_AREA = 5

export interface Topic {
  /** As on the objectives page, e.g. "013". */
  id: string
  title: string
}

export interface Area {
  /** `${objectiveId}.${n}` in page order, e.g. "013.2.3". */
  id: string
  text: string
}

export interface Term {
  /** `${objectiveId}.t${n}` in page order, e.g. "015.4.t3". One per line of the page's list. */
  id: string
  text: string
}

export interface Objective {
  /** As on the objectives page, e.g. "013.2". */
  id: string
  topicId: string
  title: string
  weight: number
  description: string
  /** Key Knowledge Areas. */
  areas: Area[]
  /** "Partial list of the used files, terms and utilities". */
  terms: Term[]
}

export const TOPICS: Topic[] = [
  { id: '011', title: 'The Linux Operating System and Open Source Software' },
  { id: '012', title: 'Command Line Basics' },
  { id: '013', title: 'Data Processing' },
  { id: '014', title: 'Linux System Administration Basics' },
  { id: '015', title: 'Security and Filesystem Permissions' },
]

const objective = (id: string, title: string, weight: number, description: string, areas: string[], terms: string[]): Objective => ({
  id,
  topicId: id.slice(0, 3),
  title,
  weight,
  description,
  areas: areas.map((text, i) => ({ id: `${id}.${i + 1}`, text })),
  terms: terms.map((text, i) => ({ id: `${id}.t${i + 1}`, text })),
})

export const OBJECTIVES: Objective[] = [
  objective(
    '011.1',
    'Linux Distributions',
    2,
    'Candidates should understand commonly used Linux distributions, including their relationship and their major components. This includes various types of releases and support schema.',
    ['Kernel and userspace', 'Linux Distributions', 'Distribution life cycle management', 'Awareness of Android and its relation to Linux'],
    [
      'Debian-based Distributions (Debian GNU/Linux, Ubuntu, Raspberry Pi OS)',
      'Enterprise Linux-based Distributions (Red Hat Enterprise Linux, AlmaLinux, Rocky Linux, Fedora Linux, CentOS Stream)',
      'SUSE-based Distributions (SUSE Linux Enterprise, openSUSE Leap, openSUSE Tumbleweed)',
      'Alpine Linux (main and edge)',
      'Long-Term Support (LTS), stable, testing and unstable releases, and rolling releases, alpha and beta versions',
    ],
  ),
  objective(
    '011.2',
    'Major Open Source Applications',
    2,
    'Candidates should be aware of major open source applications. This includes awareness of the main purpose and key features of the various applications, but no specific details, usage or installation of the applications.',
    ['Desktop applications', 'Web applications', 'Server applications', 'Programming languages', 'Software packages and repositories', 'Package management tools'],
    [
      'LibreOffice, Thunderbird, Firefox, Chromium / Chrome, VSCodium / Visual Studio Code, GIMP, Inkscape, VLC, GPG, R',
      'Nextcloud, ownCloud, Kodi, Jitsi, Big Blue Button, Moodle, Git, GitLab, Forgejo / Gitea',
      'Apache HTTPD, NGINX, MariaDB, MySQL, PostgreSQL, NFS, Samba',
      'C, C++, Java, JavaScript, Python, PHP, Rust, Go',
      'dpkg, apt-get, apt, rpm, dnf, zypper, apk',
    ],
  ),
  objective(
    '011.3',
    'Open Source Software and Licensing',
    1,
    'Candidates should understand the principle of free and open source software and open content. This includes awareness of the main open source software license types as well as Creative Commons. Furthermore, candidates should understand the aspects of proprietary and free software on digital autonomy and digital sovereignty.',
    ['Open source philosophy', 'Open source and open content licensing', 'Proprietary software', 'Free software'],
    [
      'Copyleft, Permissive',
      'GPL, BSD Licenses',
      'Creative Commons',
      'Free Software, Open Source Software',
      'Digital autonomy',
      'Digital sovereignty',
      'Free Software Foundation (FSF)',
      'Open Source Initiative (OSI)',
    ],
  ),
  objective(
    '011.4',
    'Linux Usage',
    2,
    'Candidates should understand major types of computers that are commonly used to run Linux. Candidates should be aware of system administration utilities, including text editors and configuration management tools. The actual usage of editors and configuration management tools is not covered in this objective. Furthermore, candidates should understand fundamental security measures when using computers and network services.',
    [
      'Understanding types of computers that can run Linux',
      'Awareness of virtualization, containers and cloud computing',
      'Awareness of common text editors',
      'Awareness of configuration management tools',
      'Secure handling of credentials',
      'Secure transfer and storage of data',
    ],
    [
      'Desktop computers, laptops and other mobile devices',
      'Server computers, virtual machines and cloud instances',
      'Embedded systems and HPC clusters',
      'Client and server roles',
      'vi, nano',
      'Strong password, password managers, multi-factor authentication, passkeys',
      'Encryption in network protocols (HTTPS), storage media',
      'Secure handling of USB devices',
    ],
  ),
  objective(
    '012.1',
    'Command Line Usage',
    3,
    'Candidates should be able to use the Linux command line. This includes using commands, variables and quoting. Candidates should understand the principles of build-in commands and executable files, including common locations for executable files in the Linux filesystem.',
    ['Basic shell', 'Command line syntax', 'Variables', 'Quoting'],
    ['Bash', 'echo', 'history', 'PATH environment variable', 'export', 'type', '/bin, /usr/bin, /usr/sbin, /sbin'],
  ),
  objective(
    '012.2',
    'Documentation, Man Pages and Usage Information',
    2,
    'Candidates should be able to leverage documentation provided on a Linux system. This includes using man pages as well as running commands with common parameters to display usage information. Furthermore, candidates should be aware of important filesystem locations containing documentation and example files.',
    ['Man pages', 'Common help parameters of command line tools'],
    ['man', '-h, --help', '/usr/share/doc/'],
  ),
  objective(
    '012.3',
    'Files, Directories and Paths',
    2,
    'Candidates should understand the Linux filesystem, including commands to navigate to specific directories and list the content of directories. Candidates should understand the concepts of absolute and relative paths, hidden files and directories as well as home directories.',
    ['Files, directories', 'Hidden files and directories', 'Home directories', 'Absolute and relative paths', 'Searching for files based on file names'],
    ['Common options for ls', 'Recursive listings', 'cd', '. and ..', '/', '/home and ~', 'find'],
  ),
  objective(
    '012.4',
    'File and Directory Management',
    2,
    'Candidates should be able to create, copy, move and rename files and directories. This includes simple use of wildcards and shell globbing.',
    ['Files and directories', 'Case sensitivity', 'Simple globbing'],
    ['mv, cp, rm, touch', 'mkdir, rmdir'],
  ),
  objective(
    '013.1',
    'File Archives and Compression',
    2,
    'Candidates should be able to create, list and extract file archives in the TAR and ZIP formats. Furthermore, Candidates should be able to compress files, including using compressed file archives.',
    ['Files, directories', 'Archives, compression'],
    ['tar', 'Common tar options', 'gzip, bzip2, xz', 'zip, unzip'],
  ),
  objective(
    '013.2',
    'Redirections and String Processing',
    3,
    'Candidates should be able to use I/O redirection on the command line. This includes writing data to files, reading data from files as well as passing data between commands. Furthermore Candidates should be able to use common text processing tools, including using simple regular expressions to filter and process text files.',
    ['Command line pipes', 'I/O redirection', 'Regular Expressions using ., [ ], *, and ? in Extended Regular Expression syntax'],
    ['grep, grep -E', 'less', 'cat, head, tail', 'sort', 'uniq', 'cut', 'wc'],
  ),
  objective(
    '013.3',
    'Shell Scripting Basics',
    4,
    'Candidates should be able to write simple shell scripts. This includes using setting and displaying variables, conditions to check file existence and variable quality as well as using for loops.',
    ['Basic shell scripting'],
    [
      '#! (shebang)',
      '/bin/bash',
      'Variables',
      'Arguments',
      'if conditions (file existence and variable equality)',
      'for loops (iterate over space separated lists and file glob expressions)',
      'echo',
      'Exit status',
    ],
  ),
  objective(
    '014.1',
    'Linux Installation and Provisioning',
    1,
    'Candidates should understand the installation of Linux on a physical computer, a virtual machine and the provisioing of Linux in cloud instances. This includes awareness of dual boot setups as well as key differentiators to other operating systems and Linux compatibility of other operating systems.',
    ['Differences between Windows, macOS and Linux', 'Installing Linux on a computer or in a virtual machine', 'Using Linux in cloud instances'],
    ['Installation media, ISO files', 'Operating system images', 'Dual boot', 'Windows Subsystem for Linux'],
  ),
  objective(
    '014.2',
    'Computer Hardware and Device Access',
    2,
    'Candidates should understand the major components of a computer. Furthermore, candidates should understand how the Linux kernel manages hardware support and how device files are used to access hardware. This includes relevant filesystem paths as well as important pseudo-devices.',
    ['Hardware', 'Device files for physical and virtual devices'],
    [
      'Motherboards, processors (x86, ARM), memory, power supplies, optical drives, peripherals',
      'Network interface cards (Ethernet, WiFi)',
      'Block storage (Hard drives, solid state disks and partitions, /dev/sd*, /dev/nvme*)',
      'Raspberry Pi',
      'Drivers and Kernel Modules',
      '/dev/, /boot/, /sys/',
      '/dev/null, /dev/zero, /dev/urandom',
    ],
  ),
  objective(
    '014.3',
    'Processes and Log Messages',
    3,
    'Candidates should understand the concepts of processes on Linux. That includes listing running processes and determining resource consumption of processes. Candidates should also be able to start, stop and query systemd service units. Furthermore, Candidates should be able to retrieve log messages from the systemd journal, log files and the kernel ring buffer.',
    ['Programs and configuration', 'Processes', 'Services', 'Logging and systemd Journal'],
    ['ps, top, free', 'systemctl (start, stop, status)', 'journalctl, dmesg', '/etc/', '/var/log/', '/proc/'],
  ),
  objective(
    '014.4',
    'Network Configuration',
    2,
    'Candidates should understand the principles of IP networks, including the Internet, IPv4 and IPv6 addresses, routing and name resolution. Candidates should be able to query the network configuration of a Linux system and have a fundamental understanding of automatic network configuration, as well as basic network troubleshooting competencies.',
    ['Internet, network, routers', 'Querying DNS client configuration', 'Querying network configuration', 'Automatic network configuration'],
    [
      'ip route show, ip -6 route show',
      'ip addr show',
      'ss',
      '/etc/resolv.conf, /etc/hosts, resolvectl',
      'IPv4, IPv6',
      'DHCP, SLAAC, DHCPv6',
      'ping',
      'host',
    ],
  ),
  objective(
    '015.1',
    'Remote Logins, File Transfers and Elevated Permissions',
    2,
    'Candidates should be able to securely log into remote systems for accessing a Linux shell and transferring files using SSH, including using public key authentication. Furthermore, candidates should be able to elevate their privileges in order to perform administrative tasks.',
    [
      'Root and standard users',
      'System users',
      'Executing commands with elevated permissions',
      'Remote logins using SSH',
      'SSH key generation and authentication',
    ],
    ['sudo, su', 'ssh, scp', 'ssh-keygen', '~/.ssh/authorized_keys'],
  ),
  objective(
    '015.2',
    'User and Group Management',
    2,
    'Candidates should understand the concepts of users and groups in Linux. This includes creating users, changing passwords and querying information about users accounts and user sessions. Furthermore, candidates should understand the files that contain the Linux user database.',
    ['User and group commands', 'User IDs'],
    ['/etc/passwd, /etc/shadow, /etc/group, /etc/skel/', 'id, w, last, wtmpdb last', 'useradd, groupadd', 'passwd'],
  ),
  objective(
    '015.3',
    'Filesystem Permissions and Ownership',
    2,
    'Candidates should understand ownership and permissions in the Linux filesystem. This includes querying, interpreting and changing ownership and permissions for files and directories.',
    ['File and directory permissions and ownership'],
    ['ls -l, ls -a', 'chmod, chown'],
  ),
  objective(
    '015.4',
    'Special Directories and Files',
    1,
    'Candidates should understand the special properties of temporary directories and symbolic links. This includes the creation, listing and deletion of symbolic links.',
    ['Using temporary files and directories', 'Symbolic links'],
    ['/tmp/, /var/tmp/ and Sticky Bit', 'ls -d', 'ln -s'],
  ),
]

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]))
export const OBJECTIVE_BY_ID = new Map(OBJECTIVES.map((o) => [o.id, o]))
export const AREA_BY_ID = new Map(OBJECTIVES.flatMap((o) => o.areas.map((a) => [a.id, a] as const)))
export const TERM_BY_ID = new Map(OBJECTIVES.flatMap((o) => o.terms.map((t) => [t.id, t] as const)))

export const objectivesOf = (topicId: string) => OBJECTIVES.filter((o) => o.topicId === topicId)

/** A topic's weight: the sum of its objectives' weights (7 · 9 · 9 · 8 · 7). */
export const topicWeight = (topicId: string) => objectivesOf(topicId).reduce((n, o) => n + o.weight, 0)

/** Mock-exam questions per objective: one per weight point, like LPI's "one question per weighting". */
export const mockQuota = (objectiveId: string) => OBJECTIVE_BY_ID.get(objectiveId)?.weight ?? 0

/** Question target per objective (PLAN.md §4): 15 per weight point. */
export const questionTarget = (objectiveId: string) => mockQuota(objectiveId) * ITEMS_PER_WEIGHT

export const BANK_TARGET = OBJECTIVES.reduce((n, o) => n + questionTarget(o.id), 0)

/**
 * The share of questions the app treats as the pass mark. LPI sets the cut
 * psychometrically and doesn't publish it as a percentage, so this is the app's
 * own, deliberately strict assumption (the AIF and CCDV-F apps' pass marks sit
 * near two thirds too). Always label the scaled score an estimate.
 */
export const ASSUMED_PASS_FRACTION = 2 / 3

/**
 * Scaled-score estimate from the share of correct answers: linear from 200 to
 * 500 up to the assumed pass fraction, then linear from 500 to 800.
 */
export function estimateScaledScore(fraction: number): number {
  const { scaleMin, scaleMax, passScore } = EXAM_FORMAT
  const f = Math.min(1, Math.max(0, fraction))
  const scaled =
    f < ASSUMED_PASS_FRACTION
      ? scaleMin + (f / ASSUMED_PASS_FRACTION) * (passScore - scaleMin)
      : passScore + ((f - ASSUMED_PASS_FRACTION) / (1 - ASSUMED_PASS_FRACTION)) * (scaleMax - passScore)
  return Math.round(scaled)
}
