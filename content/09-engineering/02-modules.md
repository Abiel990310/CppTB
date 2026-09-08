---
title: "Modules"
navTitle: "Modules"
summary: >-
  The replacement for headers, and where support stands.
objectives:
  - Write and consume a module
  - Explain what modules fix about headers
  - Assess whether your toolchain can use them yet
status: complete
standard: c++20
requires: [build-systems]
---

Chapter 9.1 described `#include` as it is: textual pasting, performed before the
compiler sees anything, with every consequence that implies. Chapter 7.6
measured one of those consequences — an empty program taking 1,024 ms to compile
because of headers it does not use.

Modules replace the whole mechanism. A module is compiled once into a binary
artefact describing its interface, and importing it loads that artefact instead
of re-parsing text.

:::warning
None of the samples in this chapter can run on this page. GCC needs
`-fmodules-ts` for modules and the compiler backend here does not pass it. As
with the CMake chapter, everything below was built and run with GCC 13.3 before
it was written, and the outputs and error messages quoted are the real ones —
including the compiler crash further down, which is the most useful thing in
this chapter.
:::

## Writing one

A module interface unit — conventionally `.cppm`, though GCC accepts anything
you tell it is C++:

```cpp
// math.cppm
export module math;

export int add(int a, int b) { return a + b; }
export int square(int n) { return n * n; }

int helper(int n) { return n + 1; }          // not exported
export int bumped(int n) { return helper(n); }
```

And a consumer:

```cpp
// main.cpp
import math;
#include <cstdio>

int main() {
    std::printf("%d %d %d\n", add(2, 3), square(5), bumped(9));
}
```

Built with GCC 13:

```
$ g++ -std=c++20 -fmodules-ts -c -x c++ math.cppm -o math.o
$ g++ -std=c++20 -fmodules-ts -c main.cpp -o main.o
$ g++ math.o main.o -o app
$ ./app
5 25 10
```

The interface unit must be compiled **before** anything that imports it —
compiling `math.cppm` writes `gcm.cache/math.gcm`, and `import math;` reads it.
That ordering constraint is new: with headers, translation units could be
compiled in any order, and with modules they cannot. It is the single biggest
thing a build system has to learn.

## What `export` actually does

`helper` is in the module and not exported. It is not private, not `static`, and
not in an anonymous namespace — it simply is not part of the interface. A
consumer cannot see it:

```
main.cpp: In function 'int main()':
main.cpp:2:20: error: 'helper' was not declared in this scope
    2 | int main(){ return helper(1); }
```

This is genuinely new. With headers, "internal" means "in a `.cpp` file" or "in
an anonymous namespace" or "named `detail::`" — conventions, all of them
bypassable. A module's boundary is enforced by the language.

## The four things modules fix

**Macros do not escape.** A macro defined inside a module is not visible to
importers, at all:

```cpp
// mac.cppm
module;
#include <cstdio>
export module mac;
#define SECRET 42
export int reveal() { return SECRET; }
```

```
$ ./macapp
42
SECRET did not leak
```

`reveal()` returns 42, and `#ifdef SECRET` in the importing file is false. With
a header, `SECRET` would be defined in every file that included it and every
file those files included, forever. This alone removes an entire category of bug
— the `min`/`max` macros in `<windows.h>`, the `assert` that some header
redefined, the `#define private public` someone thought was clever.

**Order stops mattering.** Because there is no textual paste, `import a; import
b;` and `import b; import a;` are identical. Headers that only work when
included after another header cannot exist.

**One definition, once.** A module interface is compiled once. Ten translation
units importing it do not each re-parse and re-instantiate its templates.

**Build time.** Measured here, `#include <vector>` and `<map>` against importing
both as header units:

| | Time | Preprocessed lines |
|---|---|---|
| `#include <vector> <map>` | 319 ms | 30,818 |
| `import <vector>; import <map>;` | 195 ms | — |

About 40% faster for two headers. The `.gcm` files are large — 3.0 MB for
`<vector>`, 2.9 MB for `<map>` — because they hold a full parsed representation
rather than text, and that is the trade: disk and a build-ordering constraint,
in exchange for not re-parsing.

## Partitions

A large module can be split without exposing the split to consumers.

```cpp
// geo-shapes.cppm
export module geo:shapes;
export struct Point { double x, y; };
export double unit_area() { return 1.0; }
```

```cpp
// geo.cppm
export module geo;
export import :shapes;                    // re-export the partition
export double doubled_area() { return unit_area() * 2; }
```

A consumer writes `import geo;` and gets `Point`, `unit_area` and
`doubled_area`. It cannot write `import geo:shapes;` — partitions are visible
only within their own module. Built and run, that prints `1 2 2`.

This is the piece headers never had: a way to organise a component internally
without that organisation becoming part of its public surface.

## Whether you can use them yet

This is the objective that matters, and the honest answer for GCC 13.3 —
released in 2024, and what Ubuntu 24.04 ships — is *partly*.

| | Result |
|---|---|
| Named modules (`export module`) | **works** |
| Module partitions | **works** |
| Non-exported entities hidden | **works** |
| Macros contained | **works** |
| A header unit (`import <vector>;`) | works, after pre-building it |
| Two header units in one file | works |
| `<vector>`, `<string>` and `<map>` together | **internal compiler error** |
| `import std;` | **not available** |
| CMake 3.28 module support with GCC 13 | **refuses to configure** |

The compiler crash is worth quoting in full, because it is what using this
feature in 2024 actually looks like:

```
/usr/include/c++/13/bits/allocator.h:193:39: internal compiler error:
  in make_decl_rtl, at varasm.cc:1442
Please submit a full bug report, with preprocessed source
```

Three standard headers imported as header units, in one translation unit. Any
two of the three are fine. Nothing about the program is unusual.

And the build system, which is the other half of usable:

```
CMake Error in CMakeLists.txt:
  The target named "mathmod" has C++ sources that may use modules, but the
  compiler does not provide a way to discover the import graph dependencies.
```

CMake needs to know which module each file imports **before** compiling
anything, in order to compile them in the right order. That requires the
compiler to offer a dependency-scanning mode, and GCC 13 does not — so CMake
declines to generate a build at all.

:::standards
Where the ecosystem stands, at time of writing:

- **MSVC** has the most complete support, including `import std;`.
- **Clang 17+** supports named modules well and works with CMake 3.28's module
  support.
- **GCC 14+** adds the dependency scanning CMake needs; `import std;` arrives
  later still.
- **The standard library as a module** (`import std;`) is C++23, and is the
  thing most likely to make modules worth adopting, because it is where the
  build-time win is largest.

The practical advice: modules are not yet the default way to write C++, and a
new project betting on them today is betting on its contributors' toolchains.
Watch for `import std;` working across all three major compilers *and* the build
system you use — that is the point at which the calculation changes.
:::

## Migrating, when the time comes

You do not have to choose all at once. Three intermediate positions, in order of
effort:

**Import your own headers as header units.** `import "myheader.h";` treats an
existing header as a module without changing it. Nothing in the header needs to
be rewritten, and consumers get macro isolation and no re-parsing.

**Wrap a library in a module.** A module interface that includes the old headers
in its *global module fragment* and re-exports what it needs:

```cpp
module;
#include "legacy/everything.h"     // global module fragment: ordinary includes
export module mylib;

export using legacy::Widget;
export using legacy::make_widget;
```

Consumers get a module; the implementation is unchanged.

**Write new components as modules.** A module can `#include` headers and a
header cannot `import` a module cleanly, so the boundary between old and new
code has a direction: new code may depend on old, not the reverse.

## Check yourself

:::quiz
{
  "question": "A module defines `#define BUFFER_SIZE 4096` and exports a function that uses it. What does an importing file see?",
  "options": [
    { "text": "The function, and no macro — macros are not part of a module's interface and do not cross the boundary", "correct": true, "why": "This is one of the largest practical wins. A header's macros leak into every file that includes it, transitively and permanently; a module's do not leak at all." },
    { "text": "Both, as with a header", "why": "That is exactly the behaviour modules were designed to remove." },
    { "text": "The macro only if it is marked `export`", "why": "`export` applies to declarations. A macro is not a declaration and cannot be exported." },
    { "text": "Neither; a module cannot contain preprocessor directives", "why": "It can, and they work normally inside it. They just do not escape." }
  ]
}
:::

:::quiz
{
  "question": "Why does CMake 3.28 refuse to configure a C++ modules target with GCC 13?",
  "options": [
    { "text": "Module interfaces must be compiled before their importers, so the build system needs to scan the import graph first — and GCC 13 provides no way to do that scanning", "correct": true, "why": "Headers can be compiled in any order; modules cannot. Dependency scanning is the new requirement, and it arrived in GCC 14." },
    { "text": "CMake does not support modules at all", "why": "It does, from 3.28, and works with Clang 17 and MSVC. The missing piece here is on the compiler side." },
    { "text": "GCC does not implement modules", "why": "It does — the named modules in this chapter compile, link and run under GCC 13." },
    { "text": "The `.cppm` extension is not recognised", "why": "An extension is a convention; `-x c++` settles it. The error is explicitly about discovering import-graph dependencies." }
  ]
}
:::

## Practice

:::exercise module-boundary

:::exercise macro-free-interface

:::recap
- A module is compiled once into a binary interface; `import` reads that instead
  of re-parsing text. `export` decides what is visible, and what is not exported
  is genuinely unreachable rather than merely discouraged.
- Macros do not cross a module boundary in either direction — the single
  biggest practical improvement over headers.
- Import order stops mattering, and a module's templates are parsed once instead
  of once per consumer. Measured here: two header units, 195 ms against 319 ms.
- Partitions let a module be split internally without the split appearing in its
  interface.
- Interfaces must be built before their importers, which is a new constraint on
  build systems — and the reason CMake 3.28 refuses to configure a module target
  under GCC 13, which offers no dependency scanning.
- On GCC 13, named modules and partitions work; `import std;` does not exist,
  and three standard header units in one file crash the compiler. Clang 17+ and
  MSVC are further along.
- Migration has a direction: a module may include headers, so new code can
  depend on old and not the reverse.
:::
