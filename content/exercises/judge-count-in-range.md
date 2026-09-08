---
id: judge-count-in-range
title: "Multiples in a range"
difficulty: core
chapter: counting-the-work
topics: [arithmetic, complexity, constraints, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given `L`, `R` and `k`, print how many integers `x` with `L ≤ x ≤ R` are
divisible by `k`.

**Input.** One line containing `L`, `R` and `k`, separated by spaces.

**Output.** One line: the count.

**Constraints.** `1 ≤ L ≤ R ≤ 10^18`, `1 ≤ k ≤ 10^18`.

Look at the size of `R` before you write a loop.

## Starter
```cpp
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    long long l, r, k;
    std::cin >> l >> r >> k;

    long long count = 0;
    for (long long x = l; x <= r; ++x)
        if (x % k == 0) ++count;

    std::cout << count << '\n';
}
```

## Cases

### Sample
```in
1 10 3
```
```out
3
```

### the range is one number, and it divides
```in
5 5 5
```
```out
1
```

### the range is one number, and it does not
```in
5 5 7
```
```out
0
```

### k is larger than the whole range
```in
10 20 1000
```
```out
0
```

### k is one
```in
1 1000000000000000000 1
```
```out
1000000000000000000
```

### the largest possible range
```in
1 1000000000000000000 7
```
```out
142857142857142857
```

### both ends near the top
```in
999999999999999999 1000000000000000000 1000000000000000000
```
```out
1
```

## Hints
- `R` goes to 10¹⁸. A loop over the range would take about ten billion seconds. There is no constant factor that fixes that; the shape has to change.
- Count the multiples of `k` from 1 up to `R`: there are `R / k` of them, using integer division, which truncates.
- Subtract the ones below `L`: there are `(L - 1) / k` multiples of `k` in `[1, L-1]`.
- So the answer is `R / k - (L - 1) / k`, which is two divisions and a subtraction.
- `L ≥ 1` is guaranteed, so `L - 1` is never negative and integer division behaves the way the formula assumes.
- Every value here needs `long long`. `10^18` is comfortably inside its range and nowhere near an `int`'s.
- Check the formula by hand on the sample before submitting: `10 / 3 = 3`, `0 / 3 = 0`, so the answer is 3 — which matches 3, 6 and 9.

## Solution
```cpp
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    long long l, r, k;
    std::cin >> l >> r >> k;

    // Multiples of k in [1, R], minus multiples of k in [1, L-1].
    std::cout << (r / k - (l - 1) / k) << '\n';
}
```

## Notes
The starter is not a bad algorithm being slow. It is the right answer computed
in a way the constraints have already ruled out, and the constraints are the only
part of the statement that says so.

`R ≤ 10^18` with a budget of a few hundred million operations per second is
about ten billion seconds — roughly three hundred years. There is no compiler
flag, no `sync_with_stdio`, no micro-optimisation that touches this. Chapter
10.1's table maps 10¹⁸ to "O(log n) or O(1)", and this problem is the O(1) row:
when the bound is that large, the answer is arithmetic.

Deriving the formula is the standard trick for counting things in a range, and
it generalises well beyond this problem: **count from the start, then subtract
the part you did not want.** `f(R) − f(L−1)` where `f(x)` counts qualifying
values in `[1, x]`. It is the same idea as a prefix sum (Chapter 10.7), applied
to a function you can evaluate directly instead of a table you built.

The `L - 1` rather than `L` is where the off-by-one lives. Subtracting `L / k`
would remove the multiples in `[1, L]`, which wrongly excludes `L` itself when
`L` is a multiple of `k` — the `5 5 5` case exists to catch exactly that, and it
is the only case in the set that does.

The last case is worth noticing for a different reason: `L` and `R` are adjacent
integers near 10¹⁸ and `k` is 10¹⁸ itself. `R / k` is 1, `(L-1) / k` is 0, the
answer is 1. Nothing overflows, because every intermediate value is bounded by
`R`. A solution that computed `(R - L + 1) / k` — a plausible-looking shortcut —
gets 0 here, and passes the sample.
