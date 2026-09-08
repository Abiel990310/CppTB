---
title: "Inlining, linking, and layout"
navTitle: "Inlining and linking"
summary: >-
  How the build shapes the final program's speed.
objectives:
  - Explain what inline actually means
  - Describe link-time optimization and its cost
  - Reduce binary size and build time deliberately
status: complete
standard: c++20
requires: [zero-cost]
---

Everything so far in this part has been about one translation unit. Real
programs are hundreds, compiled separately and stitched together at the end, and
the seam is where the optimiser stops being able to help you.

This chapter is about the seam: what `inline` really does (not what its name
says), what the linker can recover, and the two costs nobody measures — build
time and binary size.

```cpp run asm title="Which of these is 'inline'?"
#include <iostream>

inline int marked(int n) {
    return n * 5 + 1;
}

int unmarked(int n) {
    return n * 5 + 1;
}

int caller(int n) {
    return marked(n) + unmarked(n);
}

int main() {
    int value = 0;
    std::cin >> value;
    std::cout << caller(value) << '\n';
}
```

Open the Assembly view. `_Z6calleri` contains no `call` at all: **both**
functions were inlined into it. Now search for their definitions.
`_Z8unmarkedi` is there, a standalone copy of the function. `_Z6markedi` is
**not**.

The keyword did not decide which call got inlined. It decided which function
needed a copy left behind.

## What `inline` actually means

`inline` is a rule about the **one definition rule**, not about code generation.
It says: this function may be defined identically in more than one translation
unit, and the linker should keep one copy rather than rejecting the program for
having several.

That is the entire semantic, and it exists for one reason: to let you put a
function body in a header. Without `inline`, a header defining `int square(int
n) { return n * n; }` and included by three `.cpp` files produces three
definitions and a link error.

It also implies "you need not emit a standalone copy if nobody in this
translation unit needs one", which is what the sample above shows.

Several things are **implicitly** `inline`, which is why you rarely write it:

| Implicitly inline | Because |
|---|---|
| a member function defined inside its class | the class is in a header |
| a `constexpr` function | it must be visible to be evaluated |
| a function template's instantiations | the same instantiation appears in every TU that uses it |
| a `constexpr` variable at namespace scope | since C++17 |

C++17 also added `inline` **variables**, which finally solved header-only global
state: `inline int counter = 0;` in a header gives one `counter` for the whole
program.

:::pitfall
As a hint to the optimiser, `inline` is close to meaningless — compilers have
ignored it in that role for two decades, because they have a cost model and you
do not. Every mainstream compiler decides by weighing the callee's size against
the number of call sites, and its decision is better than your guess. The
attributes that *do* force the issue — `__attribute__((always_inline))` and
`noinline` on GCC and Clang, `__forceinline` on MSVC — are non-standard and
almost always the wrong tool.
:::

## The real precondition: the compiler must see the body

A compiler cannot inline a function whose body it has never read. That single
fact explains most of what follows.

- A function defined in a header is visible everywhere it is used, so it can be
  inlined everywhere. This is why header-only libraries perform well, and why
  they cost so much to compile.
- A function defined in another `.cpp` file is, at the point of the call, just a
  symbol name. The compiler emits a `call` and moves on.

The `static` keyword — or better, an anonymous namespace — makes the opposite
promise, and buys something for it:

```cpp run asm title="Functions that leave no trace"
#include <iostream>

namespace {
int scale(int n) { return n * 7; }      // internal linkage
}

static int offset(int n) { return n + 3; }   // also internal linkage

int exported(int n) { return n * 13; }       // external linkage

int main() {
    int value = 0;
    std::cin >> value;
    std::cout << scale(value) + offset(value) + exported(value) << '\n';
}
```

In the assembly, `_Z8exportedi` is emitted as a symbol. `scale` and `offset`
are not there at all — inlined into `main`, with no copy left behind, because
nothing outside this file could possibly have called them.

That is the practical rule: **anything not part of a file's interface belongs in
an anonymous namespace.** It shrinks the symbol table, it removes the function
from anyone else's link, and it lets the optimiser reason about all the callers
because it can see all of them.

## Link-time optimisation

LTO gets the seam back. With `-flto`, the compiler emits its internal
representation into the object files instead of finished machine code, and the
linker runs the optimiser again with the whole program in view.

Two files. `lib.cpp` defines `int helper(int x) { return x * 3 + 1; }`;
`main.cpp` declares it in a header and calls it in a loop:

```cpp
int compute(int n) {
    int total = 0;
    for (int i = 0; i < n; ++i) total += helper(i);
    return total;
}
int main() { std::printf("%d\n", compute(1000)); }
```

Compiled normally, `compute` is 26 instructions with a `call helper` inside the
loop, and `helper` appears in the finished binary as a symbol. Compiled with
`-flto` on every compile *and* on the link, the final binary's `main` is:

```
mov    $0x16e16c,%edx
call   printf
```

`0x16e16c` is 1,499,500 — the answer. The loop, the call, `compute` and `helper`
were all inlined and folded into a single constant, and `helper` is not in the
binary at all.

The costs are real:

- **Link time.** The optimiser now runs over the whole program, at the point in
  the build where nothing can be parallelised by file. On a large project this
  can turn a two-second incremental link into a minute. `-flto=auto` parallelises
  it; it is still the slowest step.
- **Memory.** Whole-program optimisation needs the whole program in memory.
- **Debuggability.** Stack traces get stranger, because functions genuinely no
  longer exist.
- **Bugs surface.** LTO applies cross-file the same assumptions the compiler was
  always allowed to make. Code with a latent ODR violation or a strict-aliasing
  bug often works without LTO and breaks with it. The bug was already there.

Use it for release builds, not for the edit-compile-test loop.

## Binary size

Templates instantiate per type, and each instantiation is a separate function in
the binary.

```cpp run asm title="One template, six functions"
#include <iostream>
#include <string>
#include <vector>

template <class T>
std::string describe(const std::vector<T>& values) {
    std::string out = "[";
    for (const T& x : values) {
        out += std::to_string(x);
        if (x > T{0}) out += "+";
        else if (x < T{0}) out += "-";
        else out += "0";
        out += ' ';
    }
    out += "] (";
    out += std::to_string(values.size());
    out += " items)";
    return out;
}

int main() {
    std::cout << describe(std::vector<int>{1}).size()
              << describe(std::vector<long>{2}).size()
              << describe(std::vector<double>{3}).size()
              << describe(std::vector<unsigned>{4}).size()
              << describe(std::vector<float>{5}).size()
              << describe(std::vector<long long>{6}).size() << '\n';
}
```

Six instantiations, six function bodies in the object file — each marked as a
weak symbol so that duplicates from other translation units are folded at link
time. The C++ code says "one function". The binary contains six.

That is usually a fine trade, and it is the direct cost of the speed measured in
the previous chapter. When it is not fine, the levers are:

| Lever | What it does |
|---|---|
| `-Os` | optimise for size instead of speed |
| `-ffunction-sections -fdata-sections -Wl,--gc-sections` | let the linker drop unreferenced functions |
| `strip` | remove the symbol table from the shipped binary |
| `extern template class Foo<int>;` | suppress instantiation here; it exists in one TU |
| outlining | move the type-independent part of a template into a plain function |

Measured on the six-instantiation program above: 35,136 bytes at `-O2`, 24,192
at `-Os`, 24,016 with section garbage collection, and 18,656 after `strip` —
about half the original, and `strip` alone accounts for a fifth of it. That last
one is free: it removes the symbol table, which the program does not need to
run, only you need to read a stack trace.

## Build time

The cost nobody profiles, paid by every developer on every build. The mechanism
is textual inclusion: `#include` pastes a file in, transitively.

Four programs, all of which just print `"hi"`:

| Includes | Lines after preprocessing | Compile time |
|---|---|---|
| `<cstdio>` | 1,052 | 35 ms |
| `+ <vector> <string>` | 36,508 | 381 ms |
| `+ <regex>` | 78,112 | 775 ms |
| `+ <ranges> <algorithm> <map> <unordered_map> <sstream>` | 96,631 | 1,024 ms |

Twenty-nine times slower to compile a program that does nothing, because of
headers it does not use. Multiply by a thousand files and by every rebuild.

What actually helps, in order of leverage:

1. **Do not include what you do not use.** A forward declaration —
   `class Widget;` — is enough for a pointer, a reference, or a function
   declaration that takes one. You need the full definition only to create one,
   to hold one by value, or to call a member.
2. **Move implementation out of headers.** Anything not a template and not tiny
   belongs in a `.cpp`. The cost is losing cross-TU inlining — which LTO gives
   back, in the release build where it matters.
3. **PIMPL.** Hold a pointer to an implementation class declared but not defined
   in the header. Then the header depends on nothing the implementation depends
   on, and changing the implementation does not rebuild every user.
4. **Precompiled headers and unity builds.** Effective and blunt; they treat the
   symptom.
5. **Modules.** The actual fix — a module is compiled once and imported as
   structured data rather than pasted in as text. Chapter 9.2.

:::warning
PIMPL is not free either, and the trade runs the other way from everything else
in this part: it costs a heap allocation per object and an indirection per member
access, and it prevents inlining of every method. It is the right answer for a
compilation firewall in a library many files depend on, and the wrong one for a
`Point`.
:::

## Check yourself

:::quiz
{
  "question": "You mark a function `inline` and the compiler does not inline it. Is the compiler ignoring you?",
  "options": [
    { "text": "No — `inline` is a rule about the one definition rule, not a request. It permits multiple identical definitions across translation units, and its effect on inlining is advisory at most", "correct": true, "why": "That is why you write it on header functions and almost never elsewhere, and why members defined in-class and constexpr functions are implicitly inline." },
    { "text": "Yes, but only at -O0", "why": "The compiler decides at every level by its own cost model. `inline` has never been the deciding input." },
    { "text": "No — inlining requires `always_inline`", "why": "Compilers inline unmarked functions constantly. The sample in this chapter inlines a function with no keyword on it at all." },
    { "text": "Yes; the keyword is a mandate the standard leaves unenforced", "why": "It is not a mandate about code generation at all. The standard's rule is about definitions and linkage." }
  ]
}
:::

:::quiz
{
  "question": "A project builds cleanly and passes its tests. Enabling `-flto` makes it crash. What is the most likely explanation?",
  "options": [
    { "text": "A latent bug — an ODR violation or a strict-aliasing assumption — that only became visible once the optimiser could see across files", "correct": true, "why": "LTO applies across translation units the assumptions the compiler was always entitled to make within one. The bug predates the flag; the flag exposed it." },
    { "text": "LTO is unstable and should not be used in production", "why": "It ships in every major toolchain and is used widely in production. A crash that appears with it is nearly always a real defect." },
    { "text": "The linker ran out of memory", "why": "That produces a link failure, not a crash in the built program." },
    { "text": "LTO changed the ABI", "why": "It does not; the calling convention and layout rules are unchanged." }
  ]
}
:::

## Practice

:::exercise outline-the-template

:::exercise pimpl-the-class

:::recap
- `inline` is a one-definition-rule permission, not an inlining request. It lets
  a definition live in a header, and it lets the compiler omit a standalone copy.
- Members defined in-class, `constexpr` functions, and template instantiations
  are implicitly inline. C++17 added `inline` variables for header-only globals.
- Inlining requires the body to be visible. That is the whole argument for
  header-only libraries, and the whole argument against them.
- Anything not part of a file's interface belongs in an anonymous namespace: the
  symbol disappears and the optimiser gets to see every caller.
- LTO recovers cross-file inlining and can fold a whole call chain into a
  constant. It costs link time, memory, debuggability, and it exposes latent
  ODR and aliasing bugs.
- Templates cost binary size, one body per instantiation. `-Os`,
  `--gc-sections`, `strip`, `extern template`, and outlining are the levers.
- Build time is a real cost measured by nobody: seven unused standard headers
  took an empty program from 35 ms to 1,024 ms. Include less; move
  implementations into `.cpp` files; use modules when you can.
:::
