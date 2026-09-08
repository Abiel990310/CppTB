---
id: complexity-audit
title: "What does this actually cost?"
difficulty: core
chapter: counting-the-work
topics: [complexity, containers, analysis]
check: unit
standard: c++20
---

Six functions. For each, work out how many times its innermost operation runs as
a function of `n`, and return that count from the matching `cost_*` function.

The `cost_*` functions do not run the loops — they return the exact count, so
that getting the arithmetic right is the exercise. The counts are exact, not
big-O: `n(n-1)/2` rather than `n²`.

- `cost_nested(n)` — `for i in [0,n): for j in [0,n): step()`
- `cost_triangular(n)` — `for i in [0,n): for j in [i+1,n): step()`
- `cost_sequential(n)` — `for i in [0,n): step()` then `for j in [0,n): step()`
- `cost_halving(n)` — `for (i = n; i > 0; i /= 2) step()`, for `n ≥ 1`
- `cost_two_pointer(n)` — an outer loop over `n` with an inner `while` that
  advances a shared index that never resets, so the inner body runs `n` times in
  total across the whole outer loop, plus one comparison per outer step
- `cost_erase_front(n)` — emptying a `vector` of `n` elements with
  `erase(begin())`, counting element moves: the first erase moves `n-1`
  elements, the next `n-2`, and so on

## Starter
```cpp
#include <cstddef>

long long cost_nested(long long n)      { return 0; }
long long cost_triangular(long long n)  { return 0; }
long long cost_sequential(long long n)  { return 0; }
long long cost_halving(long long n)     { return 0; }
long long cost_two_pointer(long long n) { return 0; }
long long cost_erase_front(long long n) { return 0; }
```

## Tests
```cpp
// nested: n^2
CHECK_EQ(cost_nested(0), 0LL);
CHECK_EQ(cost_nested(1), 1LL);
CHECK_EQ(cost_nested(10), 100LL);
CHECK_EQ(cost_nested(100000), 10000000000LL);      // 10^10: needs long long

// triangular: n(n-1)/2
CHECK_EQ(cost_triangular(0), 0LL);
CHECK_EQ(cost_triangular(1), 0LL);
CHECK_EQ(cost_triangular(2), 1LL);
CHECK_EQ(cost_triangular(10), 45LL);
CHECK_EQ(cost_triangular(100000), 4999950000LL);

// sequential: 2n
CHECK_EQ(cost_sequential(0), 0LL);
CHECK_EQ(cost_sequential(7), 14LL);
CHECK_EQ(cost_sequential(1000000), 2000000LL);

// halving: floor(log2(n)) + 1 for n >= 1
CHECK_EQ(cost_halving(1), 1LL);
CHECK_EQ(cost_halving(2), 2LL);
CHECK_EQ(cost_halving(3), 2LL);
CHECK_EQ(cost_halving(4), 3LL);
CHECK_EQ(cost_halving(7), 3LL);
CHECK_EQ(cost_halving(8), 4LL);
CHECK_EQ(cost_halving(1024), 11LL);
CHECK_EQ(cost_halving(1000000000), 30LL);

// two pointers: n inner steps in total, plus n outer comparisons
CHECK_EQ(cost_two_pointer(0), 0LL);
CHECK_EQ(cost_two_pointer(1), 2LL);
CHECK_EQ(cost_two_pointer(1000), 2000LL);
CHECK_EQ(cost_two_pointer(1000000), 2000000LL);

// erase from the front: (n-1) + (n-2) + ... + 0
CHECK_EQ(cost_erase_front(0), 0LL);
CHECK_EQ(cost_erase_front(1), 0LL);
CHECK_EQ(cost_erase_front(2), 1LL);
CHECK_EQ(cost_erase_front(10), 45LL);
CHECK_EQ(cost_erase_front(50000), 1249975000LL);
```

## Hints
- `cost_nested` is `n * n`. Both are `long long` already, so the multiplication is 64-bit — but check that, do not assume it.
- `cost_triangular`: the inner loop runs `n-1` times, then `n-2`, down to 0. That sum is `n(n-1)/2`. Watch `n = 0`, where the formula gives 0 only if you do not overflow going negative.
- `cost_sequential` is `2n`, not `n²`. Loops in sequence add.
- `cost_halving` counts how many times you can halve `n` before reaching 0, which is `floor(log2(n)) + 1`. A loop is the clearest way to compute it; there is no need for `std::log`, which would give wrong answers at exact powers of two through floating-point rounding.
- `cost_two_pointer` is `2n`: the shared index advances at most `n` times across the whole run, and the outer loop performs one comparison per step. This is the case that *looks* like `n²` and is not.
- `cost_erase_front` is the same triangular sum as `cost_triangular`, arrived at from the other direction: each erase moves everything after it.
- Every one of these can exceed 2 × 10⁹, so do the arithmetic in `long long` throughout — which the signatures already give you.

## Solution
```cpp
#include <cstddef>

long long cost_nested(long long n) {
    return n * n;
}

long long cost_triangular(long long n) {
    if (n < 2) return 0;
    return n * (n - 1) / 2;
}

long long cost_sequential(long long n) {
    return 2 * n;
}

long long cost_halving(long long n) {
    long long steps = 0;
    for (long long i = n; i > 0; i /= 2) ++steps;
    return steps;
}

long long cost_two_pointer(long long n) {
    return 2 * n;
}

long long cost_erase_front(long long n) {
    if (n < 2) return 0;
    return n * (n - 1) / 2;
}
```

## Notes
Two pairs of these are the same function, and the two that are not are the point.

`cost_triangular` and `cost_erase_front` both compute `n(n-1)/2`, from opposite
directions: one counts the iterations of a visible nested loop, the other counts
the element moves hidden inside `erase(begin())`. They cost the same and only
one of them looks like it should. At n = 50,000 that is 1.25 billion element
moves — which is what the chapter's sample measures as 60 ms of sanitized
runtime for a loop containing nothing but `v.erase(v.begin())`.

`cost_sequential` and `cost_two_pointer` are both `2n`, and again one of them
looks quadratic. The two-pointer shape — an outer `for` with an inner `while`
advancing a shared index — is the one people miscount, because the inner loop
*can* run `n` times on a single outer iteration. It cannot do so more than once,
because the index never resets. Counting the total work across the whole run
rather than the worst case of one iteration is the technique, and it is what
makes Chapter 10.6's sliding windows linear.

`cost_halving` is the one where a closed form is a trap. `floor(log2(n)) + 1` is
correct, and computing it as `static_cast<long long>(std::log2(n)) + 1` is not:
`std::log2(8)` can come back as 2.9999999999999996 on some implementations,
giving 3 where the answer is 4. The loop has no such problem and is not slower in
any way that matters. Exact integer questions want integer arithmetic — the same
argument Chapter 5.5 made for doing work at compile time, and Chapter 1.2 made
about floating point in the first place.

The reason to compute *exact* counts rather than big-O here: big-O tells you
`cost_triangular` and `cost_nested` are both O(n²), and the factor of two between
them is frequently the difference between 0.9 seconds and 1.8. When you are
inside a factor of two or three of a time limit, the constant is the whole
question, and the only way to reason about it is to count.
