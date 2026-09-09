---
id: judge-closest-subset-sum
title: "The closest subset sum"
difficulty: stretch
chapter: meet-in-the-middle
topics: [meet-in-the-middle, binary-search, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Given `n` positive integers and a target `S`, print the largest subset sum that
does not exceed `S`. The empty subset counts, and sums to 0.

**Input.** The first line contains `n` and `S`. The second line contains `n`
integers.

**Output.** One line: the largest achievable sum not exceeding `S`.

**Constraints.** `1 ≤ n ≤ 36`, `1 ≤ aᵢ ≤ 10⁹`, `0 ≤ S ≤ 10¹⁸`. With `n` up to
36 there are 6.9 × 10¹⁰ subsets, so they cannot all be enumerated.

## Starter
```cpp
#include <algorithm>
#include <bit>
#include <iostream>
#include <vector>

std::vector<long long> half_sums(const std::vector<long long>& a, int from, int to) {
    int k = to - from;
    std::vector<long long> sums(std::size_t{1} << k, 0);
    for (unsigned m = 1; m < (1u << k); ++m)
        sums[m] = sums[m & (m - 1)] + a[from + std::countr_zero(m)];
    return sums;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long target;
    std::cin >> n >> target;
    std::vector<long long> a(n);
    for (long long& x : a) std::cin >> x;

    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long best = 0;
    for (long long s : ls) {
        auto it = std::lower_bound(rs.begin(), rs.end(), target - s);
        if (it != rs.end() && s + *it <= target) best = std::max(best, s + *it);
    }

    std::cout << best << '\n';
}
```

## Cases

### Sample
```in
3 9
3 5 7
```
```out
8
```

### an exact hit
```in
3 5
1 2 3
```
```out
5
```

### nothing fits but the empty subset
```in
1 5
10
```
```out
0
```

### a target of zero
```in
3 0
1 2 3
```
```out
0
```

### everything fits
```in
4 100
1 2 3 4
```
```out
10
```

### equal values
```in
2 7
5 5
```
```out
5
```

### powers of two
```in
3 14
2 4 8
```
```out
14
```

### sums beyond 32 bits
```in
4 1000000000000000000
1000000000 1000000000 1000000000 1000000000
```
```out
4000000000
```

## Hints
- Split the items into two halves and enumerate all subset sums of each: 2^18 per half at the worst case, which is 262,144 — nothing.
- Sort one side. For each sum `s` on the other side, you want the largest right-half sum that is at most `target - s`.
- `std::lower_bound(rs, target - s)` finds the first sum that is **not less** than the bound — that is, the first one that may be too big. The candidate you want is normally the element *before* it.
- Check both: `*it` qualifies only on an exact hit, and `*(it - 1)` is the usual answer. Guard each with `it != rs.end()` and `it != rs.begin()`.
- `std::upper_bound(rs, target - s)` followed by stepping back one is the same idea in a single search, and is a little cleaner: everything before it is ≤ the bound.
- Sums reach 36 × 10⁹, and `S` reaches 10¹⁸. Everything is `long long`.

## Solution
```cpp
#include <algorithm>
#include <bit>
#include <iostream>
#include <vector>

std::vector<long long> half_sums(const std::vector<long long>& a, int from, int to) {
    int k = to - from;
    std::vector<long long> sums(std::size_t{1} << k, 0);
    for (unsigned m = 1; m < (1u << k); ++m)
        sums[m] = sums[m & (m - 1)] + a[from + std::countr_zero(m)];
    return sums;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long target;
    std::cin >> n >> target;
    std::vector<long long> a(n);
    for (long long& x : a) std::cin >> x;

    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long best = 0;
    for (long long s : ls) {
        if (s > target) continue;                        // this half alone overshoots
        // Everything before upper_bound is <= target - s; take the last of them.
        auto it = std::upper_bound(rs.begin(), rs.end(), target - s);
        if (it != rs.begin()) best = std::max(best, s + *(it - 1));
    }

    std::cout << best << '\n';
}
```

## Notes
The starter searches correctly and then reads the wrong element.

`lower_bound(v)` returns the first element **not less than** `v`. For "the
largest thing that does not exceed the bound", that element qualifies only when
it equals the bound exactly; otherwise it is one too far and the answer is its
predecessor. The starter never looks at the predecessor, so it only ever finds
sums that hit the target exactly — which is why the sample, whose answer is 8
against a target of 9, comes out as 0.

Two ways to write it, and the second is worth preferring:

```cpp
// A. lower_bound, then check both neighbours
auto it = std::lower_bound(rs.begin(), rs.end(), target - s);
if (it != rs.end()   && s + *it       <= target) best = max(best, s + *it);
if (it != rs.begin() && s + *(it - 1) <= target) best = max(best, s + *(it - 1));

// B. upper_bound, then step back once
auto it = std::upper_bound(rs.begin(), rs.end(), target - s);
if (it != rs.begin()) best = max(best, s + *(it - 1));
```

B has one search, one guard, and no `<= target` re-check, because
`upper_bound(x)` is by definition one past the last element that is `≤ x`. When
the question is "the largest not exceeding", `upper_bound` and a step back is the
idiom; when it is "the smallest not below", `lower_bound` is used directly. Both
appear constantly, and mixing them up is the standard source of off-by-one bugs
in this technique — chapter 10.5 has the general rule.

**Why `if (s > target) continue;`.** With `s` already over the target,
`target - s` is negative and the search finds nothing useful — harmless here, but
if the values could be negative it would be wrong rather than merely wasteful.
Skipping is one comparison and states the precondition.

**The split, and the memory.** `n / 2` with `n = 36` gives halves of 18, so
262,144 sums per side and 2 MB each. At the constraint's edge that is nothing;
chapter 10.15 measures where it stops being nothing, which is around a half of
25.

**Seed `best` at 0, not −1.** The empty subset always achieves 0 and 0 ≤ `S` by
the constraints, so the answer is never negative and the "nothing found"
sentinel would be unreachable. Starting at 0 says that in the code.
