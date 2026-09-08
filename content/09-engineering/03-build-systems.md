---
title: "Build systems and CMake"
navTitle: "Build systems"
summary: >-
  Describing a build so that other people can reproduce it.
objectives:
  - Write a CMakeLists.txt for a small library and its tests
  - Explain target-based CMake and why globals are worse
  - Configure a debug and a release build
status: complete
standard: c++20
requires: [translation-units]
---

Chapter 9.1 showed that a C++ program is many translation units compiled
separately and linked together. Once there is more than a handful, someone has
to say which files, in what order, with which flags, against which libraries —
and say it in a way that works on a machine you have never seen.

That is a build system's job. This chapter is about CMake, because it is what
the ecosystem settled on: not because it is elegant, but because every library
you will want to use assumes it.

:::note
The samples in this chapter cannot run in the browser — this page's compiler
backend builds one file at a time and has no CMake. Everything below was built
and run with CMake 3.28 and Ninja before it was written, and the output quoted
is the output it produced.
:::

## The project

A small library with a header, an executable that uses it, and a test binary —
the smallest layout that has all the parts.

```
textstats/
├── CMakeLists.txt
├── include/textstats/stats.h
├── src/stats.cpp
├── app/main.cpp
└── tests/test_stats.cpp
```

Here is what is in it. This is the library and its tests as one file, so you can
run it — the rest of the chapter is about splitting it into the layout above and
describing that to a build system.

```cpp run expect-failure title="The library and its tests, before the build system"
#include <cstddef>
#include <cstdio>
#include <string_view>

namespace textstats {

std::size_t word_count(std::string_view text) {
    std::size_t words = 0;
    bool inside = false;
    for (char c : text) {
        if (c == ' ' || c == '\n' || c == '\t') inside = false;
        else if (!inside) { inside = true; ++words; }
    }
    return words;
}

std::size_t longest_word(std::string_view text) {
    std::size_t best = 0, current = 0;
    for (char c : text) {
        if (c == ' ' || c == '\n' || c == '\t') current = 0;
        else if (++current > best) best = current;
    }
    return best;
}

}  // namespace textstats

int failures = 0;

void check(bool condition, const char* what) {
    if (condition) return;
    std::printf("FAIL: %s\n", what);
    ++failures;
}

int main() {
    check(textstats::word_count("") == 0, "empty text has no words");
    check(textstats::word_count("one") == 1, "a single word");
    check(textstats::word_count("  a  bb  ") == 2, "padding and doubled spaces");
    check(textstats::longest_word("the quick brown fox") == 5, "longest is quick");
    check(textstats::longest_word("") == 0, "longest of nothing");
    check(textstats::longest_word("aaa") == 4, "deliberately wrong, to show a failure");

    std::printf("%d failure(s)\n", failures);
    return failures == 0 ? 0 : 1;      // this exit code is what CTest reads
}
```

One of those checks is wrong on purpose, so the program exits non-zero — which
is the entire contract between a test binary and CTest.

The build file that turns this into a library, an application and a registered
test:

```cmake
cmake_minimum_required(VERSION 3.20)
project(textstats VERSION 0.1.0 LANGUAGES CXX)

add_library(textstats src/stats.cpp)
target_include_directories(textstats PUBLIC include)
target_compile_features(textstats PUBLIC cxx_std_20)
target_compile_options(textstats PRIVATE -Wall -Wextra)

add_executable(wordcount app/main.cpp)
target_link_libraries(wordcount PRIVATE textstats)

include(CTest)
add_executable(test_stats tests/test_stats.cpp)
target_link_libraries(test_stats PRIVATE textstats)
add_test(NAME stats COMMAND test_stats)
```

Configure, build, test:

```
$ cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
-- Configuring done (0.3s)
-- Generating done (0.0s)

$ cmake --build build
[1/6] Building CXX object CMakeFiles/textstats.dir/src/stats.cpp.o
[2/6] Linking CXX static library libtextstats.a
[3/6] Building CXX object CMakeFiles/wordcount.dir/app/main.cpp.o
[4/6] Linking CXX executable wordcount
[5/6] Building CXX object CMakeFiles/test_stats.dir/tests/test_stats.cpp.o
[6/6] Linking CXX executable test_stats

$ cd build && ctest --output-on-failure
    Start 1: stats
1/1 Test #1: stats ............................   Passed    0.00 sec
100% tests passed, 0 tests failed out of 1
```

`-S` is the source directory, `-B` the build directory. Keeping them separate
means `rm -rf build` is a complete clean and nothing generated ever lands in
version control.

## Targets, and why the old way was worse

CMake has two eras, and reading old code without knowing which one you are
looking at is genuinely confusing.

**Directory-based** (pre-2014, still widely copy-pasted):

```cmake
include_directories(include)               # every target below, and every subdirectory
add_definitions(-DSOMETHING)               # everything
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall")   # everything, globally
link_libraries(foo)                        # everything
```

**Target-based** (what to write):

```cmake
target_include_directories(mylib PUBLIC include)
target_compile_definitions(mylib PRIVATE SOMETHING)
target_compile_options(mylib PRIVATE -Wall)
target_link_libraries(mylib PRIVATE foo)
```

The difference is not verbosity. A directory-scoped setting applies to
everything below it in the tree, including third-party code you pulled in and
never wanted to compile with your flags. A target-scoped setting attaches to one
target, travels with it when another target links to it, and stops where you say
it stops.

That last part is what `PUBLIC`, `PRIVATE` and `INTERFACE` control, and they are
the whole idea:

| Keyword | Applies to the target | Propagates to things that link it |
|---|---|---|
| `PRIVATE` | yes | no |
| `PUBLIC` | yes | yes |
| `INTERFACE` | no | yes |

Read them as a question about **who needs this**. The include directory is
`PUBLIC` because a header of `textstats` says `#include "textstats/stats.h"`, so
anyone who links it needs that path too. The warnings are `PRIVATE` because they
are how *this* library is checked, and imposing them on consumers is rude.

Both halves are observable. Change one word:

```cmake
target_include_directories(textstats PRIVATE include)
```

and the library still builds, while everything that links it does not:

```
app/main.cpp:3:10: fatal error: textstats/stats.h: No such file or directory
tests/test_stats.cpp:2:10: fatal error: textstats/stats.h: No such file or directory
```

And with the original `PRIVATE` warnings, the generated compile commands show
`-Wall -Wextra` on `stats.cpp` and on nothing else:

```
stats.cpp          ['-Wall', '-Wextra']
main.cpp           []
test_stats.cpp     []
```

This is what "modern CMake" means, and it is the one thing to take from this
chapter: **describe targets and their requirements; never set anything
globally.**

## Build types

`CMAKE_BUILD_TYPE` selects a set of flags. For single-configuration generators
(Ninja, Make) it is chosen at configure time, so a debug and a release build are
two different build directories:

```
cmake -S . -B build/debug   -DCMAKE_BUILD_TYPE=Debug
cmake -S . -B build/release -DCMAKE_BUILD_TYPE=Release
```

What each one actually passes, read out of `compile_commands.json`:

| Build type | Flags |
|---|---|
| `Debug` | `-g` |
| `Release` | `-O3 -DNDEBUG` |
| `RelWithDebInfo` | `-O2 -g -DNDEBUG` |
| `MinSizeRel` | `-Os -DNDEBUG` |

Two things worth noticing. `Debug` passes **no optimisation flag at all**, which
means `-O0` by default — everything Chapter 7.2 said about not measuring there
applies. And `NDEBUG` is what switches `assert` off, so a `Release` build has no
assertions; Chapter 6.6 argued for that being a decision rather than a default.

**`RelWithDebInfo` is the one to profile.** It optimises like `Release` and keeps
the symbols, so `perf` can tell you the name of the function that is slow.

:::pitfall
Forgetting `-DCMAKE_BUILD_TYPE` with Ninja or Make gives you an **empty** build
type: no optimisation, no `-g`, no `NDEBUG`. Not a debug build — a *nothing*
build, which is slow and hard to debug at the same time. Multi-configuration
generators (Visual Studio, Xcode, and Ninja Multi-Config) ignore the variable
and take `--config Release` at build time instead.
:::

## Tests

`include(CTest)` plus `add_test` is enough to get `ctest` running your test
binaries. CTest does not know or care what is inside them: a test passes if the
program exits 0 — which is exactly the convention Chapter 6.4's fifteen-line
harness follows, and why that harness returns the failure count.

```cmake
include(CTest)
add_executable(test_stats tests/test_stats.cpp)
target_link_libraries(test_stats PRIVATE textstats)
add_test(NAME stats COMMAND test_stats)
```

Useful invocations:

```
ctest                      # run everything
ctest --output-on-failure  # show what a failing test printed
ctest -R stats             # only tests matching a regex
ctest -j8                  # in parallel
ctest --rerun-failed       # just the ones that failed last time
```

With a framework — Catch2, GoogleTest, doctest — you would register each test
case individually rather than one per binary, and each of those frameworks ships
CMake helpers to do it. The 9.4 chapter covers getting them.

## The things you will want next

**`compile_commands.json`.** `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON` writes a file
listing the exact command for every source file. Every editor's C++ support,
`clang-tidy` and `clangd` all read it. Turn it on and symlink it to the project
root; it is the single highest-value line in this chapter.

**Presets.** A `CMakePresets.json` names configurations so nobody has to
remember the flags:

```json
{
  "version": 3,
  "configurePresets": [
    {
      "name": "dev",
      "generator": "Ninja",
      "binaryDir": "build/dev",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "RelWithDebInfo",
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
      }
    }
  ]
}
```

Then `cmake --preset dev`. It is checked in, so every developer and the CI run
the same build.

**Ninja.** `-G Ninja` is faster than Make at everything, especially
no-op rebuilds, and is what CI should use.

**An interface library for common flags.** Rather than repeating
`target_compile_options` on every target:

```cmake
add_library(project_warnings INTERFACE)
target_compile_options(project_warnings INTERFACE -Wall -Wextra -Wpedantic)

target_link_libraries(textstats PRIVATE project_warnings)
```

An `INTERFACE` library compiles nothing; it is a named bundle of usage
requirements. This is the idiomatic replacement for the global `CMAKE_CXX_FLAGS`
that older projects set.

:::tip
Two rules that prevent most CMake pain. **Never glob your sources**
(`file(GLOB ...)`) — CMake cannot tell when a new file appears, so builds go
stale in ways that waste an afternoon; list the files. And **never set
`CMAKE_CXX_FLAGS` yourself** — it is global, it fights with build types, and
everything you want from it is a `target_compile_options` away.
:::

## Check yourself

:::quiz
{
  "question": "A library's headers `#include` its own public header by path. Should `target_include_directories` use PUBLIC or PRIVATE?",
  "options": [
    { "text": "PUBLIC — anything that links the library also needs that path to compile its headers", "correct": true, "why": "PUBLIC means 'this target needs it, and so does anyone who links me'. With PRIVATE the library builds and every consumer fails with 'No such file or directory'." },
    { "text": "PRIVATE — the include path is an implementation detail", "why": "It would be, if consumers never included the headers. They do; that is what the library is for." },
    { "text": "INTERFACE — consumers need it and the library does not", "why": "That is right for a header-only library, which has no sources of its own. This one compiles `src/stats.cpp`, which needs the path too." },
    { "text": "It makes no difference; include paths are global", "why": "They were, in directory-based CMake, and that is precisely the problem target-based CMake fixed." }
  ]
}
:::

:::quiz
{
  "question": "You configure with Ninja and forget `-DCMAKE_BUILD_TYPE`. What do you get?",
  "options": [
    { "text": "An empty build type: no optimisation flag, no `-g`, and no `NDEBUG` — slow *and* hard to debug", "correct": true, "why": "It is not a debug build. Single-configuration generators need the variable set; multi-configuration ones ignore it and take `--config` at build time." },
    { "text": "A Debug build, since that is the default", "why": "There is no default. The variable is simply empty, and so is the flag list it would have contributed." },
    { "text": "A Release build", "why": "Nothing selects optimisation unless you ask for it." },
    { "text": "A configure error", "why": "CMake configures happily and says nothing, which is what makes this worth knowing." }
  ]
}
:::

## Practice

:::exercise stats-library

:::exercise exit-code-tests

:::recap
- Configure with `-S` source and `-B` build, keeping every generated file in one
  throwaway directory.
- Describe **targets** and their requirements. `target_*` commands attach to one
  target; the old `include_directories`/`add_definitions`/`CMAKE_CXX_FLAGS`
  family applies to everything below them in the tree, including code you did
  not write.
- `PRIVATE` is for this target, `INTERFACE` for consumers, `PUBLIC` for both.
  Getting it wrong is visible: a `PRIVATE` include directory makes every
  consumer fail to find the header.
- `Debug` is `-g` with no optimisation, `Release` is `-O3 -DNDEBUG`, and
  `RelWithDebInfo` — `-O2 -g -DNDEBUG` — is the one to profile.
- Omitting `CMAKE_BUILD_TYPE` with Ninja or Make gives no flags at all.
- CTest runs binaries and reads their exit status, which is why a test harness
  should return non-zero on failure.
- Turn on `CMAKE_EXPORT_COMPILE_COMMANDS`, use presets so the build is the same
  everywhere, and do not glob sources.
:::
