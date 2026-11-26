# Build Plan: LE-010_prep

An interactive self-study web app for the **LPI Linux Essentials (010-200, objectives v2.0)** exam.
The footer and README say: "Not affiliated with or endorsed by the Linux Professional Institute. Linux Essentials is a trademark of the Linux Professional Institute. Linux® is the registered trademark of Linus Torvalds."

Authoritative sources (where they disagree with this plan, they win):
- Objectives v2.0 (exam 010-200): https://www.lpi.org/our-certifications/exam-010-objectives/
- Certificate overview: https://www.lpi.org/our-certifications/linux-essentials-overview/ (40 questions, 60 minutes, lifetime validity, no prerequisites; English first, translations "within the next few months")
- Changes from v1.6 to v2.0: https://wiki.lpi.org/wiki/Linux_Essentials_Summary_Version_1.6_To_2.0
- LPI FAQ on scoring (scale 200–800, pass at 500, set psychometrically): https://lpi.org/fpp7
- Official learning materials for 010-200: https://learning.lpi.org/en/learning-materials/010-200/ (PDF version 2026-11-19, 409 pages). These are licensed **CC BY-NC-ND 4.0**, so the app links to them and never copies, adapts or translates their text, exercises or answers.

The previous exam, 010-160 (objectives v1.6), can be booked until April 2027. The app covers it as a second exam track (§3b); 010-200 is the main one.
- Objectives v1.6: https://wiki.lpi.org/wiki/Linux_Essentials_Objectives_V1.6 (oldid 5896, checked 2026-11-26)
- Change summary 1.6 → 2.0: https://wiki.lpi.org/wiki/Linux_Essentials_Summary_Version_1.6_To_2.0 (oldid 5912)

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Name | **LE-010_prep**: `github.com/mhoffmann-wbs/LE-010_prep` → `https://mhoffmann-wbs.github.io/LE-010_prep/` |
| Exams | **010-200** (objectives v2.0) is the main exam and the default. **010-160** (v1.6) is selectable through the exam-track switch, as PCEP does with 30-02 (§3b). |
| Audience | English-speaking **beginners**: bootcamp students, career changers and people who have never opened a terminal. Lessons explain everything from scratch. |
| Theme | One invented company, **TuxPixel Studio**, a small indie game studio. The studio runs Linux laptops, a build server, an asset file server, a Raspberry Pi in the office and a few cloud instances. Every scenario, fixture file, hostname, user, log and script belongs to it. All people, games and figures are invented. |
| Pillars | **Learn** (lessons), **Check** (practice, question bank and mock exam), and **Do / Explore**: a real Linux terminal in the browser, auto-graded terminal exercises, concept simulators, matcher drills and flashcards. |
| Granularity | One lesson per **objective** (19). Items carry an objective id and the key knowledge area(s) and terms they test. |
| Item kinds | `single`, `multi`, `fill` (type a command, option, path or value) and `output` (predict what a command prints, checked against real bash). There are no ordering, matching or case items. |
| Bank size | About **600 items**: 15 per weight point (§4). |
| Mock exam | 40 items in 60 minutes, one per weight point. The report shows a scaled-score estimate against 500 on the 200–800 scale. |
| Terminal | **Real Linux in the browser**: the v86 x86 emulator boots a minimal **Debian 12 (bookworm) i386** userland from a saved-state snapshot. It is self-hosted and loaded lazily, like PCEP's Pyodide (§5). |
| Hard-to-emulate topics | systemd, journalctl, ssh/scp, ip/ss, useradd and dmesg are taught with **simulators driven by recorded transcripts** from a real Debian 13 system. Outputs are captured, never invented (§6a). There are no local labs. |
| LPI materials | Every lesson is original and links to the LPI Learning Materials as further reading. learning.lpi.org refuses automated fetches (HTTP 403), so lessons link to the 010-200 index page; per-lesson deep links wait until someone checks the URL pattern in a browser. |
| Stack | Vite, React, TypeScript, Tailwind v4, React Router, Zod, MDX, Vitest with RTL, oxlint, v86 and xterm.js. It's a static SPA: progress lives in `localStorage` and can be exported and imported. |

## 2. Exam facts the app must mirror

| Fact | Value | Source | App consequence |
|---|---|---|---|
| Items | 40 | overview page | The mock has 40 items, one per weight point (§3). |
| Time | 60 min | overview page | Countdown, flag for review and a review screen. |
| Score | Scaled 200–800, pass at 500 | LPI FAQ | LPI doesn't publish the cut as a percentage. The estimate is piecewise linear, with 500 at an **assumed** two thirds correct (`ASSUMED_PASS_FRACTION`), so that a plain 200–800 line doesn't put the pass mark at a lenient 50%. It is always labelled "estimate". The report shows pass/fail and percent by topic and objective. |
| Item kinds | Multiple choice, multiple response and "short input" | **No official LPI page lists them.** The only LPI-hosted statement is a trainer's blog post about 010-160 (link in `EXAM_FORMAT`). | `fill` items mirror short input. `output` items are practice-only by default (§4). The exam-day guide says the formats come from a candidate report. |
| Weights | 19 objectives, weights 1–4, total 40 | objectives page | Weights drive the bank targets, the mock allocation and readiness. |
| Price | Region-tiered: USD 120 / 100 / 80 and EUR 110 (2026-11-24) | https://www.lpi.org/exam-pricing/ | The page maps countries to tiers only in its country picker, so check it in a browser for the exam-day guide. |

## 3. Blueprint → content map

`blueprint.ts` holds the topics and objectives **verbatim** from v2.0: id, title, weight, description, key knowledge areas and the "partial list of used files, terms and utilities".
- Key knowledge areas get ids `<objectiveId>.<n>` in page order (e.g. `013.2.3` = regular expressions).
- Terms get ids `<objectiveId>.t<n>` (e.g. `015.4.t3` = `ln -s`).

| Topic | Objectives (weight) | Weight | Mock | Bank |
|---|---|---|---|---|
| 011 The Linux OS and Open Source Software | 011.1 Distributions (2) · 011.2 Major Open Source Applications (2) · 011.3 Open Source Software and Licensing (1) · 011.4 Linux Usage (2) | 7 | 7 | 105 |
| 012 Command Line Basics | 012.1 Command Line Usage (3) · 012.2 Documentation, Man Pages (2) · 012.3 Files, Directories and Paths (2) · 012.4 File and Directory Management (2) | 9 | 9 | 135 |
| 013 Data Processing | 013.1 Archives and Compression (2) · 013.2 Redirections and String Processing (3) · 013.3 Shell Scripting Basics (4) | 9 | 9 | 135 |
| 014 Linux System Administration Basics | 014.1 Installation and Provisioning (1) · 014.2 Hardware and Device Access (2) · 014.3 Processes and Log Messages (3) · 014.4 Network Configuration (2) | 8 | 8 | 120 |
| 015 Security and Filesystem Permissions | 015.1 Remote Logins, File Transfers, Elevated Permissions (2) · 015.2 Users and Groups (2) · 015.3 Permissions and Ownership (2) · 015.4 Special Directories and Files (1) | 7 | 7 | 105 |

Notes on v2.0 content that is new or easy to get wrong. Check each one against current docs when writing, never from memory:
- 011.1: Alpine (main/edge), AlmaLinux, Rocky, CentOS Stream, Raspberry Pi OS, and release types (LTS, stable, testing, unstable, rolling, alpha/beta).
- 011.2: the package tools `dpkg`, `apt-get`, `apt`, `rpm`, `dnf`, `zypper` and `apk`. Forgejo/Gitea, Jitsi, Big Blue Button and VSCodium are now on the list.
- 011.3: digital autonomy and digital sovereignty.
- 011.4: passkeys, MFA, password managers, secure USB handling, and encryption in HTTPS and on storage media.
- 014.1: WSL, OS images and cloud provisioning.
- 014.3: `systemctl` (start, stop, status), `journalctl` and `dmesg`.
- 014.4: `ip route show`, `ip -6 route show`, `ss`, `resolvectl`, `host`, DHCP, SLAAC and DHCPv6.
- 015.1: `ssh-keygen` and `~/.ssh/authorized_keys`.
- 015.2: `wtmpdb last`.
- 013.2: ERE with `.`, `[ ]`, `*` and `?` only.

## 3b. The 010-160 track

Learners pick their exam on the home page (it can be changed on the progress page). The choice is stored in progress (`track`) and filters practice, the question bank, the mock exam, readiness and the objective lists; lessons show both exams' material and mark the differences.

**Model.** The 19 objectives map one to one (1.1 → 011.1 … 5.4 → 015.4) with the same weights, so there are no extra objectives. Each objective carries its v1.6 id, title and description verbatim. Areas and terms form one list per objective:
- A line both versions list keeps its 2.0 id. When v1.6 only words it differently (the change summary calls it a rename, e.g. "Development languages" → "Programming languages"), it keeps the v1.6 wording as `v16Text`.
- A line only 2.0 lists is tagged `exams: ['010-200']`. A line only v1.6 lists gets its own id (`012.2.v1` "Info pages", `012.2.vt2` "locate") and `exams: ['010-160']`.
- A line whose contents changed (items added or removed, e.g. "syslog, dmesg" vs "journalctl, dmesg") counts as two lines, one per exam.
- Some topics moved objective between versions (distribution life cycles: 4.1 → 011.1; vi and nano: 3.3 → 011.4; /etc/passwd and id/last/who/w: 5.1 → 015.2). Each exam's lines stay under its own objective, so lessons cross-link.

**Items** need no exam field: an item is on an exam when at least one of its areas, and (if it tags terms) one of its terms, is on that exam (`itemInExam`). To put an item on both exams where the versions list a topic on different lines, tag both lines. `bank.test.ts` fails when an item ends up on neither exam.

**Mock exam**: 40 items in 60 minutes on both exams (the v1.6 page says "40 questions in 60 minutes"), one per weight point, drawn from the track's items. Mock results record their exam.

**Lessons** teach 2.0 as the main text. Material only one exam asks about sits in `<ExamOnly exam="…">` blocks: open on that exam's track, collapsed (but readable) on the other. A test requires a block for each exam that has lines of its own in the objective, and `areasCovered`/`termsCovered` list both exams' lines.

**Bank targets** stay 15 per weight point for 010-200; every area of each exam needs 5 items on that exam, and every term of each exam must be tested or taught (`content:status` reports both exams).

## 4. Question bank

**Targets.** 600 items, 15 per weight point: 15 / 30 / 45 / 60 for weights 1 / 2 / 3 / 4. Topic totals are 105 · 135 · 135 · 120 · 105.
- Every key knowledge area needs **at least 5** items.
- Every term in the "used files, terms and utilities" list must be tested by at least one item or taught in the lesson, and a test checks that.
- `questionTarget()` computes the targets and `npm run content:status` shows progress against them. Tests don't enforce the targets.

**Kind mix**: about 60% `single`, 15% `multi`, 15% `fill` and 10% `output`. Shell-heavy objectives (012.x, 013.x and 015.3) carry most of the `fill` and `output` items. Concept objectives (011.x and 014.1) stay mostly `single`/`multi`.

**Item kinds.** A Zod discriminated union on `kind`. Every item shares:
- `id` (`<objectiveId>-NNN`)
- `objectiveId`
- `areas[]`, the knowledge-area ids
- optional `terms[]`
- `stem`
- `explanation`
- optional `sourceLinks[]`

| `kind` | Interaction | Grading |
|---|---|---|
| `single` | Pick 1 of 4. | exact |
| `multi` | Pick N of 5–6. The stem says "(Choose TWO.)". | all-or-nothing |
| `fill` | Type a command, option, path or value. `accept[]` lists every accepted answer explicitly; `normaliseAnswer` trims and collapses whitespace. Answers are case-sensitive unless `caseSensitive: false`. An optional `prefix` is shown before the input, but every accepted answer must still form a working command with it. | match any `accept` |
| `output` | Shows a `command` run as a given user in a given `fixture` state. The learner picks from 4 outputs or types the output (`mode: choice / type`). The key comes from **real bash** (§5c), never from memory. | exact (type mode: trailing whitespace ignored) |

`output` items are on in practice and off in the mock by default. One toggle per mode controls them, as with AIF's extended kinds.

**Authoring rules** (tests enforce the ones marked ✓):
- Scenario stems at TuxPixel Studio: "Mira needs to find every `.png` under `/srv/assets` changed today. Which command…?" There's one defensible answer, and the distractors are real commands or options that miss the stated constraint.
- ✓ No key letter in more than 40% of `single` items. ✓ The key is the longest option in at most 40% of them, and in at least 15%, to fix the AIF bias early. ✓ No duplicate stems.
- ✓ Explanations never name option letters, so options can be reordered.
- ✓ Every `output` key and every `fill` answer that is a runnable command has a verified record (§5c).
- Write every question for this app. Never reproduce live exam content (candidates sign an NDA), third-party dumps, or the LPI learning materials' exercises.

## 5. The in-browser terminal

### 5a. Guest image
- **Debian 12 bookworm i386** is the last Debian release with an i386 kernel and installer, and it has LTS until mid-2028. v86 runs only 32-bit guests, and Debian 13 has no i386 kernel. The userland is bash, GNU coreutils, grep, sed, findutils, less, tar, gzip, bzip2, xz-utils, zip/unzip, man-db with the relevant man pages, file, procps, iproute2 and nano/vim-tiny. There's no systemd as PID 1, because boot time and size matter more.
- `scripts/vm/` builds the rootfs from the digest-pinned `i386/debian:bookworm` Docker image, as v86's own Debian tooling does. It exports the rootfs for v86 (a 9p filesystem; the kernel and initrd load from it), boots it once headless and saves a **state snapshot**, so the learner's terminal restores instead of booting. CI builds it into `public/vm/` (git-ignored) on every deploy.
- The image is deliberately **Debian-only**. Lessons say where RHEL, SUSE or Alpine differ (package tools, `/etc` layout) and show those outputs only through transcripts.
- **Phase 0 spike: go.** These numbers are from 2026-11-24, on an M-series Mac with Chrome and a local server:
  - Guest RAM is 128 MB.
  - A cold boot to mira's prompt takes 10 s; this happens only when the state is built.
  - The state is 12.5 MB with zstd -19.
  - The terminal is ready 0.3–0.4 s after the state downloads. The first page load fetches about 14.7 MB: the state plus the 2 MB `v86.wasm`.
  - The rootfs is 203 MB in about 12,300 files. Files are fetched only when the guest reads them, so the size matters only for the Pages limit of 1 GB.
  - Phone memory is not measured yet; measure it on a real device in the phase 8 mobile pass.
  - The fallback stays Alpine i386 with GNU `coreutils`, `bash`, `grep`, `findutils` and `tar` replacing the BusyBox applets.

### 5b. Runtime
- `src/vm/`: a worker-free client around v86. `VmRunner` queues jobs over a root control channel on the second serial port (le-init answers each with its exit status and base64 output). Every run after the first restores the snapshot, which is a **per-run reset**, and a run that never answers times out. xterm.js renders the interactive terminal.
- **Fixtures** (`src/content/fixtures/<name>.json`): declarative TuxPixel file trees (homes for `mira`, `jonas` and `ada`, `/srv/assets`, build logs, CSV play-test data, scripts) with owners, modes, symlinks, groups and setup steps. `src/vm/job.ts` turns a fixture and a command into one shell script, so the browser and the verifier run exactly the same thing. Commands run as their user under a pty 80 columns wide, as in the terminal.
- Lesson code fences (```` ```bash ````) become runnable, editable cells; fence options set the fixture and user, or `static` for commands the guest can't run. An ```` ```output ```` fence right after one states what it prints. `<Predict>` blocks make the learner guess first, as in PCEP.
- The VM, emulator and xterm stay out of the initial bundle. They load on the first terminal use.

### 5c. Verification: never trust a hand-written output
- Running v86 inside Vitest would be slow. Instead, `npm run content:verify` runs every lesson snippet, `output` item and runnable `fill` answer (later also exercises and flashcard commands) **in the learner's own guest**: v86 in Node, on a few worker threads, through the same runner as lesson cells, with the fixture applied. It records the results in `src/content/verified.json`, keyed by a hash of the job script (command, user, fixture) and the guest recipe.
- `npm test` stays offline and fast: it fails when any claimed output differs from its verified record, or when a record is missing or stale. CI rebuilds the guest and runs `content:verify --all`, so a changed image can't pass.
- The plan was to verify in Docker and spot-check v86 against it. The first spot check found real drift: v86's 9p filesystem lists directories in creation order, Docker's overlay in hash order, so `tar` printed different member orders. Verification therefore runs in v86 itself, and `vm:smoke` checks the runner instead.

## 6. Do / Explore

### 6a. Transcript simulators (`/explore/sims`)
`scripts/capture-transcripts/` runs a list of commands on a real **Debian 13** system (a container with systemd as PID 1, or a VM). It records them into `src/content/transcripts/<id>.json` with the distro, version and capture date. Captured hostnames and users are rewritten to TuxPixel ones, so each transcript is honest about what was rewritten. Simulators replay them:

| Simulator | What the learner does | Objectives |
|---|---|---|
| Service console | Runs `systemctl status/start/stop` on `nginx` and a game-server unit, then reads `journalctl -u`, `journalctl -b` and `dmesg` output | 014.3 |
| SSH key flow | Steps through `ssh-keygen` → copying the key to `authorized_keys` → `ssh` login → `scp`, with the host-key prompt and permission errors | 015.1 |
| Network reader | Reads `ip addr show`, `ip route show`, `ip -6 route show`, `ss -tulpn`, `resolv.conf`, `/etc/hosts`, `resolvectl`, `host` and `ping` output, and answers "what is the gateway / DNS server / listening port?" | 014.4 |
| Users and sessions | `useradd`, `groupadd`, `passwd`, `id`, `w`, `last` and `wtmpdb last`, with the resulting lines in `/etc/passwd`, `/etc/shadow` and `/etc/group` | 015.2 |
| Package tools | The same task (search, install, remove, list) in `apt`, `dnf`, `zypper` and `apk` | 011.2 |

### 6b. Concept simulators
Copy and parameters are data in `src/content/sims/<simId>.json`. The interactive part is one folder per simulator, with pure logic tested in `model.test.ts` (AIF pattern).
- **Permissions calculator**: `rwx` ↔ octal ↔ symbolic `chmod`, with directory vs. file meaning and the sticky bit on `/tmp` (015.3, 015.4).
- **Filesystem map**: an explorable FHS tree (`/bin`, `/usr/bin`, `/sbin`, `/etc`, `/dev`, `/proc`, `/sys`, `/boot`, `/var/log`, `/tmp`, `/var/tmp`, `/home`, `/usr/share/doc`) (012.1, 012.3, 014.2, 014.3).
- **Regex highlighter**: ERE with `.`, `[ ]`, `*` and `?` over a build log, with matches live and the equivalent `grep -E` (013.2).
- **Pipes and redirection**: stdin, stdout and stderr as streams through `|`, `>`, `>>`, `2>`, `2>&1` and `<` (013.2).
- **Archive chooser**: `tar` flags × gzip, bzip2 or xz × create, list or extract, compared with zip (013.1).
- **Licence chooser**: copyleft vs. permissive vs. CC variants for TuxPixel's engine, assets and docs (011.3).
- **Distro family tree and release types** (011.1).
- **Paths**: absolute vs. relative resolution with `.`, `..` and `~` (012.3).

Each simulator has "For the exam" takeaways and "Now you try" bank items, as in AIF.

### 6c. Terminal exercises (`/exercises`)
`src/content/exercises/<objectiveId>.json`, with 1–3 per objective that has hands-on content (012.x, 013.x, 014.2, 015.3 and 015.4). Each has `prompt`, `fixture`, optional `user`, 1–3 `hints`, `solution` (commands) and `check`: a bash script run in the VM after the learner's session, printing pass/fail messages. Examples: "Archive `~/builds/0.9` as `builds-0.9.tar.xz`", "Make `deploy.sh` executable for its owner only", "Write `backup.sh` that loops over `*.png` and copies each to `/srv/backup`". `content:verify` checks that the solution passes and the untouched fixture fails. There is a "Free terminal" playground at `/terminal`.

### 6d. Matcher drills (`/explore/drills`)
- **Which command?** and **Which file/path?** rounds.
- **Sorters**: copyleft vs. permissive, Debian vs. Enterprise Linux vs. SUSE vs. Alpine (distros and package tools), built-in vs. external command, absolute vs. relative path, and physical vs. pseudo-device.

Decks are data. Card ids are stored in progress, so append and never renumber. Best scores and misses are kept.

### 6e. Flashcards (`/explore/flashcards`)
Leitner boxes 0–5 with Again/Good/Easy and intervals of 0/1/3/7/16/35 days, ported from AIF. Built-in cards are at least 2 per key knowledge area, giving about 250 cards. Learners can make their own decks and share them as validated JSON files.

## 7. Architecture

The structure and conventions follow **AIF-C01_prep** (newest), and the runner follows **PCEP_prep**:
- `src/content/` is data.
- `src/quiz/` holds grade, sampler, pools, results and `ItemView`.
- `src/progress/store.ts` is the only `localStorage` user (key `le010:progress`). It is versioned, with migrations.
- `src/vm/` holds the terminal runtime.
- `src/sims/` has one folder per simulator.
- Pages are lazy-loaded.
- Theme tokens are set via `@theme`, and dark mode remaps the tokens.
- The deploy workflow builds with `BASE_PATH=/LE-010_prep/` and copies `index.html` to `404.html`.

Pages:
- `/`: the blueprint.
- `/learn` and `/learn/:objectiveId`.
- `/practice`: `?objective=`, `?topic=`, `?mix=`, `&focus=1`, `?weak=1`.
- `/questions`, `/questions/:itemId` and `/mock`.
- `/terminal` and `/exercises`.
- `/explore`, with its sims, drills and flashcards.
- `/guides/:slug` (cheat sheet and exam-day guide).
- `/progress`: readiness by topic and objective, export and import.

Scripts:
- `content:status`
- `content:quality`
- `content:verify` (v86 in Node)
- `content:links`
- `vm:build` (Docker)
- `transcripts:capture`

## 8. Phases

0. **Scaffold and VM spike** (done 2026-11-24):
   - Tooling ported from AIF-C01: configs, the theme (green and Tux yellow), the layout with the phone menu and the non-affiliation footer, and the Pages deploy, which now also builds the VM.
   - The bookworm i386 guest: PID 1 is `le-init` with autologin for mira, plus jonas and ada, and a root control channel on the second serial port that sets the clock after a restore.
   - `vm:build`, `vm:state` and `vm:smoke` (restore in Node; checks the tty, the clock, man pages, GNU tar, `/tmp`'s sticky bit, groups and Ctrl+C), and a `/terminal` page with xterm.js. The spike is a go (numbers in §5a).
   - `EXAM_FORMAT`: 40 items, 60 minutes, and 200–800 with a pass at 500 come from LPI's FAQ. No official page lists the item formats (§2).
1. **Blueprint and quiz engine** (done 2026-11-24):
   - `blueprint.ts` is verbatim from v2.0: 19 objectives, 63 key knowledge areas and 102 term lines, typos included.
   - The schema has all four kinds.
   - Content tests, and the `content:status`, `content:quality` and `content:links` scripts.
   - Practice, the question bank browser, the mock exam (40 in 60, one per weight point, with short objectives filled from their topic), and the progress store (v1) and page. Ported from AIF-C01.
   - 9 seed items covering every kind. Every claimed output, and every command in an accepted answer, was run in the guest. That caught a `fill` item whose accepted answers didn't work with its prefix.
2. **Terminal runtime** (done 2026-11-24):
   - Fixtures (schema, the first `assets` tree) and `src/vm/job.ts`, the one job script shared by the browser, the verifier and the tests.
   - le-init's `job` command on the control channel, and `VmRunner` with a snapshot restore before every run, timeouts and fixture errors.
   - `content:verify` runs every claim in v86 under Node and writes `verified.json`; `verify.test.ts` checks claims against it offline, and CI reruns everything after rebuilding the guest. `fill` items gained `verify`, and output items `fixture` and `user`.
   - Lesson cells (`bash` cells you can edit and run, `static` fences, `output` blocks and `<Predict>`), tested through the real MDX pipeline and checked in Chrome: about 1 s per run.
   - `vm:smoke` checks the runner. The Docker-vs-v86 spot check was dropped once verification moved into v86 (§5c).
3. **Lessons and the 010-160 track** (done 2026-11-26; per-lesson LPI deep links still open):
   - The exam-track switch (§3b): v1.6 data in the blueprint, `itemInExam`, progress v2 with `track`, track-aware practice, mock, readiness and labels.
   - 19 lessons with 252 verified snippet claims (`## Big idea`, `## Walkthrough`, `## At TuxPixel`, `## Predict the output`, `## Exam traps`, `## Try it`), with `<ExamOnly>` blocks for each exam's own material. Each cites its sources and links to the LPI Learning Materials; per-lesson deep links wait until the URL pattern is checked in a browser (§1).
   - `vm:run` to try a command in the guest while writing.
4. **Question bank** (done 2026-11-26):
   - 666 items (target 600): every objective at or over target, and every area at 5 or more and every term tested, on both exams. Concept objectives overshoot so each exam's own lines count on that exam.
   - Kind mix: 58% single, 13% multi, 15% fill, 15% output. 518 runnable claims verified in the guest.
   - The `q014-dns` and `q013-scripts` fixtures were added for items.
5. **Exercises**: terminal exercises with checks, plus the `/terminal` playground.
6. **Explore I**: flashcards and drills.
7. **Explore II**: transcript capture, the five transcript simulators and the concept simulators.
8. **Guides and polish**: the cheat sheet, the exam-day guide (format, pacing, price, booking via Pearson VUE/OnVUE), a mobile pass at 360 px, and accessibility (the terminal must work with a screen reader: xterm's screen-reader mode and a plain-text output mirror).
