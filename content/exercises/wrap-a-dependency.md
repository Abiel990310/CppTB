---
id: wrap-a-dependency
title: "One file that knows about the library"
difficulty: core
chapter: dependencies
topics: [dependencies, interfaces, templates, design]
check: unit
standard: c++20
---

`fastlog` is a third-party logging library. Its API is awkward: severities are
`int`s, it wants a `const char*`, and it reports failure by returning a status
code nobody checks. Right now every part of the application calls it directly,
so swapping it out means touching every one of those call sites — and testing
anything that logs means having the real library.

Put a boundary in front of it.

- Write a `Logger` **concept** describing what your application needs:
  `info(std::string_view)`, `error(std::string_view)`, and `count()`.
- Write `FastLogAdapter`, which satisfies it by calling `fastlog` underneath.
- Write `TestLogger`, which satisfies it by recording messages in memory.
- Make `run_import` a template over any `Logger`, so it works with either.

`fastlog` itself must not be modified, and nothing outside `FastLogAdapter` may
mention it.

## Starter
```cpp
#include <concepts>
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

// --- the third-party library, do not change ---------------------------
namespace fastlog {

inline std::vector<std::string> sink;      // stands in for a file
inline int emitted = 0;

constexpr int SEVERITY_INFO = 2;
constexpr int SEVERITY_ERROR = 5;

// Returns 0 on success, non-zero on failure. Ignores messages with an
// unknown severity.
inline int fl_write(int severity, const char* message) {
    if (severity != SEVERITY_INFO && severity != SEVERITY_ERROR) return 1;
    if (message == nullptr) return 2;
    sink.push_back(std::string(severity == SEVERITY_ERROR ? "E " : "I ") + message);
    ++emitted;
    return 0;
}

inline int fl_count() { return emitted; }
inline void fl_reset() { sink.clear(); emitted = 0; }

}  // namespace fastlog
// ----------------------------------------------------------------------

// TODO: a Logger concept.

// TODO: FastLogAdapter, satisfying it by calling fastlog.

// TODO: TestLogger, satisfying it by recording in memory.

// Reads `rows`, logging one info line per row and one error per empty row.
// Returns how many non-empty rows it handled.
int run_import(const std::vector<std::string>& rows) {
    return 0;
}
```

## Tests
```cpp
// Both implementations satisfy the concept.
static_assert(Logger<FastLogAdapter>);
static_assert(Logger<TestLogger>);

// And something missing a member does not.
struct Incomplete { void info(std::string_view) {} };
static_assert(!Logger<Incomplete>);

// The adapter really writes through to the library.
fastlog::fl_reset();
{
    FastLogAdapter adapter;
    adapter.info("starting");
    adapter.error("something broke");
    CHECK_EQ(adapter.count(), std::size_t{2});
}
CHECK_EQ(fastlog::sink.size(), std::size_t{2});
CHECK_EQ(fastlog::sink[0], std::string("I starting"));
CHECK_EQ(fastlog::sink[1], std::string("E something broke"));
CHECK_EQ(fastlog::fl_count(), 2);

// The test logger records without touching the library at all.
fastlog::fl_reset();
{
    TestLogger test;
    test.info("one");
    test.error("two");
    test.info("three");
    CHECK_EQ(test.count(), std::size_t{3});
    CHECK_EQ(test.messages.size(), std::size_t{3});
    CHECK_EQ(test.messages[0], std::string("I one"));
    CHECK_EQ(test.messages[1], std::string("E two"));
    CHECK_EQ(test.messages[2], std::string("I three"));
}
CHECK_EQ(fastlog::fl_count(), 0);          // the library was never called

// run_import works with either, and is checked with the in-memory one.
{
    TestLogger test;
    int handled = run_import(test, {"alpha", "", "beta", "", ""});
    CHECK_EQ(handled, 2);
    CHECK_EQ(test.count(), std::size_t{5});
    CHECK_EQ(test.messages[0], std::string("I alpha"));
    CHECK_EQ(test.messages[1], std::string("E empty row"));
    CHECK_EQ(test.messages[2], std::string("I beta"));
    CHECK_EQ(test.messages[4], std::string("E empty row"));
}

// And with the real one.
fastlog::fl_reset();
{
    FastLogAdapter adapter;
    int handled = run_import(adapter, {"only"});
    CHECK_EQ(handled, 1);
    CHECK_EQ(fastlog::sink.size(), std::size_t{1});
    CHECK_EQ(fastlog::sink[0], std::string("I only"));
}

// Empty input logs nothing.
{
    TestLogger test;
    CHECK_EQ(run_import(test, {}), 0);
    CHECK_EQ(test.count(), std::size_t{0});
}
```

## Hints
- The concept states what the application needs, not what the library offers: `template <class T> concept Logger = requires(T& log) { log.info(std::string_view{}); log.error(std::string_view{}); { log.count() } -> std::convertible_to<std::size_t>; };`
- `run_import` becomes `template <Logger L> int run_import(L& log, const std::vector<std::string>& rows)`. Note the checks call it with the logger first.
- `fl_write` takes a `const char*` and `std::string_view` is not null-terminated, so the adapter has to make a `std::string` first and pass `.c_str()`. That conversion is exactly the kind of thing an adapter exists to contain.
- The adapter's `count()` can return `fastlog::fl_count()`, cast to `std::size_t`.
- `TestLogger` prefixes messages the same way the library does — `"I "` and `"E "` — so the checks can compare them directly.
- `run_import` logs `info(row)` for a non-empty row and `error("empty row")` for an empty one, and returns the count of non-empty rows.
- `Incomplete` has `info` but not `error` or `count`, so the concept must require all three for `!Logger<Incomplete>` to hold.

## Solution
```cpp
#include <concepts>
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

namespace fastlog {

inline std::vector<std::string> sink;
inline int emitted = 0;

constexpr int SEVERITY_INFO = 2;
constexpr int SEVERITY_ERROR = 5;

inline int fl_write(int severity, const char* message) {
    if (severity != SEVERITY_INFO && severity != SEVERITY_ERROR) return 1;
    if (message == nullptr) return 2;
    sink.push_back(std::string(severity == SEVERITY_ERROR ? "E " : "I ") + message);
    ++emitted;
    return 0;
}

inline int fl_count() { return emitted; }
inline void fl_reset() { sink.clear(); emitted = 0; }

}  // namespace fastlog

// What the application needs — written without reference to any library.
template <class T>
concept Logger = requires(T& log) {
    log.info(std::string_view{});
    log.error(std::string_view{});
    { log.count() } -> std::convertible_to<std::size_t>;
};

// The only place in the program that knows fastlog exists.
class FastLogAdapter {
public:
    void info(std::string_view message) {
        std::string owned(message);
        fastlog::fl_write(fastlog::SEVERITY_INFO, owned.c_str());
    }
    void error(std::string_view message) {
        std::string owned(message);
        fastlog::fl_write(fastlog::SEVERITY_ERROR, owned.c_str());
    }
    std::size_t count() const { return static_cast<std::size_t>(fastlog::fl_count()); }
};

// The same interface, with no dependency at all.
class TestLogger {
public:
    std::vector<std::string> messages;

    void info(std::string_view message) { messages.push_back("I " + std::string(message)); }
    void error(std::string_view message) { messages.push_back("E " + std::string(message)); }
    std::size_t count() const { return messages.size(); }
};

template <Logger L>
int run_import(L& log, const std::vector<std::string>& rows) {
    int handled = 0;
    for (const std::string& row : rows) {
        if (row.empty()) {
            log.error("empty row");
        } else {
            log.info(row);
            ++handled;
        }
    }
    return handled;
}
```

## Notes
The word `fastlog` appears in exactly one class. That is the whole deliverable,
and everything else follows from it.

**Swapping the library becomes one file.** Write `SlowLogAdapter`, change which
one `main` constructs, and nothing else in the program has an opinion. Without
the boundary, the same change is a search-and-replace across every file that
logs, and every one of those is a chance to get the severity constant wrong.

**Testing stops needing the dependency.** `TestLogger` records into a vector, so
a test of `run_import` asserts on exactly what was logged with no file, no
global state, and no library. Notice the check that `fl_count()` is still 0
after using `TestLogger` — the real library was never involved. That is the
difference between a test you can run in a loop and one that needs a fixture.

**The awkwardness is contained.** `fl_write` wants a null-terminated `const
char*`, so the adapter constructs a `std::string` and calls `.c_str()`; a
`std::string_view` is not null-terminated and passing `.data()` would be a bug
waiting for a non-terminated view. That conversion has to happen *somewhere*, and
having it happen in one place rather than at every call site is most of the
value. The ignored status code is the same: if you decide to start checking it,
there is one function to change.

The concept is doing real work rather than documenting. `static_assert(!Logger<Incomplete>)`
is a compile-time test that the interface is what you said it was, and a
mistyped member in a new adapter fails at the `static_assert` with a readable
message rather than deep inside `run_import`. That is the Chapter 5.4 argument
for concepts, applied to an architectural boundary rather than to an algorithm.

The cost is that `run_import` is now a template, so it has to live in a header
and is instantiated per logger type. If that matters — a large function, many
implementations, or a compile-time budget — the alternative is an abstract base
class with a virtual `info` and `error`, paying one indirect call per log line
to get one compiled copy. Chapter 5.8 is the comparison; for a logger, either is
defensible, and the boundary is the part that matters.
