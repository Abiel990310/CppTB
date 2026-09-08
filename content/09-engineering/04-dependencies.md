---
title: "Dependencies and packaging"
navTitle: "Dependencies"
summary: >-
  Using other people's code without making your build unreproducible.
objectives:
  - Add a dependency with FetchContent or a package manager
  - Explain the trade-offs of vendoring
  - Pin versions so a build is reproducible
status: complete
standard: c++20
requires: [build-systems]
---

C++ has no `cargo`, no `npm`, no `pip`. It has four incompatible answers to
"how do I use somebody else's library", and which one is right depends on who
has to build your project and where.

This chapter is about picking one deliberately, and about the property that
matters more than convenience: that a build done today and a build done in two
years produce the same program.

:::note
As with the previous two chapters, none of this runs in the browser. The
FetchContent build below was configured, built and run for real — the version
numbers, timings and error messages quoted are what it produced.
:::

## The four options

| Approach | You get | You pay |
|---|---|---|
| **System package** (`apt install libfmt-dev`) | nothing to build | whatever version the distribution has; different on every machine |
| **Vendoring** (the source, checked into your repo) | total control, offline builds | updating is manual; your diffs contain other people's code |
| **FetchContent** (CMake downloads and builds it) | one build system, versions pinned in your `CMakeLists.txt` | rebuilds the dependency yourself; needs network on first configure |
| **Package manager** (vcpkg, Conan) | binary caching, transitive dependencies, a lockfile | another tool everyone must install and learn |

There is no default answer. A library, whose users have their own opinions,
should `find_package` and let them decide. An application, which controls its
own build, is usually happiest with FetchContent or a package manager.

## `find_package`: use it if it is there

```cmake
find_package(fmt 10 REQUIRED)
target_link_libraries(myapp PRIVATE fmt::fmt)
```

This asks the machine whether the library is installed. When it is, you get an
imported target carrying its include paths and its own dependencies — the usage
requirements from Chapter 9.3, published by whoever installed it.

When it is not, you get this:

```
Could not find a package configuration file provided by "fmt" (requested
version 10) with any of the following names:

    fmtConfig.cmake
    fmt-config.cmake

Add the installation prefix of "fmt" to CMAKE_PREFIX_PATH or set "fmt_DIR"
to a directory containing one of the above files.
```

That message is the whole problem with system packages in one paragraph: the
build works on the machine where someone installed the right version, and fails
everywhere else with instructions the reader has to act on manually.

## FetchContent: bring it with you

CMake can fetch and build a dependency as part of your own configure step.

```cmake
cmake_minimum_required(VERSION 3.24)
project(depdemo CXX)
set(CMAKE_CXX_STANDARD 20)

include(FetchContent)
FetchContent_Declare(
  doctest
  GIT_REPOSITORY https://github.com/doctest/doctest.git
  GIT_TAG        v2.4.11        # a tag, not a branch
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(doctest)

add_executable(tests tests.cpp)
target_link_libraries(tests PRIVATE doctest::doctest)
```

```
$ cmake -S . -B build -G Ninja
-- Configuring done (2.9s)

$ cmake --build build
[1/2] Building CXX object CMakeFiles/tests.dir/tests.cpp.o
[2/2] Linking CXX executable tests

$ ./build/tests
[doctest] test cases: 1 | 1 passed | 0 failed | 0 skipped
[doctest] assertions: 2 | 2 passed | 0 failed |
[doctest] Status: SUCCESS!
```

Three seconds to configure, and the dependency's source lands in
`build/_deps/doctest-src` — 9 MB of it here, checked out at exactly the commit
the tag names:

```
$ git -C build/_deps/doctest-src rev-parse HEAD
ae7a13539fb71f270b87eb2e874fbac80bc8dda2
$ git -C build/_deps/doctest-src describe --tags
v2.4.11
```

Because it lives under `build/`, `rm -rf build` removes it, and nothing about
the dependency is in version control except the four lines that name it. That is
the appeal: the `CMakeLists.txt` *is* the manifest.

What it costs: your build now compiles the dependency's sources, every clean
build re-fetches, and the first configure needs the network. For a header-only
test framework that is nothing. For Boost it is an afternoon.

:::pitfall
`FetchContent_MakeAvailable` runs the dependency's `CMakeLists.txt` inside your
build. Its targets, its options, and any global settings it makes are now yours
— which is the concrete reason Chapter 9.3 said never to set anything globally:
a dependency that does `set(CMAKE_CXX_FLAGS "-Werror")` has just done it to you.
`FetchContent_Declare(... EXCLUDE_FROM_ALL)` keeps its targets out of your
default build, and setting the dependency's own options before
`MakeAvailable` — `set(DOCTEST_WITH_TESTS OFF)` — stops it building its own test
suite as part of yours.
:::

## Pinning, and what "reproducible" means

Every one of the four approaches can be made reproducible, and every one of them
defaults to not being.

**Pin to an immutable revision.** `GIT_TAG main` is not a version; it is
"whatever that branch says today", so two people configuring on different days
get different code and one of them has a bug the other cannot reproduce. A tag
is better, and a **commit hash** is the only thing that is actually immutable —
tags can be moved, and occasionally are.

```cmake
GIT_TAG v2.4.11                                     # good
GIT_TAG ae7a13539fb71f270b87eb2e874fbac80bc8dda2    # unambiguous
GIT_TAG main                                        # not a version
```

**Pin the transitive graph too.** Your dependency's dependencies matter just as
much, and `FetchContent` gives you no lockfile — if the library you pinned
fetches something else by branch, you have pinned nothing. This is the concrete
argument for vcpkg or Conan on a project with more than a handful of
dependencies: both produce a lockfile covering the whole graph.

**Pin the toolchain, eventually.** Same source, different compiler, different
program — occasionally a differently-behaving one. Beyond a certain project
size the answer is a container image or a Nix expression, and the honest thing
to say is that "reproducible" is a spectrum and most projects sit further down
it than they think.

:::tip
Write down the version you tested against, in a place a human reads. A comment
next to the `GIT_TAG`, or a `dependencies.md`, is worth more than it looks in
two years, when someone needs to know whether the pin was a considered choice or
the version that happened to be current.
:::

## Vendoring

Copying the source into your repository — `third_party/`, `external/`, `vendor/`
— is the oldest answer and still sometimes the right one.

It is right when you need offline and hermetic builds, when the upstream is
unmaintained or you carry local patches, when the dependency is small enough
that reviewing it is realistic, or when the dependency is *load-bearing* and you
would rather own a fork than be surprised.

It is wrong as a default, and the reasons are practical rather than
philosophical:

- **Updating is a manual merge**, so it does not happen, so you sit on a
  three-year-old version with known CVEs.
- **Your history is full of other people's code**, and `git log` and code review
  both get worse.
- **Nobody can tell what version you have**, unless you write it down — and if
  you patched it, "what version" no longer has an answer.

If you vendor, vendor deliberately: record the upstream URL and the exact commit
in a file next to the code, keep local patches as separate commits or a patch
series rather than editing in place, and put a reminder somewhere to look at
upstream occasionally.

## Package managers

**vcpkg** and **Conan** are the two that matter. Both fetch, build and cache
binaries, resolve transitive dependencies, and produce a manifest and a lockfile.

vcpkg in manifest mode is a `vcpkg.json` next to your `CMakeLists.txt`:

```json
{
  "name": "myapp",
  "version": "0.1.0",
  "dependencies": [ "fmt", "catch2", "nlohmann-json" ]
}
```

with a toolchain file passed at configure time. Conan uses a `conanfile.txt` or
`conanfile.py` and generates CMake files you include. Both give you what
FetchContent does not: a binary cache, so the dependency is compiled once per
machine rather than once per clean build, and a lockfile pinning the full graph.

The cost is a tool that every contributor and every CI job must have, plus its
own concepts — triplets, profiles, host and target — and the day the package you
need is not in the registry at the version you want.

**A reasonable default policy**, and this is a judgement rather than a rule:
FetchContent while the dependency count is small and the dependencies are
source-friendly; a package manager once the count or the build time makes that
painful; `find_package` in anything you publish as a library, so your users
choose.

## Check yourself

:::quiz
{
  "question": "A `CMakeLists.txt` has `FetchContent_Declare(dep GIT_REPOSITORY … GIT_TAG main)`. Two colleagues configure it a week apart and get different behaviour. Why?",
  "options": [
    { "text": "`main` is a moving branch, not a version — each configure fetches whatever it points to that day", "correct": true, "why": "Pin a tag, or better a commit hash, which is the only genuinely immutable reference. A branch name is a subscription, not a dependency." },
    { "text": "FetchContent caches per user, so they got different cache entries", "why": "The cache is per build directory, and a fresh configure would fetch the same commit if the tag were fixed." },
    { "text": "CMake versions differ", "why": "Possible in general, but it would not change which source revision is fetched." },
    { "text": "One of them had the library installed system-wide", "why": "FetchContent does not consult the system unless you explicitly ask it to try `find_package` first." }
  ]
}
:::

:::quiz
{
  "question": "You are publishing a C++ library for other people to use. How should it obtain *its* dependencies?",
  "options": [
    { "text": "`find_package`, so consumers decide how those dependencies are supplied", "correct": true, "why": "A library that hard-codes FetchContent forces its choices and its versions onto every consumer, and two libraries doing that will eventually fetch the same dependency twice at different versions." },
    { "text": "FetchContent, so it always builds out of the box", "why": "Convenient to test, hostile to consume: your `MakeAvailable` runs inside their build and its targets and options become theirs." },
    { "text": "Vendored copies, so it has no external requirements", "why": "Then every consumer gets your copy, possibly alongside their own of the same library, with two versions of the same symbols at link time." },
    { "text": "A package manager manifest, so the versions are locked", "why": "Locking is right for an application, which owns its build. A library imposing a package manager rules out every consumer who uses a different one." }
  ]
}
:::

## Practice

:::exercise compare-versions

:::exercise wrap-a-dependency

:::recap
- Four approaches: system packages, vendoring, FetchContent, and a package
  manager. Applications usually want FetchContent or a package manager;
  published libraries should `find_package` and let consumers choose.
- `find_package` gives an imported target carrying its own usage requirements,
  and a long error message on any machine where it is not installed.
- FetchContent makes the `CMakeLists.txt` the manifest — four lines naming a
  repository and a revision, with the source landing under `build/` so a clean
  removes it.
- `FetchContent_MakeAvailable` runs the dependency's build inside yours, so its
  targets and global settings become yours. Set its options first, and
  `EXCLUDE_FROM_ALL` what you do not need.
- Pin to a tag, or better a commit hash. A branch name is not a version. Pin the
  transitive graph too, which is what a package manager's lockfile is for.
- Vendor deliberately — recording the upstream commit and keeping patches
  separate — and understand that the cost is that updating stops happening.
:::
