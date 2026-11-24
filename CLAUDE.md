# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 0 (scaffold and VM spike) is done: the tooling, the Pages deploy, the theme and layout, the in-browser Debian guest with its build and smoke scripts, the `/terminal` page and `EXAM_FORMAT`. **`PLAN.md` is the build plan and sets the order of work.** It records the decisions made, the blueprint → content map, the item kinds, the terminal design, the Explore pillar and the phases. As parts get built, describe them here (commands, file layout, gotchas), and mark phases done in `PLAN.md` §8 with the date.

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
- **The guest** (`scripts/vm/`):
  - The `Dockerfile` builds Debian 12 bookworm i386 (digest-pinned; Debian 13 has no i386 kernel, and v86 runs only 32-bit guests) with the users mira (in `sudo`), jonas and ada. Every password is `tuxpixel`.
  - `le-init` is PID 1. There is no systemd. It mounts the pseudo filesystems, writes `/etc/hostname` and `/etc/hosts`, runs a root **control channel** on `/dev/ttyS1` (v86 uart1; it understands `clock <epoch>`), and loops `agetty --autologin mira` on `ttyS0` under `setsid`.
  - `build-image.sh` (`npm run vm:build`) exports the container to v86's 9p format in `public/vm/` (git-ignored): `rootfs.json`, the hashed `rootfs/` files, the BIOS images and `v86.wasm`. It uses v86's `fs2json.py` and `copy-to-sha256.py`, vendored in `scripts/vm/v86/`, which need Python `zstandard`.
  - `build-state.ts` (`npm run vm:state`) boots the guest in Node, waits for `VM_PROMPT` and saves `state.bin.zst`. It fails if the shell reports "no job control".
  - `smoke.ts` (`npm run vm:smoke`) restores the state in Node like the browser does and checks the output of a few commands. Add a check whenever the guest changes.
- **Runtime** (`src/vm/`):
  - `config.ts` is shared with the scripts: `VM_MEMORY_MB` (128; the state holds all of RAM), `VM_PROMPT` and `stripAnsi`.
  - `emulator.ts`: `vmAvailable()` (a HEAD request for the state) and `startVm()`, which imports v86 dynamically, restores the state, fetches `rootfs/` files on demand and syncs the clock over the control channel.
  - `Terminal.tsx` wires xterm.js to serial port 0, batching output once per frame. It's lazy, so v86 and xterm stay out of every other bundle. `/terminal` (`TerminalPage`) explains how to build the image when it's missing.
- **Tests**: tests run in Node, and component tests start with `// @vitest-environment jsdom`. Vitest runs without globals, so `src/test/setup.ts` registers `cleanup` itself. `src/pages/pages.test.tsx` renders the real routes with `createMemoryRouter` and an async `renderAt()`. The VM is not exercised by `npm test`; that is `vm:smoke`'s job.

## Rules that span the codebase

- **Content is data.** Lessons, questions, exercises, fixtures, transcripts, drills and flashcards are files under `src/content/`, validated with Zod and rendered generically. Only the simulators' interactive parts are components.
- **Never trust a hand-written output.** Every claimed command output must come from running it in the guest (PLAN.md §5c, `content:verify`, phase 2), never from memory.
- Outputs of systemd, journalctl, ssh, ip/ss, useradd and other tools the guest doesn't run come from **captured transcripts** of a real Debian 13 system, never invented.
- Distro-specific facts (package tools, release models, new v2.0 terms such as `wtmpdb last`, `resolvectl`, passkeys and digital sovereignty) are checked against current docs, never written from memory, and cited.
- Write every question for this app. Never reproduce live exam content (candidates are under NDA), third-party dumps or the LPI learning materials' exercises. Explanations never name option letters.
- `src/progress/store.ts` (from phase 1) will be the only module that touches `localStorage`. Bump `VERSION` and add a migration when the shape changes, and never renumber item, card or exercise ids, because they're stored in progress.

## Commands

```bash
npm run dev               # Vite dev server (the terminal needs the VM in public/vm/)
npm run build             # tsc -b + production build (BASE_PATH=/LE-010_prep/ for Pages)
npm run lint              # oxlint
npm run typecheck         # tsc -b
npm test                  # Vitest, run once; npm run test:watch for watch mode
npx vitest run src/vm/config.test.ts   # single file
npx vitest run -t "not-found"          # single test by name
npm run vm:build          # Docker: build the i386 guest and export it to public/vm/
npm run vm:state          # boot it in v86 (Node) and save public/vm/state.bin.zst
npm run vm:smoke          # restore the state and check a few commands
```

The scripts run TypeScript directly with Node, so imports in `scripts/` use `.ts` extensions.

## Gotchas

- Docker bind-mounts `/etc/hosts` and `/etc/hostname` during `RUN`, so the Dockerfile can't write them; `le-init` does.
- Debian's default `MODULES=most` makes a 25 MB initrd, and unpacking it panics the 128 MB guest ("System is deadlocked on memory"). The Dockerfile sets `MODULES=list`, so only the 9p/virtio modules go in.
- agetty must run in its own session, detached from `/dev/console` (`setsid -w … < /dev/null`). Otherwise bash gets no controlling terminal, and Ctrl+C never reaches the program.
- On Apple silicon the i386 image builds under emulation (`vm:build` takes about 2 minutes once apt's layers are cached, and about 10 the first time). Docker Desktop updating itself mid-build kills the build with "error reading from server: EOF"; just rerun it.
- The ANSI-coloured prompt (TERM is `xterm-256color`, so Debian's `.bashrc` colours it): match prompts with `stripAnsi`.
- When driving the terminal from Chrome DevTools in a test, send real key events (`Input.dispatchKeyEvent`). `Input.insertText` doesn't reach xterm's `onData`.
