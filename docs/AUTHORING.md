# How to write a chapter

The book has one job: a reader finishes a chapter able to do something they
could not do before, and believes it because they watched it happen.

## Voice

Write like a good teacher who respects the reader's time.

- **Second person, present tense.** "You get a pointer", not "the user will
  receive a pointer".
- **Claim, then demonstrate.** Never assert a behaviour without a runnable
  sample the reader can press Run on. If it cannot be demonstrated, say why.
- **Explain the mechanism, not just the rule.** "Order members largest-first"
  is a rule; showing that `Wasteful` is 12 bytes and `Tight` is 8 is the reason.
  Rules without reasons do not survive contact with real code.
- **Name the failure mode.** Every powerful C++ feature has a way to hurt you.
  Say what it is, in a `:::pitfall` or `:::warning`, at the point where the
  reader is most likely to reach for it.
- **No hedging, no cheerleading.** Not "this is a really powerful feature!" —
  say what it does and what it costs.
- **British or American spelling — pick one and stay.** This book uses British
  (`behaviour`, `optimise`) in prose, and the standard's own spelling in
  technical terms (`std::optional`, "undefined behavior" when quoting).

Assume the reader has read the previous chapters and nothing else. If you need
something from three parts later, either explain it in one sentence or leave it
out.

## Chapter template

```markdown
---
title: "Chapter title"
navTitle: "Short title"          # optional, for the sidebar
summary: >-
  One sentence, shown on part pages and in search results.
objectives:                       # 2-4, each a thing the reader can DO
  - Explain what a vtable is and what a virtual call costs
  - Write a base class that is safe to delete through
status: draft                     # flip to `complete` when finished
standard: c++20
requires: [previous-chapter-slug] # optional
---

Two or three paragraphs that say why this chapter exists — what problem the
reader has that this solves. No preamble about what you are about to cover.

```cpp run title="A first demonstration"
// Something that runs and shows the idea in under 20 lines.
```

## A section per idea

Sections are `##`. Aim for four to seven per chapter. Each one earns its place
by teaching a distinct thing.

:::memviz
{ "title": "...", "steps": [...] }
:::

## Check yourself

:::quiz
{ "question": "...", "options": [...] }
:::

## Practice

:::exercise problem-id

:::recap
- Four to six bullets, each one a claim the reader can now defend.
:::
```

A finished chapter runs 1,500–3,000 words, has at least two runnable samples,
one diagram or quiz, and two problems. Longer is not better; the outline exists
so that a topic that needs more room gets its own chapter instead.

## Widget syntax

### Runnable code

````markdown
```cpp run                      Adds a Run button
```cpp run asm                  Adds an Assembly button too
```cpp run expect-error         Asserts it must NOT compile
```cpp run expect-ub            Asserts it compiles, runs, and trips a sanitizer
```cpp run std=c++23            Sets the standard for this sample
```cpp run title="Label"        Caption above the block
````

A line ending in `// [hidden]` is compiled but not shown — use it for the
`#include`s and `main` that make a fragment complete without cluttering it.

Both assertions are verified. `npm run verify:snippets` fails if an
`expect-error` sample compiles by accident, and equally if an `expect-ub` sample
runs clean — a demonstration of undefined behaviour that no longer demonstrates
anything is worse than none, because the prose still claims it does.

Use `expect-ub` for every sample whose purpose is to be caught. The runner then
labels the sanitizer output "which is the point" rather than presenting it as an
error, so the reader is not left wondering whether they broke something.

### Callouts

`:::note` `:::tip` `:::pitfall` `:::warning` `:::standards` `:::history`
`:::recap`, closed by `:::`. Use `:::warning` for undefined behaviour
specifically — the reader learns to read it as "this can silently corrupt your
program".

### Memory diagrams

A `:::memviz` block holding JSON:

```json
{
  "title": "What std::move does",
  "code": "optional source shown beside the diagram",
  "steps": [
    {
      "caption": "What happens at this step.",
      "line": 3,
      "note": "optional aside",
      "stack": [
        { "id": "s", "name": "s", "type": "std::string",
          "fields": [{ "k": "ptr", "v": "→", "anchor": "s.ptr" },
                     { "k": "size", "v": "5" }] }
      ],
      "heap": [ { "id": "h1", "value": "\"hello\"" } ],
      "arrows": [ { "from": "s.ptr", "to": "h1", "state": "dangling" } ]
    }
  ]
}
```

- `anchor` on a field is where an arrow starts; `id` on a box is where it ends.
- `state` on a box: `new` (green), `moved` (faded), `freed` (struck through),
  `danger` (red). On an arrow: `dangling` (red, dashed).
- Steps should change **one** thing each. Four to six steps is the sweet spot.

### Quizzes

Every option needs a `why`, including the correct one. The explanation of the
tempting wrong answer is the part that teaches — write it as carefully as the
prose.

## Writing a problem

One file in `content/exercises/`, front-matter plus five sections:

```markdown
---
id: erase-evens                  # becomes /practice/erase-evens/
title: "Erase without invalidating"
difficulty: intro | core | stretch | deep
chapter: algorithms              # chapter slug this belongs to
topics: [containers, algorithms] # drives the filters on /practice/
check: unit                      # or `output`
standard: c++20
---

The prompt. Say what to write and what counts as correct. State any constraint
that the checks enforce, so failing is informative rather than mysterious.

## Starter
```cpp
// What the reader begins with. It must compile if at all possible, and must
// NOT already pass — the verifier rejects a problem whose starter passes.
```

## Tests
```cpp
CHECK_EQ(f(2), 4);
CHECK(v.empty());
```

## Hints
- Progressive. The first nudges, the last nearly gives it away.

## Solution
```cpp
// A complete, idiomatic solution.
```

## Notes
Why the solution is written this way, and what the interesting check was really
testing.
```

**`check: unit`** — the Tests section is a body of statements run inside a
generated `main()`. `CHECK(expr)`, `CHECK_EQ(a, b)`, and `CHECK_NEAR(a, b, eps)`
are available; failures report the expression with the actual and expected
values. The reader writes declarations only, no `main`.

**`check: output`** — the reader writes a whole program and the Tests section is
the exact stdout it must produce. Use `stdin:` in the front-matter to feed it
input.

The harness includes `<cstdio>`, `<cmath>`, `<ostream>`, `<sstream>`,
`<string>`, and `<type_traits>` before the reader's code. `<cmath>` drags the C
math functions into the global namespace, so a global named `log`, `abs`, `y1`,
or `remainder` will collide. Prefix or rename globals in starters — `event_log`,
not `log`.

Problems run under AddressSanitizer with leak detection on, so a memory leak
fails a problem even when every assertion passes. Say so in the prompt when the
problem is about ownership.

## Before you commit

```bash
npm run verify
```

While writing, the targeted forms are much faster and check exactly what you
changed:

```bash
npm run verify:snippets 04-library/03-associative   # one chapter's samples
npm run verify:problems map-lookup custom-hash      # named problems only
```

Run the full `npm run verify` before committing regardless — it is what CI runs.

This compiles every runnable sample, asserts the `expect-error` ones fail,
compiles each problem's solution (must pass) and starter (must fail), and
typechecks the site. It takes a couple of minutes because it is really invoking
a compiler a hundred times. That is the point.
