---
id: macro-free-interface
title: "Four macros that are not functions"
difficulty: core
chapter: modules
topics: [macros, constexpr, templates, interfaces]
check: unit
standard: c++20
---

A header full of macros. Each one looks like a function and behaves like text
substitution, and all four are wrong in a different way.

Replace each with a `constexpr` function or function template that behaves
correctly. Keep the names, so callers do not change.

- `MAX(a, b)` evaluates one of its arguments **twice**, so an argument with a
  side effect happens twice.
- `SQUARE(x)` has no parentheses, so `SQUARE(2 + 3)` is `2 + 3 * 2 + 3`.
- `IS_EVEN(n)` returns an `int` where a `bool` is meant, and breaks on negatives.
- `CLAMP(v, lo, hi)` evaluates `v` up to three times.

## Starter
```cpp
#include <cstddef>

// The macros to replace. Delete them.
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define SQUARE(x) x * x
#define IS_EVEN(n) (n % 2 == 0)
#define CLAMP(v, lo, hi) ((v) < (lo) ? (lo) : ((v) > (hi) ? (hi) : (v)))

// --- given, do not change: counts how often an argument is evaluated ---
int evaluations = 0;

int counted(int value) {
    ++evaluations;
    return value;
}
// ----------------------------------------------------------------------
```

## Tests
```cpp
// Each argument must be evaluated exactly once.
evaluations = 0;
int biggest = MAX(counted(7), 3);
CHECK_EQ(biggest, 7);
CHECK_EQ(evaluations, 1);

evaluations = 0;
CHECK_EQ(MAX(counted(1), counted(2)), 2);
CHECK_EQ(evaluations, 2);

// Precedence: the argument is an expression, not text.
CHECK_EQ(SQUARE(2 + 3), 25);
CHECK_EQ(SQUARE(4), 16);
CHECK_EQ(SQUARE(-3), 9);

evaluations = 0;
CHECK_EQ(SQUARE(counted(6)), 36);
CHECK_EQ(evaluations, 1);

// IS_EVEN returns bool and handles negatives.
static_assert(std::is_same_v<decltype(IS_EVEN(4)), bool>);
CHECK(IS_EVEN(4));
CHECK(!IS_EVEN(5));
CHECK(IS_EVEN(0));
CHECK(IS_EVEN(-4));
CHECK(!IS_EVEN(-5));          // -5 % 2 is -1, not 1

evaluations = 0;
CHECK(IS_EVEN(counted(8)));
CHECK_EQ(evaluations, 1);

// CLAMP evaluates each argument once.
evaluations = 0;
CHECK_EQ(CLAMP(counted(15), 0, 10), 10);
CHECK_EQ(evaluations, 1);

evaluations = 0;
CHECK_EQ(CLAMP(counted(-5), 0, 10), 0);
CHECK_EQ(evaluations, 1);

evaluations = 0;
CHECK_EQ(CLAMP(counted(5), 0, 10), 5);
CHECK_EQ(evaluations, 1);

// And they must still work at compile time, which the macros did.
static_assert(MAX(3, 9) == 9);
static_assert(SQUARE(5) == 25);
static_assert(IS_EVEN(10));
static_assert(CLAMP(99, 0, 10) == 10);

// Doubles, which the macros also handled.
CHECK_NEAR(MAX(1.5, 2.5), 2.5, 1e-12);
CHECK_NEAR(SQUARE(1.5), 2.25, 1e-12);
```

## Hints
- Delete the `#define`s entirely. Anything left behind will be substituted before the compiler ever sees your function.
- `MAX` and `CLAMP` need to work for `int` and `double`, so they are function templates: `template <class T> constexpr T MAX(T a, T b)`.
- Naming a function `MAX` in capitals is unusual, and here it is deliberate — the point is that callers do not have to change.
- `constexpr` is what keeps the `static_assert`s working. A plain function cannot appear in one.
- A function evaluates each argument exactly once, before the body runs. That fixes the double-evaluation problems with no effort on your part — it is the default.
- `IS_EVEN` should return `bool`. For negatives, `n % 2` is `-1` rather than `1`, so compare against zero: `n % 2 == 0` is already right, and `n % 2 == 1` would not be.
- Take parameters by value for these; they are all small arithmetic types.

## Solution
```cpp
#include <cstddef>
#include <type_traits>

template <class T>
constexpr T MAX(T a, T b) {
    return a > b ? a : b;
}

template <class T>
constexpr T SQUARE(T x) {
    return x * x;
}

constexpr bool IS_EVEN(int n) {
    return n % 2 == 0;
}

template <class T>
constexpr T CLAMP(T value, T low, T high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
}

int evaluations = 0;

int counted(int value) {
    ++evaluations;
    return value;
}
```

## Notes
The four bugs are all the same bug wearing different clothes: **a macro is text,
and text has no arguments.**

`MAX(counted(7), 3)` expands to `((counted(7)) > (3) ? (counted(7)) : (3))`.
There is no argument named `a` that gets evaluated once — the call is written out
twice, so the function runs twice. With `counted` the checks see it; with
`MAX(*it++, limit)` you get a silently skipped element, and with
`MAX(expensive(), 0)` you get twice the runtime.

`SQUARE(2 + 3)` expands to `2 + 3 * 2 + 3`, which is 11. The usual fix is
parentheses everywhere — `#define SQUARE(x) ((x) * (x))` — and it fixes the
precedence while leaving the double evaluation exactly as it was. Half a fix is
what makes these bugs survive review.

`IS_EVEN` returning `int` rather than `bool` matters less than it looks, but the
negative case matters a lot: the natural-looking `n % 2 == 1` is false for every
negative odd number, because C++ integer division rounds towards zero and `-5 %
2` is `-1`. The same fact appeared in Chapter 7.1 as the reason signed division
by two costs three instructions more than unsigned.

A `constexpr` function fixes all four at once, because a function *has*
arguments: they are evaluated once, before the body runs, in a way the language
guarantees. And `constexpr` means the compile-time uses the macros supported keep
working — the `static_assert`s in the checks are what pin that down.

The connection to modules: a macro leaks. Define these in a header and every
file that includes it, and every file *those* files include, has an identifier
called `MAX` that will silently rewrite any code that uses the word. That is
what modules put a stop to, and it is why the migration advice in this chapter
starts with "get the macros out of your headers" — because a component with no
macros in its interface is one that can become a module without any of its
consumers noticing.
