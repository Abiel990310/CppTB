---
id: shift-arithmetic
title: "The shift that is not a division"
difficulty: core
chapter: what-the-compiler-does
topics: [performance, integers, undefined-behaviour]
check: unit
standard: c++20
---

Someone has "optimised" three divisions into shifts, on the grounds that a shift
is cheaper. Two of the three are now wrong.

Fix them so each function returns exactly what the division it replaced would
return, for every input in the tests — including negative ones. Keep the shift
where a shift is correct.

- `halve(x)` — `x / 2` for `int`.
- `eighth(x)` — `x / 8` for `int`.
- `halve_unsigned(x)` — `x / 2` for `unsigned`.
- `is_odd(x)` — whether `x` is odd, for `int`, including negatives.

## Starter
```cpp
#include <climits>

int halve(int x) {
    return x >> 1;
}

int eighth(int x) {
    return x >> 3;
}

unsigned halve_unsigned(unsigned x) {
    return x >> 1;
}

bool is_odd(int x) {
    return (x & 1) == 1;
}
```

## Tests
```cpp
CHECK_EQ(halve(10), 5);
CHECK_EQ(halve(11), 5);
CHECK_EQ(halve(0), 0);
CHECK_EQ(halve(-10), -5);
CHECK_EQ(halve(-11), -5);      // C++ rounds towards zero, not towards -infinity
CHECK_EQ(halve(-1), 0);

CHECK_EQ(eighth(64), 8);
CHECK_EQ(eighth(63), 7);
CHECK_EQ(eighth(-64), -8);
CHECK_EQ(eighth(-63), -7);
CHECK_EQ(eighth(-1), 0);

CHECK_EQ(halve_unsigned(10u), 5u);
CHECK_EQ(halve_unsigned(11u), 5u);
CHECK_EQ(halve_unsigned(0u), 0u);
CHECK_EQ(halve_unsigned(4294967294u), 2147483647u);

CHECK(is_odd(3));
CHECK(is_odd(-3));
CHECK(!is_odd(4));
CHECK(!is_odd(-4));
CHECK(!is_odd(0));

// The edge every "just shift it" refactor forgets.
CHECK_EQ(halve(INT_MIN), INT_MIN / 2);
CHECK_EQ(halve(INT_MAX), INT_MAX / 2);
```

## Hints
- Work out `-11 >> 1` by hand on a two's-complement machine, then compare it with `-11 / 2`. They differ, and the difference is the whole exercise.
- `>>` on a negative signed value is an *arithmetic* shift: it fills with the sign bit, which rounds towards negative infinity. `/` rounds towards zero.
- The simplest correct fix is to write the division and let the compiler do the rest. It already emits the shift when the shift is right, and the correcting instructions when it is not — Chapter 7.1 shows both.
- `halve_unsigned` is the one that was already correct. Unsigned values have no negative case, so shift and divide agree everywhere.
- `is_odd` fails on negatives because `-3 & 1` is `1` but `-3 % 2` is `-1`. Ask whether the low bit is set, not whether the remainder equals `1`.
- `INT_MIN / 2` is fine; `-INT_MIN` is not. Do not "fix" the negative case by negating, halving, and negating back.

## Solution
```cpp
#include <climits>

int halve(int x) {
    return x / 2;
}

int eighth(int x) {
    return x / 8;
}

unsigned halve_unsigned(unsigned x) {
    return x >> 1;
}

bool is_odd(int x) {
    return (x & 1) != 0;
}
```

## Notes
The fix for two of the four is to undo the optimisation, which is the point.
`x / 2` on an `int` compiles to four instructions — a shift to extract the sign
bit, an add to bias the value, and an arithmetic shift — and every one of them
is there because the standard says division rounds towards zero. Replacing that
with `x >> 1` does not make the code faster; it makes it *different*, and wrong
for half the number line.

`halve_unsigned` shows what the manual version buys you: nothing. The compiler
already emits a single `shrl` for `x / 2` on an `unsigned`, because with no
negative values the two operations agree. Writing the shift by hand produces
identical assembly and a less obvious function.

`is_odd` is the subtler bug. `x & 1` correctly extracts the low bit for any
value, but `x % 2` is `-1` for a negative odd number, so a test written as
`x % 2 == 1` — the natural translation — silently answers "no" for every
negative odd input. The bitwise version is correct as long as you compare
against zero rather than against one.

The general rule this chapter argues for: write the operation you mean. The
optimiser knows the identities, applies them when they hold, and declines when
they do not. A hand-applied identity has no such judgement.
