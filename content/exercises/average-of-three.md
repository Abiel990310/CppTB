---
id: average-of-three
title: "An average that is actually right"
difficulty: intro
chapter: values-and-types
topics: [arithmetic, types]
check: unit
standard: c++20
---

`average` is meant to return the mean of three integers, but it truncates:
`average(1, 2, 2)` gives `1` instead of `1.6666…`. Fix it so the division
happens in floating point.

## Starter
```cpp
double average(int a, int b, int c) {
    return (a + b + c) / 3;
}
```

## Tests
```cpp
CHECK_NEAR(average(1, 2, 3), 2.0, 1e-9);
CHECK_NEAR(average(1, 2, 2), 1.6666666666, 1e-6);
CHECK_NEAR(average(0, 0, 1), 0.3333333333, 1e-6);
CHECK_NEAR(average(-1, 0, 1), 0.0, 1e-9);
CHECK_NEAR(average(-1, -2, -2), -1.6666666666, 1e-6);
```

## Hints
- The return type is already `double`. The problem is that the division finishes before the conversion happens.
- `(a + b + c)` and `3` are both `int`, so `/` is integer division regardless of what you do with the result afterwards.
- `static_cast<double>(...)` on one operand makes the whole division floating point.

## Solution
```cpp
double average(int a, int b, int c) {
    return static_cast<double>(a + b + c) / 3;
}
```

## Notes
The negative cases are the ones that catch a common half-fix. Integer division
truncates *toward zero*, so `-5 / 3` is `-1`, not `-2` — a bug that looks like
correct rounding for positive inputs and is wrong for negative ones. Converting
before dividing sidesteps the question entirely.

Writing `3.0` instead of `3` works too, and is arguably clearer. Both make one
operand floating point, which is all the language needs.
