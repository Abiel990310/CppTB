---
id: fold-statistics
title: "Four folds, no loops"
difficulty: core
chapter: variadics
topics: [variadics, folds, templates]
check: unit
standard: c++20
---

Four small variadic functions, each of which should be a single fold
expression. The starter is a set of stubs.

- `total(args...)` — the sum, and `0` when there are no arguments.
- `largest(first, rest...)` — the maximum. It requires at least one argument, so
  there is no empty case to worry about.
- `all_within(limit, args...)` — `true` when every argument's absolute value is
  at most `limit`, and `true` for no arguments at all.
- `joined(args...)` — every argument written to one `std::ostringstream`,
  separated by a single space, with no trailing space.

No loops, no recursion, no helper overloads: each body should fit on one line.

## Starter
```cpp
#include <algorithm>
#include <cmath>
#include <sstream>
#include <string>

template <class... Args>
auto total(const Args&... args) {
    return 0;
}

template <class First, class... Rest>
First largest(const First& first, const Rest&... rest) {
    return first;
}

template <class... Args>
bool all_within(double limit, const Args&... args) {
    return false;
}

template <class... Args>
std::string joined(const Args&... args) {
    return {};
}
```

## Tests
```cpp
CHECK_EQ(total(1, 2, 3, 4), 10);
CHECK_EQ(total(), 0);
CHECK_EQ(total(1.5, 2.5), 4.0);

CHECK_EQ(largest(3), 3);
CHECK_EQ(largest(3, 9, 4), 9);
CHECK_EQ(largest(-8, -2, -5), -2);

CHECK(all_within(10.0));
CHECK(all_within(10.0, 1, -9, 3.5));
CHECK(!all_within(10.0, 1, -9, 30.5));
CHECK(!all_within(1.0, 2));

CHECK_EQ(joined(1, "two", 3.5), std::string("1 two 3.5"));
CHECK_EQ(joined("alone"), std::string("alone"));
CHECK_EQ(joined(), std::string(""));
```

## Hints
- `total` has to accept an empty pack, so it needs the **binary** form with an explicit identity: `(0 + ... + args)`.
- `largest` is the awkward one: `std::max` is a *function*, so there is no operator to fold over. Fold over the comma operator instead and let each step update a local: `((best = std::max(best, rest)), ...)`.
- A comma fold's value is its last operand, so `((best = …), ..., best)` both does the work and produces the answer, keeping the body a single `return`.
- A fold's pattern must be a single operand. `args > 0 && ...` will not parse; `(std::abs(args) <= limit) && ...` needs those parentheses.
- For `joined`, the separator is the awkward part: emitting `arg << ' '` for every element leaves a trailing space. Emit the separator *before* each element except the first, using a `bool` the fold updates.
- `all_within` over an empty pack must be `true`, which is what a unary `&&` fold already yields — but the binary form `(true && ... && (…))` says it out loud.

## Solution
```cpp
#include <algorithm>
#include <cmath>
#include <sstream>
#include <string>

template <class... Args>
auto total(const Args&... args) {
    return (0 + ... + args);
}

template <class First, class... Rest>
First largest(const First& first, const Rest&... rest) {
    First best = first;
    return ((best = std::max<First>(best, rest)), ..., best);
}

template <class... Args>
bool all_within(double limit, const Args&... args) {
    return (true && ... && (std::abs(static_cast<double>(args)) <= limit));
}

template <class... Args>
std::string joined(const Args&... args) {
    std::ostringstream out;
    bool first = true;
    ((out << (first ? "" : " ") << args, first = false), ...);
    return out.str();
}
```

## Notes
`largest` is the interesting one. `std::max` is a function, not an operator, so
there is no `(... max args)` to write. The way round it is to fold over the
comma operator and let each step update a local — and because a comma fold is
guaranteed left-to-right, the updates happen in order. The trailing `, best`
makes the whole fold expression evaluate to the answer, so the body is still one
`return`.

`joined` uses the same trick for a different reason. The separator problem —
"between the elements, not after them" — needs one bit of state, and a comma
fold is the only fold that can carry it, again because it is the only one whose
order is guaranteed.

Both are the general escape hatch: anything you could write as a loop body, you
can write as a comma fold over the pack. That does not always make it clearer,
but it does mean you rarely need recursion.

For `total`, `auto` as the return type matters: `total(1.5, 2.5)` must give
`4.0`, and a hard-coded `int` return would truncate it to `4`. The fold's own
type — worked out by the usual arithmetic conversions across the whole
expression — is the right answer, so let `auto` deduce it.
