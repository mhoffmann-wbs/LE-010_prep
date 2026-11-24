# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 0 (scaffold and VM spike), 1 (blueprint and quiz engine) and 2 (terminal runtime) are done: the tooling, the Pages deploy, the in-browser Debian guest, the `/terminal` page, the verbatim blueprint, the item schema, the content tests and scripts, practice, the question bank browser, the mock exam, the progress store and page, 9 seed items, fixtures, the job runner, `content:verify` with its verified cache, and the lesson cell components (`bash` cells, `output` blocks, `<Predict>`). **`PLAN.md` is the build plan and sets the order of work.** It records the decisions made, the blueprint → content map, the item kinds, the terminal design, the Explore pillar and the phases. As parts get built, describe them here (commands, file layout, gotchas), and mark phases done in `PLAN.md` §8 with the date.

The sibling apps `../AIF-C01` (newest; follow its structure, conventions and styling) and `../PCEP_prep` (in-browser runner, verified outputs, `<Predict>` blocks) are the reference implementations. Port their code rather than reinventing it.

## Purpose

**LE-010_prep** is a self-study web app for the **LPI Linux Essentials exam 010-200 (objectives v2.0)**, written in English for beginners. It has three pillars:
- **Learn**: one lesson per objective (19).
- **Check**: practice, a question bank of about 600 items (kinds `single`, `multi`, `fill` and `output`), and a 40-item, 60-minute mock exam with a scaled estimate against 500 on the 200–800 scale.
- **Do / Explore**: a real Linux terminal in the browser, auto-graded terminal exercises, transcript-driven simulators for systemd, SSH, networking and users, concept simulators, matcher drills and flashcards.

Every scenario uses one invented company, **TuxPixel Studio**, an indie game studio.

## Authoritative sources

- Objectives v2.0 (`SOURCES` in `blueprint.ts`) are the single source of truth for topics, objectives, weights, key knowledge areas and terms. When they change, update `src/content/blueprint.ts` first.
- `EXAM_FORMAT` cites where each fact comes from. No official LPI page lists the item formats; the only statement ("multiple choice, multiple response, and short input") is an LPI-hosted trainer blog post about 010-160.
- LPI Learning Materials 010-200 are **CC BY-NC-ND 4.0**. Link to them as further reading. Never copy, paraphrase closely, adapt or translate their text, exercises or answers.
- The footer and README say "Not affiliated with or endorsed by the Linux Professional Institute."

## Architecture

- **Stack**: Vite 8, React 19, TypeScript 7, Tailwind v4, React Router 8 (imported from `react-router`), Zod 4, MDX (wired up but not used yet), Vitest 5 with RTL, oxlint, v86 (pinned exactly) and xterm.js 6. The app is a static SPA.
- **Deploy**: `.github/workflows/deploy.yml` lints, tests, builds the VM (`vm:build`, `vm:state`, `vm:smoke`), builds with `BASE_PATH=/LE-010_prep/`, copies `index.html` to `404.html` for deep links, and publishes to GitHub Pages on every push to `main`. The router takes `basename={import.meta.env.BASE_URL}`, so use router `Link`s and never root-relative `<a href="/…">`.
- **Pages** are lazy-loaded in `src/app/routes.tsx`. Keep content imports out of `routes.tsx`, `Layout.tsx` and `main.tsx`. Add each pillar's nav entry to `NAV` in `Layout.tsx` when its pages exist. Every page needs an `h1`, which the page tests wait for.
- **Theme**: colour tokens (`brand` green, `brand-dark`, `accent` Tux yellow, `chalk`, `page`, `header`, `code`) are set in `src/index.css` via `@theme`. Dark mode follows the OS by remapping the tokens and the slate scale once, so components don't use `dark:` variants.
- **`src/content/blueprint.ts`**:
  - Verbatim from objectives v2.0, typos included: `TOPICS` (011–015) and `OBJECTIVES` (19). Each objective has its `weight`, `description`, `areas` (Key Knowledge Areas, ids `<objectiveId>.<n>`) and `terms` (one per line of the "files, terms and utilities" list, ids `<objectiveId>.t<n>`).
  - `SOURCES` and `EXAM_FORMAT`, which cites the source of each fact.
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
- **Pages** (all lazy): `/` (format and objectives), `/practice` (`?objective=013.2`, `?topic=013` or `?mix=n`, each optionally with `&focus=1`, or `?weak=1`), `/questions` and `/questions/:itemId`, `/mock`, `/terminal` and `/progress`. The output-items toggle lives in `components/OutputItemsToggle.tsx`.
- **Progress** (`src/progress/store.ts`, key `le010:progress`, version 1):
  - Per-item stats with a `streak`, mock results (with `scaled` and topic rows), `lessonsRead`, and the toggles `outputInPractice` (default on) and `outputInMock` (default off).
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
  - `runner.ts` `VmRunner`: queues jobs over the control channel. Every run after the first restores the snapshot (`restore_state` takes the zstd file as downloaded) and resyncs the clock, so each run starts clean. It rejects with `RunError` (`timeout` or `fixture`). No Vite imports, so the scripts use it too.
  - `Terminal.tsx` wires xterm.js to serial port 0, batching output once per frame. It's lazy, so v86 and xterm stay out of every other bundle. `/terminal` (`TerminalPage`) explains how to build the image when it's missing.
  - `ShellCommand` (`src/components/`) shows commands after the user's prompt (`promptFor(user)`), with `> ` on continuation lines (after a trailing `\` or `|`, indented, or inside `do`/`then`).
- **Verification** (never trust a hand-written output):
  - `runnables.ts` `collectRunnables()` lists every claim: each `output` item, each accepted answer of a `fill` item with `verify` (ids `013.1-001#2`), and each `bash` snippet in lesson MDX (ids `lesson 013.2:41`, the fence's line). A snippet with an `output` fence right after it must print exactly that; one without must exit 0. `checkClaim()` compares.
  - `npm run content:verify` (`scripts/content-verify.ts`) runs the new or stale claims in the learner's own guest (v86 in Node, up to 4 worker threads via `scripts/vm/verify-worker.ts`) and writes `src/content/verified.json`, keyed by a hash of the job script and the guest recipe (`Dockerfile` + `le-init`) and sorted by id. `-- --all` reruns everything; CI does that after rebuilding the guest. It drops records nothing uses.
  - `verify.test.ts` (offline) fails when a claim has no current record, contradicts its record, or a record is unused.
  - Verification runs in v86, not Docker, because the two differ: v86's 9p filesystem lists directories in creation order (Docker's overlay in hash order, which changes `tar` and `find` output), and the kernels differ.
- **Lesson cells** (`src/lessons/components.tsx`, `lessonComponents` for MDX): a ```` ```bash ```` fence is a `ShellCell` (Run, Edit, Reset; it runs in `sharedRunner()`), ```` ```bash static ```` is shown with a prompt but never run (systemctl, apt …), ```` ```bash fixture=assets user=jonas ```` sets how it runs, an ```` ```output ```` fence is a labelled block, and `<Predict>` wraps one bash fence and its output fence and asks for a guess first. Fence options reach `<code>` as `data-meta` through `remarkFenceMeta` in `vite.config.ts`; `snippets.ts` `parseMeta` reads them, and unknown options are errors. `src/test/cells.mdx` exercises the real MDX pipeline in `components.test.tsx`.
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
- Zod's `.trim()` transforms values, so the schema's `nonEmpty` changes text. Never use it for text whose whitespace matters (outputs).
- To check phone layout, emulate the viewport over DevTools (`Emulation.setDeviceMetricsOverride`, width 360). `--window-size=360` gives a wider layout viewport, because headless Chrome has a minimum window width.
