# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 0 (scaffold and VM spike), 1 (blueprint and quiz engine) and 2 (terminal runtime) are done: the tooling, the Pages deploy, the in-browser Debian guest, the `/terminal` page, the verbatim blueprint, the item schema, the content tests and scripts, practice, the question bank browser, the mock exam, the progress store and page, 9 seed items, fixtures, the job runner, `content:verify` with its verified cache, and the lesson cell components (`bash` cells, `output` blocks, `<Predict>`). Phase 3 is done: the 010-160 exam track and all 19 lessons. Phase 4 is done: the question bank has 666 items, with every area and term of both exams covered. Phase 5 is done: 25 terminal exercises with checks. **`PLAN.md` is the build plan and sets the order of work.** It records the decisions made, the blueprint → content map, the item kinds, the terminal design, the Explore pillar and the phases. As parts get built, describe them here (commands, file layout, gotchas), and mark phases done in `PLAN.md` §8 with the date.

The sibling apps `../AIF-C01` (newest; follow its structure, conventions and styling) and `../PCEP_prep` (in-browser runner, verified outputs, `<Predict>` blocks) are the reference implementations. Port their code rather than reinventing it.

## Purpose

**LE-010_prep** is a self-study web app for the **LPI Linux Essentials exam 010-200 (objectives v2.0)**, written in English for beginners. An exam-track switch selects the previous exam, **010-160 (objectives v1.6)**, instead (PLAN.md §3b). It has three pillars:
- **Learn**: one lesson per objective (19).
- **Check**: practice, a question bank of about 600 items (kinds `single`, `multi`, `fill` and `output`), and a 40-item, 60-minute mock exam with a scaled estimate against 500 on the 200–800 scale.
- **Do / Explore**: a real Linux terminal in the browser, auto-graded terminal exercises, transcript-driven simulators for systemd, SSH, networking and users, concept simulators, matcher drills and flashcards.

Every scenario uses one invented company, **TuxPixel Studio**, an indie game studio making "Pixel Raiders": **Mira** (gameplay developer who looks after the Linux machines, in `sudo`), **Jonas** (pixel artist and sound designer) and **Ada** (build and release engineer). The guest's hostname is `tuxpixel`; other hosts use `tuxpixel.example` and documentation IP ranges.

## Authoritative sources

- Objectives v2.0 (`SOURCES` in `blueprint.ts`) are the single source of truth for topics, objectives, weights, key knowledge areas and terms. When they change, update `src/content/blueprint.ts` first.
- Objectives v1.6 (https://wiki.lpi.org/wiki/Linux_Essentials_Objectives_V1.6) and LPI's change summary (https://wiki.lpi.org/wiki/Linux_Essentials_Summary_Version_1.6_To_2.0) decide what is on 010-160. learning.lpi.org refuses automated fetches (HTTP 403).
- `EXAM_FORMAT` cites where each fact comes from. No official LPI page lists the item formats; the only statement ("multiple choice, multiple response, and short input") is an LPI-hosted trainer blog post about 010-160.
- LPI Learning Materials 010-200 are **CC BY-NC-ND 4.0**. Link to them as further reading. Never copy, paraphrase closely, adapt or translate their text, exercises or answers.
- The footer and README say "Not affiliated with or endorsed by the Linux Professional Institute."

## Architecture

- **Stack**: Vite 8, React 19, TypeScript 7, Tailwind v4, React Router 8 (imported from `react-router`), Zod 4, MDX (lessons), Vitest 5 with RTL, oxlint, v86 (pinned exactly) and xterm.js 6. The app is a static SPA.
- **Deploy**: `.github/workflows/deploy.yml` lints, tests, builds the VM (`vm:build`, `vm:state`, `vm:smoke`), builds with `BASE_PATH=/LE-010_prep/`, copies `index.html` to `404.html` for deep links, and publishes to GitHub Pages on every push to `main`. The router takes `basename={import.meta.env.BASE_URL}`, so use router `Link`s and never root-relative `<a href="/…">`.
- **Pages** are lazy-loaded in `src/app/routes.tsx`. Keep content imports out of `routes.tsx`, `Layout.tsx` and `main.tsx`. Add each pillar's nav entry to `NAV` in `Layout.tsx` when its pages exist. Every page needs an `h1`, which the page tests wait for.
- **Theme**: colour tokens (`brand` green, `brand-dark`, `accent` Tux yellow, `chalk`, `page`, `header`, `code`) are set in `src/index.css` via `@theme`. Dark mode follows the OS by remapping the tokens and the slate scale once, so components don't use `dark:` variants.
- **`src/content/blueprint.ts`**:
  - Verbatim from objectives v2.0, typos included: `TOPICS` (011–015) and `OBJECTIVES` (19). Each objective has its `weight`, `description`, `areas` (Key Knowledge Areas, ids `<objectiveId>.<n>`) and `terms` (one per line of the "files, terms and utilities" list, ids `<objectiveId>.t<n>`).
  - `SOURCES` and `EXAM_FORMAT`, which cites the source of each fact.
  - The two exams: `ExamId` (`'010-200' | '010-160'`), `EXAM_IDS` (main first) and `EXAM_PROFILES`. The 19 objectives map one to one with the same weights. Each objective's `v16` holds the v1.6 id, title and description verbatim, and the v1.6 order of its areas and terms (`V16` table, merged by `mergeV16`). A line both versions list keeps its 2.0 id (with `v16Text` where v1.6 words it differently); a 2.0-only line has `exams: ['010-200']`; a v1.6-only line has id `<objectiveId>.v<n>` (areas) or `.vt<n>` (terms) and `exams: ['010-160']`. A line whose contents changed counts as two lines. Helpers: `inExam`, `linesFor(objective, 'areas' | 'terms', exam)` (that exam's order and wording), `itemInExam` (one area, and one term if it tags any, on the exam), `objectiveLabel`/`objectiveName` and `topicLabel`/`topicName` (the track's numbering: "2.2 …" on 010-160).
  - `MOCK`, `mockQuota()` (one question per weight point), `questionTarget()` (15 per weight point; `BANK_TARGET` 600) and `MIN_ITEMS_PER_AREA` (5).
  - `estimateScaledScore()`: piecewise linear on 200–800, with 500 at `ASSUMED_PASS_FRACTION` (2/3). This is the app's own assumption, since LPI publishes no percentage, so always label the score an estimate.
- **`src/content/schema.ts`**: a Zod union of four item kinds:

  | Kind | Shape |
  |---|---|
  | `single` | 4 options |
  | `multi` | 5–6 options; the stem must contain "(Choose TWO.)" etc. |
  | `fill` | short input: `accept[]` (every accepted answer, the first shown as the key), `caseSensitive` (default true), optional `prefix` shown before the input, and optional `verify` (`command` with `{answer}`, optional `fixture` and `user`): every answer substituted must exit 0. A `prefix` requires `verify` |
  | `output` | `command` (run as `user`, default mira, in their home directory, after the optional `fixture`), `output` (exactly what it prints, as recorded by `content:verify`), and `mode`. In `choice` mode there are 4 `options`, and the correct one must equal `output`; in `type` mode there are no options |

  - Ids are `<objectiveId>-NNN`. Every item has `areas[]` and may have `terms[]` and `sourceLinks[]`, all from its own objective.
  - Option text is trimmed, but output options keep their exact whitespace (`outputOption`), because leading spaces are part of the output.
  - Other helpers: `normaliseAnswer` (fill) and `normaliseOutput` (typed outputs: trailing spaces and blank lines don't count).
- **Questions**: `src/content/questions/<objectiveId>.json`, one array per objective, loaded through `import.meta.glob` in `bank.ts`. `bank.test.ts` checks that the file matches the objective, ids are unique, and areas and terms exist, and runs the quality checks.
- **`src/content/quality.ts`**: the anti-giveaway checks over `single` items and `output` items in choice mode:
  - no key letter in more than 40% of them
  - the key is the longest option in 15–40% of them
  - no duplicate stems (output items are compared by stem plus command)
  - no option letters in explanations or rationales

  It uses type-only imports, because the content scripts run it with Node.
- **Quiz engine** (`src/quiz/`), ported from AIF:
  - `grade.ts`: `Response` per kind, `emptyResponse`, `isAnswered` and all-or-nothing `grade`.
  - `pools.ts`: `practicePool(bank, includeOutput)` and `objectiveWeights()`.
  - `sampler.ts`, with `seededRng(n)` from `random.ts` in tests:
    - `buildMockExam` takes `mockQuota` items per objective and prefers unseen ones. A short objective borrows from the rest of its topic, and when the bank is short the time scales to the real pace.
    - `buildMixedSet` samples by objective weight.
    - `buildFocusSet` and `orderLeastMastered` put the lowest streak first.
  - `results.ts` `scoreMock`: rows by topic and objective.
  - `ItemView` renders all four kinds. Output items show the command after mira's prompt, and their options are `<pre>`. The `keyboard` prop binds 1–6 and A–F; `onEnter` lets Enter in a text answer check it, since the window shortcuts ignore keys typed into fields.
  - `SessionReview`, `ScoreTable`, `ShortcutHint` and `shortcuts.ts` are as in AIF.
- **Pages** (all lazy): `/` (format, the exam-track switch `components/ExamSettings.tsx`, and objectives), `/learn` and `/learn/:objectiveId`, `/practice` (`?objective=013.2`, `?topic=013` or `?mix=n`, each optionally with `&focus=1`, or `?weak=1`), `/questions` and `/questions/:itemId`, `/mock`, `/exercises` and `/exercises/:exerciseId`, `/terminal` and `/progress`. The output-items toggle lives in `components/OutputItemsToggle.tsx`.
- **Exam track**: every page labels topics and objectives with `topicName`/`objectiveName` for the learner's track, `practicePool(bank, track, includeOutput)` keeps practice, the question bank and readiness to the track's items, and `buildMockExam(pool, exam, …)` and `scoreMock(items, exam, …)` take the exam.
- **Progress** (`src/progress/store.ts`, key `le010:progress`, version 3; `migrate()` turns version 1 into 2 with `track: '010-200'` and `exam: '010-200'` on mock results, and 2 into 3 with no exercises):
  - The exam `track` (default 010-200, `setTrack`), per-item stats with a `streak`, mock results (with their `exam`, `scaled` and topic rows), `lessonsRead`, `exercises` (attempts and `solvedAt`, `recordExerciseCheck`), and the toggles `outputInPractice` (default on) and `outputInMock` (default off).
  - Export and import, with `app: 'le-010-prep'`.
  - `readiness.ts`: objective readiness (coverage × accuracy, weighted by objective weight), the weak-spot drill and `masteryOf()`.
- **Fixtures** (`src/content/fixtures/<name>.json`, schema in `fixture.ts`, loaded by `fixtureBank.ts`, kept apart from `bank.ts` so lesson cells don't pull in the bank): `description`, `groups` (created first, with `members`), `entries` (absolute `path`, `type` file/dir/symlink, `content` with its exact final newline, `target`, `owner` (default: whose home the path is in, else root), `group`, octal `mode`), and `setup` steps run as a user (default mira) in their home, e.g. `tar -czf …`. `assets.json` is the first. Every file the fixture touches gets the time `FIXTURE_TIME` (2026-11-02 09:30), so `ls -l` is stable.
- **Jobs** (`src/vm/job.ts`, shared by the browser, the scripts and the tests): `jobScript({ command, user, fixture })` is one bash script, run as root. It applies the fixture (a failure exits `FIXTURE_FAILED` 125 with "le-job: fixture failed…"), then runs the command as the user in their home with `runuser`, a clean environment (Debian's `login.defs` PATH, `LANG=en_US.UTF-8`), and `script` for a pty 80 columns wide, so `ls` prints columns and stderr is mixed in, as in the terminal. `timeout` kills the command's process group after `JOB_TIMEOUT_S` (10) with exit 124. `cleanOutput` strips colours, carriage returns and the final newline.
- **The guest** (`scripts/vm/`):
  - The `Dockerfile` builds Debian 12 bookworm i386 (digest-pinned; Debian 13 has no i386 kernel, and v86 runs only 32-bit guests) with the users mira (in `sudo`), jonas and ada. Every password is `tuxpixel`.
  - `le-init` is PID 1. There is no systemd. It mounts the pseudo filesystems, writes `/etc/hostname` and `/etc/hosts`, runs a root **control channel** on `/dev/ttyS1` (v86 uart1; it understands `clock <epoch>` and `job <id> <base64 script>`, which it answers with `le-done <id> <status> <base64 output>`), and loops `agetty --autologin mira` on `ttyS0` under `setsid`.
  - `build-image.sh` (`npm run vm:build`) exports the container to v86's 9p format in `public/vm/` (git-ignored): `rootfs.json`, the hashed `rootfs/` files, the BIOS images and `v86.wasm`. It uses v86's `fs2json.py` and `copy-to-sha256.py`, vendored in `scripts/vm/v86/`, which need Python `zstandard`.
  - `build-state.ts` (`npm run vm:state`) boots the guest in Node, waits for `VM_PROMPT` and saves `state.bin.zst`. It fails if the shell reports "no job control".
  - `guest.ts` `restoreGuest()` restores the state in Node like the browser does and returns the emulator and a `VmRunner`.
  - `smoke.ts` (`npm run vm:smoke`) types a few commands into mira's terminal and checks their output, then checks the runner (a reset between runs, a fixture as jonas, exit statuses, the timeout). Add a check whenever the guest changes.
- **Runtime** (`src/vm/`):
  - `config.ts` is shared with the scripts: `VM_MEMORY_MB` (128; the state holds all of RAM), `VM_PROMPT` and `stripAnsi`.
  - `emulator.ts`: `vmAvailable()` (a HEAD request for the state), `startVm()`, which downloads the state, imports v86 dynamically, restores it, fetches `rootfs/` files on demand and syncs the clock, and returns `{ emulator, snapshot }`, and `sharedRunner()`, the one guest behind every lesson cell, started on first use.
  - `runner.ts` `VmRunner`: queues jobs over the control channel. Every run after the first restores the snapshot (`restore_state` takes the zstd file as downloaded) and resyncs the clock, so each run starts clean, unless it passes `{ keep: true }` (an exercise's check). It rejects with `RunError` (`timeout` or `fixture`). No Vite imports, so the scripts use it too.
  - `Terminal.tsx` wires xterm.js to serial port 0, batching output once per frame. Its optional `onStart(vm, { refresh })` runs before the learner can type (keep it stable with `useCallback`; a new one starts a new machine). It's lazy, so v86 and xterm stay out of every other bundle. `/terminal` (`TerminalPage`) explains how to build the image when it's missing.
  - `ShellCommand` (`src/components/`) shows commands after the user's prompt (`promptFor(user)`), with `> ` on continuation lines (after a trailing `\` or `|`, indented, inside `do`/`then`, or in a here document).
- **Verification** (never trust a hand-written output):
  - `runnables.ts` `collectRunnables()` lists every claim: each `output` item, each accepted answer of a `fill` item with `verify` (ids `013.1-001#2`), each `bash` snippet in lesson MDX (ids `lesson 013.2:41`, the fence's line), and each exercise twice (`exercise 013.1-e01 solved` must exit 0, `… unsolved` must fail). A snippet with an `output` fence right after it must print exactly that; one without must exit 0. `checkClaim()` compares.
  - `npm run content:verify` (`scripts/content-verify.ts`) runs the new or stale claims in the learner's own guest (v86 in Node, up to 4 worker threads via `scripts/vm/verify-worker.ts`) and writes `src/content/verified.json`, keyed by a hash of the job script and the guest recipe (`Dockerfile` + `le-init`) and sorted by id. `-- --all` reruns everything; CI does that after rebuilding the guest. It drops records nothing uses.
  - `verify.test.ts` (offline) fails when a claim has no current record, contradicts its record, or a record is unused.
  - Verification runs in v86, not Docker, because the two differ: v86's 9p filesystem lists directories in creation order (Docker's overlay in hash order, which changes `tar` and `find` output), and the kernels differ.
- **Exercises** (`src/content/exercises/<objectiveId>.json`, schema and jobs in `src/content/exercise.ts`, loaded by `exercises.ts`, page `src/pages/ExercisesPage.tsx`):
  - Ids `<objectiveId>-eNN`. Each has `areas`, `title`, `prompt` (paragraphs; `- `/`1. ` lists and ``` blocks; `Inline` markup only, so no bold), an optional `fixture`, 1–3 `hints`, `solution` and `check`.
  - The page starts its own guest: `startJob(fixture)` runs while the terminal waits at mira's prompt; Check runs `checkJob(ex)` with `keep`, and `parseCheck` splits its output into ✓/✗ rows; Start over runs `startJob` again (which restores the snapshot) and redraws the terminal.
  - `check` is bash run as root in `/home/mira` (`checkCommand` adds `ok` and `no`; `exit 1` stops early). Run learner scripts as mira with `runuser -u mira -- env -i HOME=/home/mira … timeout 5 bash -c 'cd ~ && ./x.sh'`. No backticks or `${` in checks (they're bash in JSON), and no message that relies on a group the fixture adds: mira's open shell doesn't get new group memberships.
  - For verification, `solutionCommand` types the solution as mira, ignoring exit statuses (a solution may fail on purpose), then runs the check.
- **Lesson cells** (`src/lessons/components.tsx`, `lessonComponents` for MDX): a ```` ```bash ```` fence is a `ShellCell` (Run, Edit, Reset; it runs in `sharedRunner()`), ```` ```bash static ```` is shown with a prompt but never run (systemctl, apt …), ```` ```bash fixture=assets user=jonas ```` sets how it runs, an ```` ```output ```` fence is a labelled block, and `<Predict>` wraps one bash fence and its output fence and asks for a guess first. Fence options reach `<code>` as `data-meta` through `remarkFenceMeta` in `vite.config.ts`; `snippets.ts` `parseMeta` reads them, and unknown options are errors. `src/test/cells.mdx` exercises the real MDX pipeline in `components.test.tsx`. `Callout` boxes hold exam traps, and `<ExamOnly exam="010-160">` wraps material only one exam asks about: open on that exam's track, collapsed on the other.
- **Lessons** (`src/content/lessons/<objectiveId>.mdx`; `012.3.mdx` is the reference template, loaded by `lessons/index.ts`):
  - Each exports `meta` (`lessonMetaSchema`): `objectiveId`, `updated` (the date its facts were checked), `tldr` (plain text and backticks only: `Inline` doesn't render bold), `areasCovered` and `termsCovered` (every area and term id of the objective, both exams), and `links` to the sources behind its facts. The page adds the LPI Learning Materials link itself.
  - Sections, in order: `## Big idea`, `## Walkthrough`, `## At TuxPixel`, `## Predict the output` (2–3 `<Predict>` blocks), `## Exam traps` (`Callout`s), `## Try it`.
  - `lessons.test.ts` enforces this, plus an `<ExamOnly>` block for each exam with lines of its own, `output` fences only after runnable `bash` fences (output of tools the guest can't run comes from transcripts, never a lesson), and in-app links to pages and lessons that exist. `verify.test.ts` checks every snippet's claim.
  - MDX: a bare `{`, `}` or `<` in prose breaks the build; wrap it in backticks. Leave blank lines inside `<ExamOnly>` and `<Predict>` so the markdown in them is parsed.
  - `/learn` lists objectives by topic; `/learn/:objectiveId` shows the lesson, the track's areas and terms plus the other exam's own lines, the sources, Mark as read, practice links, and previous/next navigation.
- **Tests**: tests run in Node, and component tests start with `// @vitest-environment jsdom`. Vitest runs without globals, so `src/test/setup.ts` registers `cleanup` itself. `src/test/fixtures.ts` has one valid item per kind, with output in both modes. `src/pages/pages.test.tsx` renders the real routes with `createMemoryRouter` and an async `renderAt()` over the real bank, so keep those tests independent of item order and pool size. The VM is not exercised by `npm test`; that is `vm:smoke`'s job.

## Rules that span the codebase

- **Content is data.** Lessons, questions, exercises, fixtures, transcripts, drills and flashcards are files under `src/content/`, validated with Zod and rendered generically. Only the simulators' interactive parts are components.
- **Never trust a hand-written output.** Every claimed command output, and every command an item presents as working (including each `fill` answer together with its `prefix`, through `verify`), must come from running it in the guest, never from memory: write the claim, run `npm run content:verify`, and commit `verified.json` with it. For quick exploration, `docker run --rm --platform linux/386 -u mira -w /home/mira le010/vm bash -c '…'` is fine, but only `content:verify` counts, since Docker's directory order differs from the guest's.
- Question ids are stored in progress, so never renumber or reuse an item id.
- Outputs of systemd, journalctl, ssh, ip/ss, useradd and other tools the guest doesn't run come from **captured transcripts** of a real Debian 13 system, never invented.
- Distro-specific facts (package tools, release models, new v2.0 terms such as `wtmpdb last`, `resolvectl`, passkeys and digital sovereignty) are checked against current docs, never written from memory, and cited.
- Write every question for this app. Never reproduce live exam content (candidates are under NDA), third-party dumps or the LPI learning materials' exercises. Explanations never name option letters.
- `src/progress/store.ts` is the only module that touches `localStorage`. On an unknown version it discards stored data, so when the shape changes, bump `VERSION`, add a migration in `load()` and `importProgress()`, and keep the Zod `ProgressSchema` in step. Never renumber item, card or exercise ids, because they're stored in progress.

## Commands

```bash
npm run dev               # Vite dev server (the terminal needs the VM in public/vm/)
npm run build             # tsc -b + production build (BASE_PATH=/LE-010_prep/ for Pages)
npm run lint              # oxlint
npm run typecheck         # tsc -b
npm test                  # Vitest, run once; npm run test:watch for watch mode
npx vitest run src/content/schema.test.ts   # single file
npx vitest run -t "mock exam"               # tests by name
npm run content:status    # items per objective vs. target, areas below 5, terms no item tests, kind mix
npm run content:quality [-- <file.json> ...]  # anti-giveaway checks, whole bank or given files
npm run content:links     # fetch every cited URL (needs network; not part of npm test)
npm run content:verify    # run new or stale claimed outputs in the guest (needs vm:build + vm:state); -- --all reruns all
npm run vm:build          # Docker: build the i386 guest and export it to public/vm/
npm run vm:state          # boot it in v86 (Node) and save public/vm/state.bin.zst
npm run vm:smoke          # restore the state and check a few commands
npm run vm:run -- [--fixture assets] [--user jonas] 'ls -l'   # run one command in the guest and print its output (for writing content)
```

The scripts run TypeScript directly with Node, so imports in `scripts/` use `.ts` extensions, and the app modules they import may only import types from extensionless paths. Vitest caches `import.meta.glob` results: if a new question file doesn't show up in tests, run `npx vitest --clearCache`.

## Gotchas

- The deploy's build job runs on `ubuntu-24.04`, not `ubuntu-latest`: the newer runner kernel (7.0) gives 32-bit programs no sockets, so in the i386 build apt can't resolve hosts and `groupadd` aborts ("Cannot open audit interface"). Local builds on Apple silicon never show this, since 32-bit code runs emulated there.
- Docker bind-mounts `/etc/hosts` and `/etc/hostname` during `RUN`, so the Dockerfile can't write them; `le-init` does.
- Debian's default `MODULES=most` makes a 25 MB initrd, and unpacking it panics the 128 MB guest ("System is deadlocked on memory"). The Dockerfile sets `MODULES=list`, so only the 9p/virtio modules go in.
- agetty must run in its own session, detached from `/dev/console` (`setsid -w … < /dev/null`). Otherwise bash gets no controlling terminal, and Ctrl+C never reaches the program.
- On Apple silicon the i386 image builds under emulation (`vm:build` takes about 2 minutes once apt's layers are cached, and about 10 the first time). Docker Desktop updating itself mid-build kills the build with "error reading from server: EOF"; just rerun it.
- The ANSI-coloured prompt (TERM is `xterm-256color`, so Debian's `.bashrc` colours it): match prompts with `stripAnsi`.
- When driving the terminal from Chrome DevTools in a test, send real key events (`Input.dispatchKeyEvent`). `Input.insertText` doesn't reach xterm's `onData`.
- In the guest, `ls -l` shows directories with size 0 (9p), not ext4's 4096. Don't write items whose answer depends on a directory's size or `total` line.
- Node's type stripping (the scripts) rejects TypeScript-only syntax such as constructor parameter properties and enums, in any `src/` module a script imports.
- Tests that need lesson MDX as text read the files with `fs`: the MDX plugin compiles even a `?raw` import.
- The schema rejects options that differ only by case, so `-a`/`-A` or `-r`/`-R` can't both be options; use long forms (`--all`, `--almost-all`) as distractors.
- In the guest, `man ls` can hit the 10 s job timeout, and `/etc/resolv.conf` is an empty file from the Docker export; a fixture can replace it.
- Zod's `.trim()` transforms values, so the schema's `nonEmpty` changes text. Never use it for text whose whitespace matters (outputs).
- To check phone layout, emulate the viewport over DevTools (`Emulation.setDeviceMetricsOverride`, width 360). `--window-size=360` gives a wider layout viewport, because headless Chrome has a minimum window width.
