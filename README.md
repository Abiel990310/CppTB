# The C++ Textbook

An interactive C++ book. Every code sample compiles and runs from the page,
every hard idea comes with a stepped diagram of what memory is doing, and every
practice problem is graded by a real compiler against real assertions.

Nine parts, 60 chapters, from "what is a compiler" to coroutines and cache
layout. It is being written a chapter at a time — see **[Progress](#)** on the
site, or `docs/ROADMAP.md`.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
```

With `g++` on your PATH, the Run buttons compile locally with AddressSanitizer
and UndefinedBehaviorSanitizer enabled, so the book can show you real diagnostics
for real bugs. Without a local compiler, the page falls back to Compiler
Explorer's public API and still runs everything.

```bash
npm run build          # static site into dist/ — 82 pages, no server needed
npm run serve          # serves dist/ plus the local compile endpoint on :4173
npm run verify         # compile every sample, grade every problem, typecheck
```

## What is where

```
content/         the book: one directory per part, one file per chapter
  exercises/     the problem bank, one file per problem
build/           markdown → static HTML pipeline (Shiki, custom block syntax)
src/components/  the four web components: runner, exercise, memviz, quiz
src/lib/         compile client, grading harness, editor, search, progress
server/          local compile-and-run backend
scripts/         verifiers that keep the book honest
docs/            AUTHORING.md (how to write a chapter), ROADMAP.md (what is next)
```

## Contributing a chapter

Read `docs/AUTHORING.md`. In short: the chapter template is fixed, every claim
needs a runnable demonstration, and `npm run verify` must pass — it compiles
every sample in the book and every problem's solution and starter.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. This needs Pages enabled once, by hand:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

`npm run build` produces a fully static `dist/`, deployable to any static host.
If it will not be served from the domain root, build with the prefix —
`CPPTB_BASE=/CppTB/ npm run build`. The compile endpoint is optional; without it
readers get the hosted compiler fallback.

To self-host the compiler as well, run `npm run serve` behind a reverse proxy.
**Read `docs/deployment.md` first** — it executes reader-supplied C++, and the
rlimits and timeouts in `server/compile.ts` are not a sandbox on their own.

## Licence

Not yet chosen. Add one before publishing.
