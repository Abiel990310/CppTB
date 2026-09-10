# CppTB — working notes for Claude

An interactive C++ textbook. Every code sample is compiled by a real compiler
and every practice problem is auto-graded.

**Parts 1–9 are finished** (60 chapters), and **Part 10 is under way**: 10.1
through 10.22 are written — Waves A–D of the forty-chapter plan near the bottom
of `docs/ROADMAP.md`, plus the first two chapters of Wave E. The engine work
listed there is done. As of the last full run: 482 samples and 197 problems, all
verified. The next unticked chapter is 10.23, Minimum spanning trees.

Take the top unticked chapter in the earliest incomplete wave. Where a planned
title turns out to overlap a chapter already written, retitle it in the roadmap
with a one-line reason rather than writing a redundant chapter — 10.12 is the
precedent.

**Read `docs/AUTHORING.md` before writing any chapter.** It holds the voice,
the chapter template, and the widget syntax. This file is the map; that one is
the method.

## The one rule

Nothing in this book ships unverified. Two scripts enforce it, and both must
pass before any commit:

```bash
npm run verify      # snippets compile, problems grade, types check
```

If a claim cannot be demonstrated by a program that runs, either write the
program or delete the claim. A textbook that is confidently wrong is worse than
one that is short.

## Layout

| Path | What it is |
|---|---|
| `content/NN-part/NN-chapter.md` | The book. Directory = part, file = chapter; `NN-` sets order only. |
| `content/exercises/*.md` | The problem bank. One file per problem, self-contained. |
| `build/` | Markdown → HTML pipeline. `markdown.ts` owns the custom syntax. |
| `src/components/` | The four web components: runner, exercise, memviz, quiz. |
| `src/lib/harness.ts` | The C++ harness that grades submissions. Change with care. |
| `server/compile.ts` | Local compile-and-run backend, with sanitizers on. |
| `scripts/` | The verifiers. Run them; do not skip them. |
| `docs/ROADMAP.md` | **What to write next.** Start here each session. |

## Commands

```bash
npm run dev        # localhost:5173, live reload on content changes
npm run verify     # everything below, in one go
npm run verify:snippets [chapter-slug]   # compile every runnable sample
npm run verify:problems                  # solutions pass, starters fail
npm run build && npm run serve           # static build + local compiler on :4173
```

Compilation needs `g++` on PATH. Without it the site still works — the browser
falls back to Compiler Explorer's public API — but the verify scripts will not
run.

## How a session should go

1. Open `docs/ROADMAP.md`; take the top unticked item. For Parts 1–9 there is
   nothing left; the queue is the Part 10 plan and the engine work above it.
2. For a chapter: read its neighbours so the voice and the assumed knowledge
   carry over, and read its front-matter — the objectives are fixed and are a
   contract.
3. Write it against the template in `docs/AUTHORING.md`.
4. Add its problems. Part 10 chapters carry both kinds: two function-style
   (`check: unit`) and two or three judge-style (`check: output`).
5. `npm run verify`. Fix what it reports. It is never wrong about compilation —
   when it contradicts the prose, the prose is wrong.
6. Flip `status: draft` to `status: complete` — that is what moves the bar on
   `/progress/`.
7. Commit one chapter per commit, message `content: write "<chapter title>"`.

One chapter per session is a good pace. Do not batch five half-written chapters;
a finished chapter is worth more than five outlines, and the outlines already
exist.

## Scheduling

**Maintenance mode.** JavaTB reached Parts 1–9 complete, and the author asked
for both books to be maintained slowly from there: plan in the morning, then do
one item. This book is **no longer paused**, and is no longer written at speed
either.

- **`trig_017zYznE5wwj44ZGRirzmBRL`** — once a day at 23:00 UTC, which is 07:00
  in the author's timezone (UTC+8). It resumes the *existing* long-running
  session so it keeps its context. It drove this book, then JavaTB, and now
  covers **both**. Do not create a second Routine alongside it.
- Each run takes **one** item — the top unticked chapter here (10.23 onward),
  or something from the standing-work list below, or an item from JavaTB's
  maintenance queue — finishes it, verifies it, and pushes. One item, not three.
- **`trig_01SZHxiCeEjK5AB26FfzDjQH`** — hourly, spawned a fresh session per run.
  Disabled, and should stay that way: a cold start re-reads this file, the
  authoring guide and two neighbouring chapters before writing a line, which
  cost far more than it produced.

Consequences worth knowing:

- **No other session is currently writing.** If a second session is ever
  started against either book, runs will overlap, and then you must
  `git pull --rebase origin <branch>` immediately before pushing and re-run
  `npm run verify` if the rebase brought anything in. A rejected push means someone got there first; rebase, never
  force.
- **Do not create a second Routine** for the same job. Check with
  `list_triggers` first and edit the existing one with `update_trigger`.
- **Pushing `main` deploys the site.** `.github/workflows/deploy.yml` builds
  with the Pages sub-path base and force-pushes `dist/` to `gh-pages`, which
  GitHub serves at https://abiel990310.github.io/CppTB/. The `gh-pages` branch
  is generated output — never edit or commit to it by hand.

## Invariants that are easy to break

- **Every chapter's front-matter needs `objectives`.** `/reference/` and
  `/progress/` are generated from it, and a chapter with no objectives silently
  becomes a blank row.
- **Titles containing a colon must be quoted** in YAML front-matter.
- **`status: complete` is a claim.** Set it only when the prose is finished,
  the samples run, and the recap is written.
- **Exercise ids are URLs.** Renaming one breaks `/practice/<id>/` and any
  `:::exercise` reference. Grep before renaming.
- **The harness is prepended to unit-mode submissions**, so a reader's compiler
  errors are remapped with `#line` to `your code`. If you change
  `src/lib/harness.ts`, re-run `npm run verify:problems` — every problem depends
  on it.
- **`content/` is the only source of truth for structure.** There is no separate
  nav or TOC file to update; adding a `.md` file adds a chapter.
