---
id: exit-code-tests
title: "What CTest actually reads"
difficulty: core
chapter: build-systems
topics: [testing, tooling, api-design]
check: unit
standard: c++20
---

CTest decides whether a test passed by looking at the process's **exit status**:
zero is a pass, anything else is a failure. It does not parse output, and it
does not know what framework you used.

`TestRunner` is a minimal harness built around that contract, and it gets the
contract wrong in three ways.

1. `exit_code()` always returns 0, so every run reports success.
2. `check` counts failures but does not record which, so `--output-on-failure`
   would show nothing useful.
3. `run` swallows exceptions thrown by a test body, turning a crash into a
   silent pass.

Fix all three. Keep the interface.

## Starter
```cpp
#include <cstddef>
#include <exception>
#include <functional>
#include <string>
#include <vector>

class TestRunner {
public:
    // Runs `body`, catching anything it throws and counting it as a failure.
    void run(const std::string& name, const std::function<void()>& body) {
        (void)name;
        body();
    }

    // Called from inside a test body.
    void check(bool condition, const std::string& what) {
        if (!condition) ++failures_;
        (void)what;
    }

    std::size_t passed() const { return passed_; }
    std::size_t failed() const { return failures_; }

    // The names of the tests that failed, in the order they ran.
    const std::vector<std::string>& failures() const { return failure_names_; }

    // 0 if everything passed, non-zero otherwise. This is what CTest reads.
    int exit_code() const { return 0; }

private:
    std::size_t passed_ = 0;
    std::size_t failures_ = 0;
    std::vector<std::string> failure_names_;
    bool current_failed_ = false;
};
```

## Tests
```cpp
// All passing: exit code 0, nothing recorded as failed.
{
    TestRunner runner;
    runner.run("adds", [&] { runner.check(2 + 2 == 4, "2+2"); });
    runner.run("subtracts", [&] { runner.check(5 - 3 == 2, "5-3"); });
    CHECK_EQ(runner.passed(), std::size_t{2});
    CHECK_EQ(runner.failed(), std::size_t{0});
    CHECK(runner.failures().empty());
    CHECK_EQ(runner.exit_code(), 0);
}

// One failing check: that test is recorded by name, and the exit code is not 0.
{
    TestRunner runner;
    runner.run("good", [&] { runner.check(true, "fine"); });
    runner.run("bad", [&] { runner.check(false, "deliberately false"); });
    CHECK_EQ(runner.passed(), std::size_t{1});
    CHECK_EQ(runner.failed(), std::size_t{1});
    CHECK_EQ(runner.failures().size(), std::size_t{1});
    CHECK_EQ(runner.failures()[0], std::string("bad"));
    CHECK(runner.exit_code() != 0);
}

// Several failed checks inside one test still count as one failed test.
{
    TestRunner runner;
    runner.run("many", [&] {
        runner.check(false, "one");
        runner.check(false, "two");
        runner.check(false, "three");
    });
    CHECK_EQ(runner.failed(), std::size_t{1});
    CHECK_EQ(runner.passed(), std::size_t{0});
    CHECK_EQ(runner.failures().size(), std::size_t{1});
}

// A test that throws is a failure, not a crash and not a pass.
{
    TestRunner runner;
    runner.run("throws", [] { throw std::runtime_error("boom"); });
    runner.run("after", [&] { runner.check(true, "still running"); });
    CHECK_EQ(runner.failed(), std::size_t{1});
    CHECK_EQ(runner.passed(), std::size_t{1});
    CHECK_EQ(runner.failures()[0], std::string("throws"));
    CHECK(runner.exit_code() != 0);
}

// A test with no checks at all passes, and does not appear in the failures.
{
    TestRunner runner;
    runner.run("empty", [] { });
    CHECK_EQ(runner.passed(), std::size_t{1});
    CHECK_EQ(runner.failed(), std::size_t{0});
    CHECK_EQ(runner.exit_code(), 0);
}

// The order of failures follows the order the tests ran in.
{
    TestRunner runner;
    runner.run("first", [&] { runner.check(false, "x"); });
    runner.run("second", [&] { runner.check(true, "y"); });
    runner.run("third", [&] { runner.check(false, "z"); });
    CHECK_EQ(runner.failures().size(), std::size_t{2});
    CHECK_EQ(runner.failures()[0], std::string("first"));
    CHECK_EQ(runner.failures()[1], std::string("third"));
}
```

## Hints
- `exit_code()` should be `failures_ == 0 ? 0 : 1`. That one line is the whole contract with CTest.
- `run` needs to know whether *this* test failed, which is what `current_failed_` is for: clear it before the body, and check it afterwards.
- `check` sets `current_failed_ = true` rather than incrementing a counter. The per-test tally happens in `run`, which is why three failed checks are one failed test.
- Wrap the call to `body()` in `try` / `catch (...)`, and treat any exception as a failure of that test. Catching `...` rather than `const std::exception&` also catches things that do not derive from it.
- After the body, either `++passed_` or `++failures_` and `failure_names_.push_back(name)`.
- The `(void)what;` in `check` is there because the starter ignores the message. A real harness would print it; the checks here only look at test names.

## Solution
```cpp
#include <cstddef>
#include <exception>
#include <functional>
#include <string>
#include <vector>

class TestRunner {
public:
    void run(const std::string& name, const std::function<void()>& body) {
        current_failed_ = false;
        try {
            body();
        } catch (...) {
            current_failed_ = true;      // a throw is a failure, not a crash
        }

        if (current_failed_) {
            ++failures_;
            failure_names_.push_back(name);
        } else {
            ++passed_;
        }
    }

    void check(bool condition, const std::string& what) {
        (void)what;
        if (!condition) current_failed_ = true;
    }

    std::size_t passed() const { return passed_; }
    std::size_t failed() const { return failures_; }
    const std::vector<std::string>& failures() const { return failure_names_; }

    int exit_code() const { return failures_ == 0 ? 0 : 1; }

private:
    std::size_t passed_ = 0;
    std::size_t failures_ = 0;
    std::vector<std::string> failure_names_;
    bool current_failed_ = false;
};
```

## Notes
`return failures_ == 0 ? 0 : 1;` is the most important line in any test harness,
and the easiest to leave out. A `main` that runs every test, prints a beautiful
report, and returns 0 regardless is a suite that passes forever — and CI, which
reads only the exit status, will agree with it. There is a whole genre of "green
build" that turns out to have been this the entire time.

The three failed checks counting as one failed test is a deliberate design
decision, and it is worth making consciously. Counting each failed *check*
separately makes the summary line misleading — a single broken function with
twenty assertions on it looks like twenty broken tests. Counting failed *tests*
answers the question a reader actually has: how many things are wrong. Real
frameworks report both, which is better still.

Catching `...` rather than `const std::exception&` matters more than it looks.
An uncaught exception escaping `main` calls `std::terminate`, which on most
systems aborts — CTest sees a signal rather than an exit code and reports
"Subprocess aborted". That is *technically* a failure and reports as one, but you
lose which test threw, and every test after it never runs. Catching it turns one
crash into one recorded failure and lets the rest of the suite finish, which is
what the "after" check in the tests is confirming.

What this harness deliberately does not do: run each test in its own process.
That is why a segmentation fault still takes the whole binary down, and why
frameworks that care about robustness — and CTest itself, one binary per
`add_test` — put a process boundary between tests. A `catch (...)` handles the
failures the language knows about; nothing in the language handles the ones it
does not.
