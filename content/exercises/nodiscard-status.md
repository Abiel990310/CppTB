---
id: nodiscard-status
title: "Do not let it be ignored"
difficulty: core
chapter: error-handling-without-exceptions
topics: [error-handling, api-design, nodiscard]
check: unit
standard: c++20
---

`Writer` reports failure by returning a `Status`, but nothing stops a caller
discarding it — and `write` returns `void` for its most important overload, so
one failure cannot be reported at all.

Fix the API:

- make `Status` a `[[nodiscard]]` type, so discarding any function's result warns
- give `Status` an `explicit operator bool` that is true on success
- change `write_all` to return `Status`, propagating the first failure it meets
  and stopping there

## Starter
```cpp
#include <string>
#include <vector>

enum class WriteError { none, too_long, forbidden };

struct Status {
    WriteError error = WriteError::none;
};

class Writer {
public:
    Status write(const std::string& line) {
        if (line.size() > 10) return Status{WriteError::too_long};
        if (line == "secret") return Status{WriteError::forbidden};
        written_.push_back(line);
        return Status{};
    }

    void write_all(const std::vector<std::string>& lines) {
        for (const auto& line : lines) {
            write(line);
        }
    }

    std::size_t count() const { return written_.size(); }

private:
    std::vector<std::string> written_;
};
```

## Tests
```cpp
Writer w;

CHECK(static_cast<bool>(w.write("short")));
CHECK_EQ(w.count(), std::size_t{1});

Status too_long = w.write("this line is far too long");
CHECK(!static_cast<bool>(too_long));
CHECK(too_long.error == WriteError::too_long);
CHECK_EQ(w.count(), std::size_t{1});

// write_all must report the first failure and stop there.
Writer w2;
Status result = w2.write_all({"one", "two", "secret", "four"});
CHECK(!static_cast<bool>(result));
CHECK(result.error == WriteError::forbidden);
CHECK_EQ(w2.count(), std::size_t{2});

// All-successful input reports success and writes everything.
Writer w3;
Status ok = w3.write_all({"a", "b", "c"});
CHECK(static_cast<bool>(ok));
CHECK(ok.error == WriteError::none);
CHECK_EQ(w3.count(), std::size_t{3});

// An empty list is a success.
Writer w4;
CHECK(static_cast<bool>(w4.write_all({})));
```

## Hints
- `struct [[nodiscard]] Status { ... };` marks the type, which covers every function returning it.
- `explicit operator bool() const { return error == WriteError::none; }` — `explicit` still allows use in an `if` or a cast.
- `write_all` returns `Status`; return the failing status as soon as one write fails.
- Reaching the end of the loop means everything succeeded, so return a default `Status{}`.

## Solution
```cpp
#include <string>
#include <vector>

enum class WriteError { none, too_long, forbidden };

struct [[nodiscard]] Status {
    WriteError error = WriteError::none;
    explicit operator bool() const { return error == WriteError::none; }
};

class Writer {
public:
    Status write(const std::string& line) {
        if (line.size() > 10) return Status{WriteError::too_long};
        if (line == "secret") return Status{WriteError::forbidden};
        written_.push_back(line);
        return Status{};
    }

    Status write_all(const std::vector<std::string>& lines) {
        for (const auto& line : lines) {
            if (Status s = write(line); !s) return s;
        }
        return Status{};
    }

    std::size_t count() const { return written_.size(); }

private:
    std::vector<std::string> written_;
};
```

## Notes
The `w2.count() == 2` check is what forces "stop at the first failure" rather
than "keep going and remember the last error". Which of those is right depends
on the API — a batch writer might reasonably continue — but it has to be a
decision, and the starter made it by accident by discarding every result.

`explicit` on the conversion is deliberate. Without it, a `Status` would convert
to `bool` implicitly and could be passed to an `int` parameter or compared with
`0`, which is the same class of accident as the non-explicit constructor in
Chapter 3.1. `explicit` still permits `if (s)` and `!s`, because those are
contextual conversions.

`[[nodiscard]]` on the type does not make ignoring a `Status` an error — it makes
it a warning, and `-Werror` in CI is what turns that into a rule. That layering
is deliberate: the language flags it, and your build policy decides how strict
to be.
