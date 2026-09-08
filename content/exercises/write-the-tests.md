---
id: write-the-tests
title: "Find the bug with a test"
difficulty: core
chapter: testing
topics: [testing, boundaries]
check: unit
standard: c++20
---

`clamp_to_range` should return `value` when it lies between `low` and `high`
inclusive, `low` when it is below, and `high` when it is above. It has a bug at
one of the boundaries.

Fix the function. The checks below are the test suite you would have written —
note which case exposes the bug.

## Starter
```cpp
int clamp_to_range(int value, int low, int high) {
    if (value < low) return low;
    if (value > high) return high - 1;
    return value;
}
```

## Tests
```cpp
// The typical case, which passes even with the bug present.
CHECK_EQ(clamp_to_range(5, 0, 10), 5);
CHECK_EQ(clamp_to_range(-3, 0, 10), 0);

// The boundaries, where the bug lives.
CHECK_EQ(clamp_to_range(0, 0, 10), 0);
CHECK_EQ(clamp_to_range(10, 0, 10), 10);
CHECK_EQ(clamp_to_range(11, 0, 10), 10);
CHECK_EQ(clamp_to_range(-1, 0, 10), 0);

// A degenerate range where low and high are equal.
CHECK_EQ(clamp_to_range(5, 3, 3), 3);
CHECK_EQ(clamp_to_range(1, 3, 3), 3);

// Negative ranges.
CHECK_EQ(clamp_to_range(-5, -10, -1), -5);
CHECK_EQ(clamp_to_range(0, -10, -1), -1);
```

## Hints
- `return high - 1;` is off by one — the clamped value should be `high` itself.
- Notice which checks would still pass with the bug: only the ones that never clamp upwards.
- The degenerate `low == high` case is worth keeping; it catches a whole family of range bugs.
- Once fixed, `std::clamp` from `<algorithm>` does the same job.

## Solution
```cpp
int clamp_to_range(int value, int low, int high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
}
```

## Notes
Look at which checks the broken version survives. `clamp_to_range(5, 0, 10)` and
`clamp_to_range(-3, 0, 10)` both pass, because neither clamps upwards — and
those are exactly the two cases a hurried test suite contains. The bug is only
visible at and above the upper boundary.

That is the argument for writing boundary cases first. The middle of the range
is where code is most likely to be right and least likely to tell you anything.

The `low == high` case is worth keeping even though the fixed version handles it
without special treatment. It costs one line and catches the family of bugs
where someone later "optimises" the comparison to `<` or `>` and breaks the
single-value range.

In real code, `std::clamp(value, low, high)` from `<algorithm>` already does
this. Writing it once by hand is worth it precisely because the off-by-one is so
easy — which is the reason the standard version exists.
