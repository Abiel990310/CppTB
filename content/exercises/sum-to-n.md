---
id: sum-to-n
title: "Off by one"
difficulty: intro
chapter: repetition
topics: [loops, control-flow]
check: unit
standard: c++20
---

`sum_to` should add up every integer from 1 to `n` inclusive, returning 0 when
`n` is less than 1. Its loop stops one iteration early, so `sum_to(5)` gives 10
instead of 15.

Fix the loop.

## Starter
```cpp
int sum_to(int n) {
    int total = 0;
    for (int i = 1; i < n; ++i) {
        total += i;
    }
    return total;
}
```

## Tests
```cpp
CHECK_EQ(sum_to(5), 15);
CHECK_EQ(sum_to(1), 1);
CHECK_EQ(sum_to(10), 55);
CHECK_EQ(sum_to(0), 0);
CHECK_EQ(sum_to(-3), 0);
CHECK_EQ(sum_to(100), 5050);
```

## Hints
- Trace `sum_to(5)`: the loop runs for i = 1, 2, 3, 4 and stops before 5.
- "Up to and including n" means the condition is `i <= n`.
- The `n < 1` cases still work afterwards — the loop body simply never runs.
- Do not change the initialiser; starting at 1 is correct.

## Solution
```cpp
int sum_to(int n) {
    int total = 0;
    for (int i = 1; i <= n; ++i) {
        total += i;
    }
    return total;
}
```

## Notes
Inclusive versus exclusive bounds is the single most common loop error, and the
cure is to say out loud what the condition means: `i < n` is "while i is below
n", `i <= n` is "while i is at most n". The second is what "from 1 to n
inclusive" asks for.

Note that `sum_to(0)` and `sum_to(-3)` need no special case. With `i` starting
at 1 and the condition `1 <= 0` being false immediately, the body never runs and
`total` stays 0 — the loop condition already encodes the empty case, which is
usually a sign it is written correctly.

There is a closed form: `n * (n + 1) / 2`, which computes `sum_to(100)` without
looping at all. It is worth knowing, though the loop is clearer for a reader and
the compiler is often able to do the same simplification for small fixed inputs.
