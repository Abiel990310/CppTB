# CppTB — working notes for Claude

An interactive C++ textbook. 60 chapters across 9 parts, every code sample
compiled by a real compiler, every practice problem auto-graded.

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

1. Open `docs/ROADMAP.md`; take the top unwritten chapter.
2. Read the two neighbouring chapters so the voice and the assumed knowledge
   carry over. Read the chapter's own front-matter: the objectives are already
   fixed and are a contract.
3. Write it against the template in `docs/AUTHORING.md`.
4. Add 2–4 problems to `content/exercises/` for it.
5. `npm run verify`. Fix what it reports. It is never wrong about compilation.
6. Flip `status: draft` to `status: complete` in the front-matter — that is what
   moves the bar on `/progress/`.
7. Commit one chapter per commit, message `content: write <chapter title>`.

One chapter per session is a good pace. Do not batch five half-written chapters;
a finished chapter is worth more than five outlines, and the outlines already
exist.

## This book writes itself on a schedule

A Routine (`trig_01SZHxiCeEjK5AB26FfzDjQH`, **hourly**) spawns a fresh session
that takes the top unticked chapter from `docs/ROADMAP.md`, writes it, verifies
it, and pushes. That is why the roadmap and the authoring guide have to stay
accurate: they are the entire brief a cold session gets.

Consequences worth knowing:

- **Another session is probably working right now.** At an hourly cadence, runs
  overlap: a chapter takes a while, mostly in `npm run verify`. Always `git pull
  --rebase origin <branch>` immediately before pushing, and if the rebase brings
  in anything, re-run `npm run verify` before you push — a clean rebase does not
  prove the combined tree still builds. A rejected push means someone got there
  first; rebase, never force.
- **Re-read `docs/ROADMAP.md` right before you start writing**, not from memory.
  Another run may have ticked your chapter while you were reading the
  neighbours. If your chapter is already `status: complete`, take the next
  unticked one instead of duplicating the work.
- **Do not create a second Routine** for the same job. Check with
  `list_triggers` first; edit the existing one with `update_trigger`.
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
