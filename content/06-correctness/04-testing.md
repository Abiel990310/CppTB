---
title: "Testing"
navTitle: "Testing"
summary: >-
  Writing tests that catch regressions rather than restating the code.
objectives:
  - Write a unit test that fails for the right reason
  - Explain what property-based testing adds
  - Structure a project so tests run on every build
status: complete
standard: c++20
requires: [error-handling-without-exceptions]
---

Every problem in this book is graded by a test. This chapter is about writing
your own — and, more importantly, about which tests are worth writing.

## A test is an executable claim

At its simplest a test needs no library at all:

```cpp run title="Testing with nothing but assert" std=c++20
#include <cassert>
#include <iostream>
#include <string>

std::string reverse(std::string text) {
    for (std::size_t i = 0, j = text.size(); i + 1 < j; ++i, --j) {
        std::swap(text[i], text[j - 1]);
    }
    return text;
}

int main() {
    assert(reverse("abc") == "cba");
    assert(reverse("ab") == "ba");
    assert(reverse("a") == "a");
    assert(reverse("") == "");
    assert(reverse("aba") == "aba");

    std::cout << "all assertions passed\n";
}
```

That is a real test suite. It has two weaknesses that a framework fixes: it
stops at the first failure, and `assert` is **compiled out** when `NDEBUG` is
defined — which release builds usually define. Never rely on `assert` for a
check you need in production; Chapter 6.6 draws that line.

A slightly better harness reports every failure and returns a useful exit code:

```cpp run title="A harness in fifteen lines" std=c++20
#include <iostream>
#include <string>

int failures = 0;

void check(bool condition, const std::string& what) {
    if (condition) return;
    std::cout << "FAIL: " << what << '\n';
    ++failures;
}

int add(int a, int b) { return a + b; }

int main() {
    check(add(2, 2) == 4, "add(2, 2) == 4");
    check(add(-1, 1) == 0, "add(-1, 1) == 0");
    check(add(0, 0) == 1, "add(0, 0) == 1  (deliberately wrong)");

    std::cout << failures << " failure(s)\n";
    return failures == 0 ? 0 : 1;
}
```

The exit code is what makes it usable from a build system: a non-zero exit means
the build fails. That is the whole contract a test runner needs.

For real projects use a framework — **Catch2**, **doctest**, or **GoogleTest**
are the common choices. They give you test discovery, better failure messages,
fixtures, and parameterised tests. The concepts below apply to all of them.

## Tests that fail for the right reason

The most common bad test is one that restates the implementation:

```cpp run title="A test that cannot catch a bug" std=c++20
#include <iostream>
#include <vector>

double average(const std::vector<int>& values) {
    if (values.empty()) return 0.0;
    int total = 0;
    for (int v : values) total += v;
    return static_cast<double>(total) / static_cast<double>(values.size());
}

int main() {
    const std::vector<int> data{1, 2, 3, 4};

    // Restates the implementation. If the formula is wrong, so is the test.
    int total = 0;
    for (int v : data) total += v;
    const double expected = static_cast<double>(total) / data.size();
    std::cout << "tautological test passes: " << (average(data) == expected) << '\n';

    // Independent: the answer was worked out by hand.
    std::cout << "real test passes: " << (average(data) == 2.5) << '\n';
}
```

A test should assert **what the answer is**, not **how it is computed**. If you
find yourself reimplementing the function to check it, you have written a
tautology that will agree with any bug you introduce.

The corollary: a test you have never seen fail has not been tested. When you
write one, break the implementation deliberately and confirm the test notices.

## Which cases to write

Bugs cluster at boundaries. For most functions, four kinds of case find nearly
everything:

```cpp run title="Boundaries, not the middle" std=c++20
#include <iostream>
#include <string>
#include <vector>

std::string join(const std::vector<std::string>& parts, const std::string& sep) {
    std::string result;
    for (std::size_t i = 0; i < parts.size(); ++i) {
        if (i > 0) result += sep;
        result += parts[i];
    }
    return result;
}

int failures = 0;
void check(bool ok, const std::string& what) {
    if (!ok) { std::cout << "FAIL: " << what << '\n'; ++failures; }
}

int main() {
    check(join({"a", "b", "c"}, "-") == "a-b-c", "typical case");

    check(join({}, "-") == "", "empty input");                 // the empty case
    check(join({"solo"}, "-") == "solo", "single element");    // no separator used
    check(join({"a", "b"}, "") == "ab", "empty separator");    // empty parameter
    check(join({"", ""}, "-") == "-", "empty elements");       // empty contents

    std::cout << failures << " failure(s)\n";
}
```

- **The empty case.** Zero elements, empty string, null option. It has its own
  code path more often than you expect.
- **One.** The case where a loop runs once and a separator is never used.
- **The boundary.** Exactly at the limit, and one either side.
- **The degenerate input.** Empty separator, equal values, an already-sorted
  list.

The typical case in the middle is the one least likely to find anything, and the
one people write first.

## Property-based testing

Instead of stating what a specific input produces, state something that must be
true for *all* inputs, then check it against many:

```cpp run title="Properties, checked over generated input" std=c++20
#include <algorithm>
#include <iostream>
#include <random>
#include <string>
#include <vector>

std::string reverse(std::string text) {
    std::ranges::reverse(text);
    return text;
}

int main() {
    std::mt19937 rng{12345};                 // fixed seed: reproducible
    std::uniform_int_distribution<int> length{0, 20};
    std::uniform_int_distribution<int> letter{'a', 'z'};

    int failures = 0;
    for (int trial = 0; trial < 2000; ++trial) {
        std::string input;
        const int n = length(rng);
        for (int i = 0; i < n; ++i) input += static_cast<char>(letter(rng));

        // Property 1: reversing twice gives the original.
        if (reverse(reverse(input)) != input) { ++failures; std::cout << "round-trip failed\n"; }

        // Property 2: length is preserved.
        if (reverse(input).size() != input.size()) { ++failures; std::cout << "length changed\n"; }
    }

    std::cout << "2000 random inputs, " << failures << " failure(s)\n";
}
```

Properties worth looking for: **round trips** (encode then decode, reverse
twice), **invariants** (sorting preserves length and multiset of elements),
**relations to a simpler implementation** (an optimised version agrees with an
obvious one), and **idempotence** (normalising twice is the same as once).

The **fixed seed** matters. A test that generates different inputs each run is a
test that fails on someone else's machine and not yours. Seed it deterministically
and print the seed if you ever randomise it.

Libraries — **RapidCheck** for C++, or Catch2's generators — add automatic
*shrinking*: when a property fails they search for the smallest input that still
fails, which turns "it broke on a 400-character string" into "it broke on `ab`".

## Testing that something fails

Error paths need tests as much as success paths, and they are the ones people
skip:

```cpp run title="Asserting that it throws" std=c++20
#include <iostream>
#include <stdexcept>
#include <string>

int parse_port(const std::string& text) {
    const int value = std::stoi(text);
    if (value < 1 || value > 65535) throw std::out_of_range("bad port");
    return value;
}

template <class Fn>
bool throws_out_of_range(Fn fn) {
    try {
        fn();
        return false;
    } catch (const std::out_of_range&) {
        return true;
    } catch (...) {
        return false;                 // the wrong exception type is a failure
    }
}

int main() {
    std::cout << std::boolalpha;
    std::cout << "8080 accepted:        " << (parse_port("8080") == 8080) << '\n';
    std::cout << "70000 throws:         " << throws_out_of_range([] { parse_port("70000"); }) << '\n';
    std::cout << "0 throws:             " << throws_out_of_range([] { parse_port("0"); }) << '\n';
    std::cout << "1 accepted (boundary):" << (parse_port("1") == 1) << '\n';
}
```

Note that the helper distinguishes the *right* exception from any exception. A
test asserting only "something was thrown" passes when the function throws
`std::bad_alloc` for entirely unrelated reasons.

## Running them on every build

A test that is not run is a comment. With CMake, three lines wire tests into the
build:

```cmake title="CMakeLists.txt"
enable_testing()
add_executable(tests tests.cpp)
add_test(NAME unit_tests COMMAND tests)
```

Then `ctest` runs them, and CI runs `ctest`. Chapter 9.3 covers CMake properly.

:::tip
Run your test suite with sanitizers on — `-fsanitize=address,undefined`. Tests
exercise many code paths quickly, which is exactly the workload sanitizers are
best at. A test suite that passes under ASan is worth far more than one that
merely passes.

That is what this book does: `npm run verify` compiles every sample and every
problem's solution with sanitizers enabled, which is how nine wrong claims in
these chapters were caught before publication.
:::

## What not to test

- **Not the standard library.** `std::vector` works. Testing that `push_back`
  increases `size()` tests nothing of yours.
- **Not private implementation details.** Test the public interface; a test
  bound to internals breaks on every refactor and stops you improving the code.
- **Not everything.** Coverage is a diagnostic, not a target. A hundred percent
  coverage with tautological assertions is worse than sixty percent with
  independent ones, because it looks safe.

## Check yourself

:::quiz
{
  "question": "Why is `assert` unsuitable as the only check in shipped code?",
  "options": [
    { "text": "It is too slow", "why": "It compiles to a comparison and a branch — negligible. Cost is not the objection." },
    { "text": "It is compiled out when NDEBUG is defined, which release builds usually define", "correct": true, "why": "Your check silently disappears in exactly the build that runs in production. assert is for programming mistakes you catch during development; a condition that must hold in a release build needs a real check." },
    { "text": "It cannot report a message", "why": "It prints the failing expression, file, and line — enough for a developer. The problem is that it may not be there at all." },
    { "text": "It throws an exception that is hard to catch", "why": "It does not throw; it calls abort. That is a deliberate design choice for a violated invariant." }
  ]
}
:::

:::quiz
{
  "question": "What makes a test tautological?",
  "options": [
    { "text": "It tests only one input", "why": "A single well-chosen case is a perfectly good test. Being narrow is not the same as being circular." },
    { "text": "It computes the expected value using the same logic as the implementation, so it agrees with any bug", "correct": true, "why": "If the formula is wrong, the test's copy of it is wrong in the same way and the test still passes. Expected values should be worked out independently — by hand, or from a specification." },
    { "text": "It uses assert instead of a framework", "why": "The mechanism is irrelevant. A tautology is a tautology whichever macro reports it." },
    { "text": "It does not check error paths", "why": "A real gap, but a different one. An incomplete test suite is not the same as a circular assertion." }
  ]
}
:::

## Practice

:::exercise write-the-tests

:::exercise property-round-trip

:::recap
- A test is an executable claim. The minimum viable harness is a `check`
  function and a non-zero exit code; use Catch2, doctest, or GoogleTest for real
  projects.
- `assert` vanishes under `NDEBUG`. Never use it for a check that must hold in a
  release build.
- Assert what the answer *is*, not how it is computed. A test that reimplements
  the function agrees with every bug.
- A test you have never seen fail has not been tested — break the code
  deliberately and check that it notices.
- Write the empty case, the single case, the boundary, and the degenerate input
  before the typical one.
- Property-based tests state something true of all inputs — round trips,
  invariants, agreement with a simpler version — and need a fixed seed.
- Test that the *right* exception is thrown, not just that something was.
- Run the suite with sanitizers. Do not test the standard library, private
  details, or chase coverage for its own sake.
:::
