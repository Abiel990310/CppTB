---
id: expected-pipeline
title: "Chain the fallible steps"
difficulty: stretch
chapter: error-handling-without-exceptions
topics: [error-handling, expected, api-design]
check: unit
standard: c++23
---

Write `process`, which parses a string to an integer, rejects negative values,
and multiplies the result by 100. It must report the **first** failure it meets.

Use `and_then` and `transform` so the failure path appears once rather than
after every step. The hand-written version with nested `if`s also works, and the
notes show it; the point of this problem is the chain.

## Starter
```cpp
#include <expected>
#include <string>

enum class Error { empty, not_a_number, negative };

std::expected<int, Error> to_int(const std::string& text) {
    if (text.empty()) return std::unexpected{Error::empty};
    try { return std::stoi(text); }
    catch (...) { return std::unexpected{Error::not_a_number}; }
}

std::expected<int, Error> require_non_negative(int value) {
    if (value < 0) return std::unexpected{Error::negative};
    return value;
}

std::expected<int, Error> process(const std::string& text) {
    return std::unexpected{Error::empty};
}
```

## Tests
```cpp
auto ok = process("7");
CHECK(ok.has_value());
CHECK_EQ(ok.value(), 700);

auto zero = process("0");
CHECK(zero.has_value());
CHECK_EQ(zero.value(), 0);

auto neg = process("-3");
CHECK(!neg.has_value());
CHECK(neg.error() == Error::negative);

auto bad = process("abc");
CHECK(!bad.has_value());
CHECK(bad.error() == Error::not_a_number);

auto none = process("");
CHECK(!none.has_value());
CHECK(none.error() == Error::empty);

// The first failure wins: an empty string never reaches the negativity check.
auto first = process("");
CHECK(first.error() == Error::empty);
```

## Hints
- `and_then` takes a function returning another `expected` and runs it only on success, passing errors through unchanged.
- `transform` takes a function returning a plain value and wraps the result; errors pass through untouched.
- `require_non_negative` returns an `expected`, so it belongs in `and_then`. Multiplying by 100 cannot fail, so it belongs in `transform`.
- The whole body becomes a single `return` expression.

## Solution
```cpp
#include <expected>
#include <string>

enum class Error { empty, not_a_number, negative };

std::expected<int, Error> to_int(const std::string& text) {
    if (text.empty()) return std::unexpected{Error::empty};
    try { return std::stoi(text); }
    catch (...) { return std::unexpected{Error::not_a_number}; }
}

std::expected<int, Error> require_non_negative(int value) {
    if (value < 0) return std::unexpected{Error::negative};
    return value;
}

std::expected<int, Error> process(const std::string& text) {
    return to_int(text)
        .and_then(require_non_negative)
        .transform([](int value) { return value * 100; });
}
```

## Notes
Written by hand, each step needs its own failure check:

```cpp
std::expected<int, Error> process(const std::string& text) {
    auto parsed = to_int(text);
    if (!parsed) return std::unexpected{parsed.error()};

    auto checked = require_non_negative(*parsed);
    if (!checked) return std::unexpected{checked.error()};

    return *checked * 100;
}
```

That is correct, and it is what the chain replaces. Nine lines become three, and
the error handling disappears — not because it
stopped happening, but because `and_then` and `transform` already know how to
propagate a failure. The starter's `if (!parsed) return std::unexpected{...}` is
exactly what `and_then` does for you, written out by hand once per step.

Choosing between the two operations is mechanical. If the step can itself fail —
returns an `expected` — it is `and_then`, which would otherwise leave you with a
nested `expected<expected<int, E>, E>`. If it cannot fail, it is `transform`.

Note the last check. Short-circuiting is what makes the chain equivalent to the
nested version: once a step fails, every later step is skipped and the original
error is what comes out. `std::optional` gained the same two operations in
C++23.
