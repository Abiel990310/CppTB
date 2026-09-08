---
id: safe-guard
title: "Guard before you look"
difficulty: intro
chapter: making-decisions
topics: [control-flow, short-circuit, containers]
check: unit
standard: c++20
---

`first_is_positive` checks whether a vector's first element is positive. It reads
`v[0]` before checking that the vector has an element, so on an empty vector it
reads out of bounds.

Fix it using short-circuit evaluation. The checks run under AddressSanitizer, so
the out-of-bounds read fails rather than returning a plausible answer.

## Starter
```cpp
#include <vector>

bool first_is_positive(const std::vector<int>& v) {
    return v[0] > 0 && !v.empty();
}
```

## Tests
```cpp
std::vector<int> positive{5, 1};
std::vector<int> negative{-5, 1};
std::vector<int> zero{0};
std::vector<int> empty;

CHECK(first_is_positive(positive));
CHECK(!first_is_positive(negative));
CHECK(!first_is_positive(zero));
CHECK(!first_is_positive(empty));

// Repeated calls on an empty vector must stay safe.
for (int i = 0; i < 100; ++i) {
    CHECK(!first_is_positive(empty));
}
```

## Hints
- `&&` evaluates its **left** operand first, and only evaluates the right one if the left was true.
- The emptiness check therefore has to come first.
- Zero is not positive, so `> 0` is right and `>= 0` is not.
- Once the order is correct, the empty case returns false without ever touching `v[0]`.

## Solution
```cpp
#include <vector>

bool first_is_positive(const std::vector<int>& v) {
    return !v.empty() && v[0] > 0;
}
```

## Notes
The fix is to swap two operands, and the reason it works is worth stating
precisely: `&&` guarantees left-to-right evaluation and guarantees that the
right operand is *not* evaluated when the left is false. That is not an
optimisation the compiler may skip — it is required by the language, which is
what makes guard-then-use a safe pattern rather than a lucky one.

This is also why `&&` must never be overloaded for a custom type. An overloaded
`operator&&` is an ordinary function call, so both arguments are evaluated
before it runs, and every guard written this way silently stops guarding.

The hundred-iteration loop at the end is not padding. An out-of-bounds read on
an empty vector may return a plausible value on any single run; repeating it
makes the sanitizer's report certain.
