---
title: "Headers, translation units, and linking"
navTitle: "Translation units"
summary: >-
  Why the same code compiles once but links twice, and what ODR means.
objectives:
  - Explain the compile-then-link model
  - Fix a duplicate-symbol and an undefined-symbol error
  - State the one-definition rule and how to satisfy it
status: complete
standard: c++20
requires: [inlining-and-linking]
---

C++ inherited its build model from C in 1979, and it has barely changed: each
`.cpp` file is compiled alone, in complete ignorance of every other file, and a
separate program stitches the results together at the end.

Almost every confusing build error comes from that split — from something being
true in one file and not another, or from a name that the compiler was happy to
believe in and the linker could not find. This chapter is about knowing which
half of the build is complaining, and why.

## Four programs, not one

`g++ main.cpp -o app` runs four tools in sequence. You can stop after any of
them:

| Command | Stops after | Produces |
|---|---|---|
| `g++ -E main.cpp` | the **preprocessor** | one enormous C++ file, with every `#include` pasted in |
| `g++ -S main.cpp` | the **compiler** | assembly for that file alone |
| `g++ -c main.cpp` | the **assembler** | `main.o`, machine code with a symbol table |
| `g++ main.o util.o -o app` | the **linker** | an executable |

The unit the compiler works on is the output of stage one: a **translation
unit**, meaning your `.cpp` plus everything it included, transitively. That is
the entire world as far as the compiler is concerned. A function in another file
does not exist; it is a name in a table, marked "somebody else's problem".

```
$ g++ -c main.cpp && nm -C main.o
0000000000000000 T main
                 U net::send(char const*, int)
```

`T` means *this file defines it*. `U` means *undefined here — linker, find it*.
Every build error in this chapter is one of those two letters being wrong.

## Declare as often as you like; define once

A **declaration** introduces a name and its type. A **definition** provides the
thing itself. Headers carry declarations; exactly one `.cpp` carries the
definition.

```cpp
int parse(std::string_view text);          // declaration — no body
int parse(std::string_view text) { … }     // definition
```

Repeat a declaration as often as you like — that is what including a header ten
times does. Provide two definitions and you have a problem, and *which* problem
depends on whether they are in the same file.

### Undefined symbol: the linker cannot find it

```cpp run expect-error title="Declared, called, never defined"
#include <iostream>

int checksum(int value);          // promised

int main() {
    std::cout << checksum(41) << '\n';
}
```

> undefined reference to `checksum(int)`

Read that message carefully, because it names the tool: `/usr/bin/ld`. The
*compiler* was perfectly happy — it saw a declaration, so it knew the call was
type-correct and emitted a `call` to a symbol. The **linker** then went looking
and found nothing.

Undefined-symbol errors have four usual causes, in decreasing order of
frequency:

1. You wrote the declaration and forgot the definition — or defined it with a
   slightly different signature, so the mangled names do not match. A `const` on
   a parameter, a missing `&`, a member defined outside its class without the
   `Widget::` prefix.
2. You forgot to add the `.cpp` to the build.
3. You forgot to link the library: `-lfoo`.
4. You linked it in the wrong order (see below).

### Duplicate symbol: two definitions

Within one file, this is a *compiler* error:

```cpp run expect-error title="Two definitions in one translation unit"
int limit() { return 10; }
int limit() { return 20; }

int main() { return limit(); }
```

> error: redefinition of 'int limit()'

Across two files it is a *linker* error, and the message is different:

```
/usr/bin/ld: b.o: in function `limit()':
b.cpp:(.text+0x0): multiple definition of `limit()'; a.o:a.cpp:(.text+0x0): first defined here
```

That is what happens when a function body ends up in a header without `inline`
and two `.cpp` files include it. Chapter 7.6 covered the fix: `inline` exists
precisely to say "several identical copies of this are expected; keep one".

## The one definition rule

Stated properly, the ODR has three parts:

1. Every **entity** — variable, function, class, template — may be *defined* at
   most once in any one translation unit.
2. Every non-inline function and variable that is *used* must be defined exactly
   once in the whole program.
3. A class, an inline function, or a template may be defined in several
   translation units, **provided every definition is token-for-token identical
   and means the same thing** in each.

Parts 1 and 2 are the errors above; the compiler and linker enforce them. Part 3
is the dangerous one, because **no diagnostic is required**. Two files:

```cpp
// a.cpp
struct Config { int a; int b; };            // 8 bytes
```
```cpp
// b.cpp
struct Config { int a; int b; double c; };  // 16 bytes
```

This links without a word of complaint, and each file goes on using its own idea
of the layout. Run it and each prints its own `sizeof`:

```
sizeof in a.cpp = 8
sizeof in b.cpp = 16
```

Now pass a `Config` from one to the other and one of them writes past the end of
the object. There is no error, no warning, and no sanitizer report — just
corruption whose cause is in a file that appears unrelated.

:::warning
This is why "the definition of a type lives in exactly one header, and everyone
includes that header" is not a style preference. Any arrangement where two files
can disagree about a class, an inline function, or a template is a silent
memory-corruption bug waiting for someone to change one copy.

The most common real cause is not copy-pasted structs; it is a macro or a
compiler flag that changes a class's contents in some files and not others —
`#ifdef DEBUG` adding a member, or two libraries built with different
`-D` settings. Chapter 7.6's note about LTO exposing latent bugs is usually
this bug.
:::

## Header guards, and what a header owes you

A header may be included twice in one translation unit — directly and through
another header — and the second inclusion would redefine everything. Every
header therefore needs a guard:

```cpp
#ifndef PROJECT_PARSER_H          // #pragma once does the same job in one line,
#define PROJECT_PARSER_H          // is supported everywhere in practice, and is
                                  // not in the standard.
…

#endif  // PROJECT_PARSER_H
```

Two other obligations, both easy to forget:

**A header must be self-contained.** It compiles on its own, including whatever
it needs. A header that works only when included after another one is a trap
that goes off when someone reorders includes. The cheap way to enforce this: in
`parser.cpp`, include `parser.h` *first*, before anything else. Then any missing
include in the header is a compile error in the file most likely to be fixed.

**A header should include as little as possible.** Chapter 7.6 measured the
cost. Forward-declare (`class Widget;`) when a pointer or reference is all you
need.

## Linkage: who else can see this name

Three kinds, and one of them surprises people.

| Linkage | Means | How you get it |
|---|---|---|
| **external** | other translation units can refer to it | the default for functions and non-`const` namespace-scope variables |
| **internal** | visible only in this translation unit | `static`, an anonymous namespace, and `const`/`constexpr` at namespace scope |
| **none** | not a linker-visible name at all | anything local to a function or a block |

The surprise is the third entry on the internal row. At namespace scope,
`const int limit = 10;` has **internal** linkage in C++ — unlike in C. That is
deliberate: it lets you put `const` constants in headers without every including
file fighting over the definition. The consequence is that

```cpp
const int limit = 10;         // internal: every file gets its own
int other = 20;               // external
extern const int shared = 30; // external, because of `extern`
```

produces a symbol table with `other` and `shared` in it and **no `limit` at
all** — it was folded into its uses and never given an address.

Prefer an anonymous namespace to `static` for internal linkage: it works for
types as well as functions and variables, and it is what the standard's own
wording is built around.

## Mangled names, and `extern "C"`

C++ has overloading and namespaces; the linker has a flat list of strings. The
compiler bridges the gap by encoding the full signature into the symbol.

```cpp run asm title="What the linker actually sees"
#include <iostream>

int add(int a, int b) { return a + b; }
double add(double a, double b) { return a + b; }

namespace net {
int send(const char* data, int length) { return data ? length : -1; }
}

extern "C" int c_style_add(int a, int b) { return a + b; }

int main() {
    std::cout << add(1, 2) << ' ' << add(1.5, 2.5) << ' '
              << net::send("x", 1) << ' ' << c_style_add(3, 4) << '\n';
}
```

In the assembly:

| Source | Symbol |
|---|---|
| `add(int, int)` | `_Z3addii` |
| `add(double, double)` | `_Z3adddd` |
| `net::send(const char*, int)` | `_ZN3net4sendEPKci` |
| `c_style_add(int, int)` | `c_style_add` |

The two overloads get different symbols, which is *how* overloading survives to
link time. `extern "C"` turns the mangling off, which is how C++ code exposes
functions callable from C, from Python's `ctypes`, or from anything else that
expects a plain name. The cost is that an `extern "C"` function cannot be
overloaded — there would be nothing to tell the two symbols apart.

`nm -C` and `c++filt` translate mangled names back, and you will want them the
first time a linker error prints one at you.

## Libraries, and the link order that bites everyone

A **static library** (`.a`) is an archive of `.o` files. A **shared library**
(`.so`, `.dylib`, `.dll`) is loaded at run time and shared between processes.

For static libraries, the order of arguments on the link command matters:

```
$ g++ -L. -lmine app.o -o app        # wrong
/usr/bin/ld: app.o: undefined reference to `lib_value()'

$ g++ app.o -L. -lmine -o app        # right
```

The traditional Unix linker makes a single left-to-right pass. When it reaches
`-lmine` it pulls in only the archive members that resolve symbols it
*already knows* are missing. Listed first, nothing is missing yet, so it takes nothing —
and then `app.o` arrives needing a symbol that has already been passed over.

**Put the things that need symbols before the things that provide them.**
Objects, then your libraries, then system libraries.

## Check yourself

:::quiz
{
  "question": "`undefined reference to 'Widget::render() const'` — which tool produced this, and what does it tell you?",
  "options": [
    { "text": "The linker. The compiler saw a declaration and was satisfied; no translation unit in the link provided a definition", "correct": true, "why": "The message names `ld`. Usual causes: the .cpp is not in the build, the definition's signature differs slightly, or a library is missing or listed in the wrong order." },
    { "text": "The compiler, because the header was not included", "why": "A missing declaration is a compile error that says 'was not declared in this scope'. This message means the declaration was found." },
    { "text": "The preprocessor, because of a missing include guard", "why": "A missing guard produces redefinition errors, not undefined references." },
    { "text": "The loader, at program startup", "why": "That produces a different message about a shared object, and only for dynamic libraries." }
  ]
}
:::

:::quiz
{
  "question": "Two `.cpp` files define `struct Config` with different members. What happens?",
  "options": [
    { "text": "It links silently and each file uses its own layout — an ODR violation, which requires no diagnostic and behaves as memory corruption", "correct": true, "why": "The class definition is not a symbol the linker compares. This is the failure mode that makes 'one header, everyone includes it' a correctness rule rather than a style rule." },
    { "text": "A multiple-definition linker error", "why": "That is for functions and variables. A class definition emits no symbol to collide." },
    { "text": "A compile error in the second file", "why": "Neither file can see the other; each compiles alone and is internally consistent." },
    { "text": "The linker picks the larger definition to be safe", "why": "The linker never sees either definition. Each object file was generated with its own idea of the layout already baked in." }
  ]
}
:::

## Practice

:::exercise fix-the-link

:::exercise construct-on-first-use

:::recap
- The build is four programs. The preprocessor pastes headers in, the compiler
  sees one translation unit and nothing else, and the linker resolves the names
  it left undefined. `nm -C` shows which is which: `T` defined here, `U` wanted.
- Declare freely; define once. A missing definition is a *linker* error; two
  definitions in one file are a *compiler* error; two definitions across files
  are a linker error again.
- The ODR's third clause — identical definitions of classes, inline functions
  and templates across files — is unenforced. Violating it corrupts memory
  silently, which is why a type gets exactly one header.
- Every header needs a guard, must compile on its own, and should include as
  little as it can get away with.
- `const` at namespace scope has internal linkage in C++, so each file gets its
  own copy and no symbol is emitted. Use an anonymous namespace when you want
  that deliberately.
- Overloads survive to link time because names are mangled with their signature.
  `extern "C"` turns that off, and with it overloading.
- A static library is only searched for symbols already known to be missing, so
  list objects before the libraries that satisfy them.
:::
