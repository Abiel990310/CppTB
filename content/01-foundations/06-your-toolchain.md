---
title: "Your toolchain"
navTitle: "Your toolchain"
summary: >-
  Compiler flags, warnings, debuggers, and sanitizers — the tools that turn silent bugs into loud ones.
objectives:
  - Compile with a warning set that catches real bugs
  - Run a program under AddressSanitizer and read its report
  - Step through a program in a debugger and inspect a variable
status: complete
standard: c++20
requires: [functions]
---

Every sample in this book has been compiled with a particular set of flags, and
that choice has been doing real work — catching mistakes in the writing, and
producing the diagnostics you have been reading. This chapter is that command
line, explained.

## The command line

```bash title="What this book compiles with"
g++ -std=c++20 -Wall -Wextra \
    -fsanitize=address,undefined -fno-omit-frame-pointer -g \
    -o program main.cpp
./program
```

Piece by piece:

| Flag | What it does |
|---|---|
| `-std=c++20` | Selects the language version. Without it you get the compiler's default, which may be older than you expect. |
| `-Wall -Wextra` | Turns on the warnings worth having. Not "all" warnings despite the name. |
| `-fsanitize=address,undefined` | Instruments the program to detect memory errors and undefined behaviour at run time. |
| `-fno-omit-frame-pointer` | Keeps stack traces readable in sanitizer reports. |
| `-g` | Emits debug information: function names and line numbers in traces, and the ability to use a debugger. |
| `-o program` | Names the output. Without it you get `a.out`. |

`clang++` accepts all of these identically. On Windows, MSVC uses `/std:c++20
/W4` and has `/fsanitize=address`; the concepts transfer, the spellings do not.

## Warnings are the cheapest tool you have

`-Wall -Wextra` costs nothing at run time and catches a class of bug before the
program exists.

```cpp run title="Four warnings worth reading" std=c++20
#include <iostream>

int main() {
    int uninitialised;
    std::cout << "reading an uninitialised value: " << uninitialised << '\n';

    int signed_value = -1;
    unsigned int unsigned_value = 1;
    if (signed_value < unsigned_value) {
        std::cout << "-1 < 1 as expected\n";
    } else {
        std::cout << "-1 is NOT less than 1 — the comparison converted it\n";
    }
}
```

Read the warnings on that one. `-Wmaybe-uninitialized` catches the first;
`-Wsign-compare` catches the second, which is the unsigned-conversion trap from
Chapter 1.2 appearing as a comparison that reports the opposite of the truth.

Three more worth adding once you are comfortable:

```bash title="A stricter set"
g++ -std=c++20 -Wall -Wextra -Wpedantic -Wshadow -Wconversion ...
```

- `-Wpedantic` rejects compiler extensions, so your code stays portable.
- `-Wshadow` catches an inner variable hiding an outer one with the same name.
- `-Wconversion` warns on narrowing — `double` to `int`, `long` to `int`. It is
  noisy on existing code and excellent on new code.

:::tip
`-Werror` turns warnings into errors. Use it in CI, not while you are writing —
a warning you have not dealt with yet should not stop you compiling and testing
a change. Turning it on in CI means the warnings never accumulate.
:::

## Sanitizers

A sanitizer instruments your program so that undefined behaviour announces
itself. The two you want by default are AddressSanitizer and
UndefinedBehaviorSanitizer, and they compose: `-fsanitize=address,undefined`.

```cpp run expect-ub title="AddressSanitizer, on a buffer overflow" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v(4, 7);
    std::cout << "reading one past the end\n";
    std::cout << v[4] << '\n';
}
```

### Reading the report

The output is long, and three parts of it matter:

1. **The first line** names the error and the address:
   `ERROR: AddressSanitizer: heap-buffer-overflow on address 0x...`
2. **The first stack frame** is where the bad access happened — your code, with
   a file and line if you compiled with `-g`.
3. **The allocation section** at the bottom says where the memory came from and
   how large it was: `allocated by thread T0 here`, followed by the size and how
   far past it you went.

If the trace shows addresses instead of function names, you compiled without
`-g`. Add it — the report's whole value is in the names.

```cpp run expect-ub title="UndefinedBehaviorSanitizer, on signed overflow" std=c++20
#include <climits>
#include <iostream>

int main() {
    int big = INT_MAX;
    std::cout << "adding one to INT_MAX\n";
    std::cout << big + 1 << '\n';
}
```

UBSan's reports are shorter: a file, a line, and a sentence saying what the
program did that the standard does not define.

:::note
ASan roughly doubles run time and increases memory use substantially. That is a
fine price for development and testing, and not one you ship. Build your release
binaries without sanitizers, and run your test suite with them.

They also do not compose with everything: ASan and ThreadSanitizer cannot be
enabled together, and `-fsanitize=address` conflicts with `ulimit -v`, because
ASan reserves a very large shadow mapping at startup.
:::

### What they do not catch

Chapter 6.3 has the full table. The one to remember now: **ASan does not catch
uninitialised reads.** That is MemorySanitizer's job, and MSan is Clang-only and
requires every library it touches to be rebuilt with it. Your defence against
uninitialised reads is `-Wall` and initialising at the point of declaration.

## The debugger

A debugger lets you stop a program and look at it. The two are `gdb` (GNU) and
`lldb` (LLVM); the commands below are `gdb`, and `lldb`'s are similar.

```bash title="A first session"
g++ -std=c++20 -g -O0 -o program main.cpp
gdb ./program
```

Inside, the commands that cover most of what you need:

| Command | Short | Does |
|---|---|---|
| `break main.cpp:12` | `b` | Stop at line 12 |
| `run` | `r` | Start the program |
| `next` | `n` | Run the next line, stepping over calls |
| `step` | `s` | Run the next line, stepping into calls |
| `continue` | `c` | Run until the next breakpoint |
| `print total` | `p` | Show a variable's value |
| `backtrace` | `bt` | Show the call stack |
| `finish` | | Run until the current function returns |
| `quit` | `q` | Leave |

Compile with `-O0` for debugging. At `-O2` the compiler reorders and merges
code, so stepping jumps around and variables report `<optimized out>` — the
program is correct, but it no longer corresponds line-by-line to your source.

:::tip
When a program crashes, `gdb` gives you the answer in two commands:

```
gdb ./program
run
bt
```

`bt` prints the call stack at the moment of the crash. That is usually enough to
find the fault without a single breakpoint.
:::

Your editor almost certainly wraps this in a UI — VS Code, CLion, and Visual
Studio all drive `gdb` or `lldb` underneath. Learning the commands is still
worth an hour, because they are what you have on a remote machine or in CI.

## Which compiler

Both major open-source compilers are excellent and you should have both if you
can:

- **GCC** (`g++`) is the default on most Linux distributions.
- **Clang** (`clang++`) generally produces clearer error messages, and its
  sanitizer support arrived first.

Compiling with both is a genuinely useful habit: they warn about different
things, and code that satisfies both is more portable than code that satisfies
one. This book's verification scripts accept `CPPTB_COMPILER=clang++` for
exactly that reason.

```bash title="Checking a chapter against both"
npm run verify:snippets
CPPTB_COMPILER=clang++ npm run verify:snippets
```

## Getting a compiler

- **Debian or Ubuntu:** `sudo apt install g++ gdb`
- **Fedora:** `sudo dnf install gcc-c++ gdb`
- **macOS:** `xcode-select --install` gives you `clang++` and `lldb`
- **Windows:** install "Desktop development with C++" from the Visual Studio
  Installer, or use WSL and follow the Ubuntu instructions

Check it worked:

```bash
g++ --version
echo 'int main(){}' > t.cpp && g++ -std=c++20 t.cpp -o t && ./t && echo ok
```

:::pitfall
An old compiler is a common source of confusing errors. C++20 support landed
progressively: GCC 10 and Clang 10 have most of it, GCC 13 and Clang 17 have
essentially all. If a feature from this book does not compile, check your
version before assuming you mistyped it — `g++ --version` first, error message
second.
:::

## Check yourself

:::quiz
{
  "question": "Your sanitizer report shows addresses like `#0 0x55d4a2 in main+0x1a2` instead of file names and line numbers. What is missing?",
  "options": [
    { "text": "`-fsanitize=address` was not passed", "why": "It clearly was — without it there would be no report at all, just a crash or silent corruption." },
    { "text": "`-g`, which emits the debug information the symboliser needs", "correct": true, "why": "Right. The sanitizer detects the error either way, but without debug info it can only report addresses. Adding -g is what turns a report into something actionable." },
    { "text": "`-O0`; sanitizers require unoptimised builds", "why": "Sanitizers work at any optimisation level. -O0 helps a debugger step sensibly, but it is not what supplies symbol names." },
    { "text": "The program needs to be run under gdb", "why": "Sanitizer reports are produced by the instrumented program itself; no debugger is involved." }
  ]
}
:::

:::quiz
{
  "question": "Why is `-Wall -Wextra` worth turning on even though it catches nothing at run time?",
  "options": [
    { "text": "It makes the program faster", "why": "Warnings have no effect on generated code. They are purely a compile-time diagnostic." },
    { "text": "It catches real bugs — uninitialised reads, sign-comparison errors — before the program is ever run, at zero cost", "correct": true, "why": "Exactly, and some of them are bugs no run-time tool will find. ASan does not catch uninitialised reads at all, so -Wmaybe-uninitialized may be your only warning." },
    { "text": "It is required for C++20", "why": "The standard version is selected by -std=c++20 and is independent of warnings." },
    { "text": "It enables the sanitizers", "why": "Sanitizers are enabled separately with -fsanitize=... and do a different job — run-time detection rather than compile-time analysis." }
  ]
}
:::

## Practice

:::exercise read-the-warning

:::recap
- The working command line is
  `-std=c++20 -Wall -Wextra -fsanitize=address,undefined -fno-omit-frame-pointer -g`.
- Warnings are free and catch bugs no run-time tool can. Add `-Wshadow` and
  `-Wconversion` on new code, and `-Werror` in CI rather than while writing.
- Sanitizers make undefined behaviour announce itself. Read the first line, the
  first frame, and the allocation section; without `-g` you get addresses
  instead of names.
- ASan roughly doubles run time — use it for development and testing, not for
  release builds. It does not catch uninitialised reads.
- Debug at `-O0`, and remember that `run` then `bt` in `gdb` usually locates a
  crash without any breakpoints.
- Compile with both GCC and Clang when you can; they warn about different
  things.
:::
