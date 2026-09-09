---
id: judge-range-queries
title: "Range sums, many of them"
difficulty: core
chapter: prefix-sums
topics: [prefix-sums, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given an array of `n` integers and `q` queries, print the sum of each queried
range.

**Input.** The first line contains `n` and `q`. The second line contains `n`
integers `a₁ … aₙ`. Each of the next `q` lines contains `l` and `r`
(`1 ≤ l ≤ r ≤ n`), asking for the sum of `a_l` through `a_r` inclusive.

**Output.** `q` lines, one sum per query, in order.

**Constraints.** `1 ≤ n, q ≤ 200000`, `|aᵢ| ≤ 10⁹`. Both indices are 1-based
and inclusive.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, q;
    std::cin >> n >> q;

    // p[i] is the sum of the first i values, so p[0] is 0.
    std::vector<long long> p(n + 1, 0);
    for (int i = 0; i < n; ++i) {
        int x;
        std::cin >> x;
        p[i + 1] = p[i] + x;
    }

    for (int i = 0; i < q; ++i) {
        int l, r;
        std::cin >> l >> r;
        std::cout << p[r] - p[l] << '\n';
    }
}
```

## Cases

### Sample
```in
5 3
1 2 3 4 5
1 5
2 3
3 3
```
```out
15
5
3
```

### a single element
```in
1 1
7
1 1
```
```out
7
```

### every kind of range
```in
6 4
2 1 5 1 3 2
1 6
1 1
6 6
2 4
```
```out
14
2
2
7
```

### a total no int can hold
```in
3 1
1000000000 1000000000 1000000000
1 3
```
```out
3000000000
```

### negative values
```in
4 2
-1 -2 -3 -4
1 4
2 2
```
```out
-10
-2
```

### the same range asked twice
```in
3 2
5 5 5
2 3
2 3
```
```out
10
10
```

## Hints
- Build `p` once, before answering anything. Rebuilding it per query is the O(nq) solution the constraints rule out.
- With `p[0] = 0` and `p[i + 1] = p[i] + a[i]`, `p[k]` is the sum of the *first k* values — a count, not an index.
- So the sum of the 1-based inclusive range `l … r` is `p[r] - p[l - 1]`. Check it against `l == r == 1`, which must give `a₁`.
- The values reach 10⁹ and there can be 2 × 10⁵ of them, so the totals reach 2 × 10¹⁴. `p` is `long long`.
- With 2 × 10⁵ lines of output, `'\n'` rather than `std::endl`, and the two lines of I/O setup from chapter 10.3, are worth having.

## Solution
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, q;
    std::cin >> n >> q;

    std::vector<long long> p(n + 1, 0);
    for (int i = 0; i < n; ++i) {
        int x;
        std::cin >> x;
        p[i + 1] = p[i] + x;
    }

    for (int i = 0; i < q; ++i) {
        int l, r;
        std::cin >> l >> r;
        std::cout << p[r] - p[l - 1] << '\n';   // 1-based, inclusive
    }
}
```

## Notes
The starter builds the table correctly and then subtracts the wrong entry. It
answers `p[r] - p[l]`, which is the sum of `a_{l+1} … a_r` — every answer is
short by exactly `a_l`, and a single-element query comes out as 0.

The conversion is worth doing once, slowly, and then never again:

```
p[k]                  == a_1 + ... + a_k         (k values, not index k)
p[r] - p[l - 1]       == a_l + ... + a_r         (1-based, inclusive)
p[r] - p[l]           == a_{l+1} + ... + a_r     (what the starter computes)
```

If the input had been 0-based and half-open, the answer would be `p[r] - p[l]`
with no adjustment at all. The subtraction of 1 is not part of the prefix-sum
technique; it is the cost of the input convention, and it belongs at the
boundary where the input is read.

Two things the cases here are checking beyond the off-by-one.

**The type.** Three values of 10⁹ already exceed what an `int` holds. At the
stated limits the totals reach 2 × 10¹⁴, so both `p` and the printed result are
`long long`. Reading each `a` into an `int` is fine — the individual values fit;
it is only their running total that does not.

**The output volume.** 2 × 10⁵ lines through `std::cout` with
`sync_with_stdio(false)` and `'\n'` is comfortable; the same through
`std::endl` flushes 200,000 times and is not. The cases here are far too small
to demonstrate that, so it is stated rather than shown — chapter 10.3 measured
it.
