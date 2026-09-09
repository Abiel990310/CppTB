---
id: divide-audit
title: "Three recursions that combine wrongly"
difficulty: core
chapter: divide-and-conquer
topics: [divide-and-conquer, recursion, algorithms]
check: unit
standard: c++20
---

Three divide-and-conquer routines whose split and recursion are right, and whose
**combine** step is not.

- `count_inversions(a)` — pairs `i < j` with `a[i] > a[j]`. Counts one per
  element taken from the right half instead of one per element still waiting in
  the left half.
- `max_subarray(a)` — the largest sum of a non-empty contiguous subarray.
  Starts each crossing scan at 0, so an all-negative array reports 0.
- `power_mod(base, exp, mod)` — `base^exp mod mod`. Squares without reducing, so
  the value escapes 64 bits and wraps.

## Starter
```cpp
#include <algorithm>
#include <climits>
#include <cstddef>
#include <cstdint>
#include <vector>

long long sort_and_count(std::vector<int>& a, std::vector<int>& buf, int lo, int hi) {
    if (hi - lo <= 1) return 0;
    int mid = lo + (hi - lo) / 2;
    long long total = sort_and_count(a, buf, lo, mid) + sort_and_count(a, buf, mid, hi);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        if (a[i] <= a[j]) buf[k++] = a[i++];
        else { total += 1; buf[k++] = a[j++]; }        // one, not "all that remain"
    }
    while (i < mid) buf[k++] = a[i++];
    while (j < hi) buf[k++] = a[j++];
    std::copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
    return total;
}

long long count_inversions(std::vector<int> a) {
    if (a.empty()) return 0;
    std::vector<int> buf(a.size());
    return sort_and_count(a, buf, 0, static_cast<int>(a.size()));
}

long long best_sum(const std::vector<int>& a, int lo, int hi) {
    if (hi - lo == 1) return a[lo];
    int mid = lo + (hi - lo) / 2;
    long long left = best_sum(a, lo, mid);
    long long right = best_sum(a, mid, hi);

    long long run = 0, best_left = 0;              // 0 is not a legal empty half
    for (int i = mid - 1; i >= lo; --i) { run += a[i]; best_left = std::max(best_left, run); }
    run = 0;
    long long best_right = 0;
    for (int i = mid; i < hi; ++i) { run += a[i]; best_right = std::max(best_right, run); }

    return std::max({left, right, best_left + best_right});
}

long long max_subarray(const std::vector<int>& a) {
    return best_sum(a, 0, static_cast<int>(a.size()));
}

std::uint64_t power_mod(std::uint64_t base, std::uint64_t exp, std::uint64_t mod) {
    std::uint64_t result = 1;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base;                        // never reduced
        exp >>= 1;
    }
    return result;
}
```

## Tests
```cpp
// count_inversions
CHECK_EQ(count_inversions({3, 1, 2}), 2LL);
CHECK_EQ(count_inversions({5, 4, 3, 2, 1}), 10LL);
CHECK_EQ(count_inversions({1, 2, 3, 4, 5}), 0LL);
CHECK_EQ(count_inversions({1}), 0LL);
CHECK_EQ(count_inversions({}), 0LL);
CHECK_EQ(count_inversions({2, 2, 2}), 0LL);
CHECK_EQ(count_inversions({1000000000, 1, 1000000000, 1}), 3LL);

// max_subarray
CHECK_EQ(max_subarray({1, -2, 3, 4, -1}), 7LL);
CHECK_EQ(max_subarray({-5, -2, -3}), -2LL);           // every element is negative
CHECK_EQ(max_subarray({-1}), -1LL);
CHECK_EQ(max_subarray({4}), 4LL);
CHECK_EQ(max_subarray({2, -1, 2, -1, 2}), 4LL);
CHECK_EQ(max_subarray({-3, -1, -2, -8}), -1LL);

// power_mod
CHECK_EQ(power_mod(3, 5, 1000000007ULL), 243ULL);
CHECK_EQ(power_mod(2, 100, 1000000007ULL), 976371285ULL);
CHECK_EQ(power_mod(5, 0, 1000000007ULL), 1ULL);
CHECK_EQ(power_mod(123456789, 987654321, 1000000007ULL), 652541198ULL);
CHECK_EQ(power_mod(2, 62, 1000000007ULL), 145586002ULL);
CHECK_EQ(power_mod(999999999, 999999999, 1000000000ULL), 999999999ULL);
```

## Hints
- In the merge, taking `a[j]` from the right half means it is smaller than **every** element still unconsumed in the left half. There are `mid - i` of those, and each one is an inversion.
- `{5, 4, 3, 2, 1}` has 10 inversions; counting one per merge step gives 7.
- `max_subarray` must return a negative number when every element is negative, so the crossing scans cannot start at 0 — a half of the crossing subarray is non-empty by definition. Seed both with `LLONG_MIN` and let the first element set them.
- Equivalently, seed `best_left` with `a[mid - 1]` and `best_right` with `a[mid]` and start the loops one step in. Either works; starting at 0 does not.
- `power_mod` must reduce after **every** multiplication, including the squaring. `base * base` with `base` near 10⁹ is 10¹⁸, and squaring that overflows 64 bits.
- The wrap is silent, because unsigned arithmetic is defined to wrap. It is still the wrong number.

## Solution
```cpp
#include <algorithm>
#include <climits>
#include <cstddef>
#include <cstdint>
#include <vector>

long long sort_and_count(std::vector<int>& a, std::vector<int>& buf, int lo, int hi) {
    if (hi - lo <= 1) return 0;
    int mid = lo + (hi - lo) / 2;
    long long total = sort_and_count(a, buf, lo, mid) + sort_and_count(a, buf, mid, hi);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        if (a[i] <= a[j]) buf[k++] = a[i++];
        else { total += mid - i; buf[k++] = a[j++]; }  // every waiting left element
    }
    while (i < mid) buf[k++] = a[i++];
    while (j < hi) buf[k++] = a[j++];
    std::copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
    return total;
}

long long count_inversions(std::vector<int> a) {
    if (a.empty()) return 0;
    std::vector<int> buf(a.size());
    return sort_and_count(a, buf, 0, static_cast<int>(a.size()));
}

long long best_sum(const std::vector<int>& a, int lo, int hi) {
    if (hi - lo == 1) return a[lo];
    int mid = lo + (hi - lo) / 2;
    long long left = best_sum(a, lo, mid);
    long long right = best_sum(a, mid, hi);

    long long run = 0, best_left = LLONG_MIN;      // each half is non-empty
    for (int i = mid - 1; i >= lo; --i) { run += a[i]; best_left = std::max(best_left, run); }
    run = 0;
    long long best_right = LLONG_MIN;
    for (int i = mid; i < hi; ++i) { run += a[i]; best_right = std::max(best_right, run); }

    return std::max({left, right, best_left + best_right});
}

long long max_subarray(const std::vector<int>& a) {
    return best_sum(a, 0, static_cast<int>(a.size()));
}

std::uint64_t power_mod(std::uint64_t base, std::uint64_t exp, std::uint64_t mod) {
    std::uint64_t result = 1;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;                  // reduce after every multiply
        exp >>= 1;
    }
    return result;
}
```

## Notes
Three combines, three different ways of being nearly right.

**"How many" is not "one".** The merge takes `a[j]` because it is smaller than
`a[i]`; since the left half is sorted, it is smaller than `a[i]`, `a[i+1]`, …,
`a[mid-1]` too, and all of those sit before it in the original array. So one step
of the merge discovers `mid - i` inversions at once, not one. Counting one per
step counts *merge steps where the right side won*, which is a real quantity and
not the one asked for: on `{5, 4, 3, 2, 1}` it gives 7 where the answer is 10.

The property that licenses the count is that both halves are already sorted —
which the recursion has just established. Divide-and-conquer combines are often
like this: the combine is cheap *because* of what the recursion guarantees, and
writing down that guarantee is how you find the right formula.

**An empty half is not allowed.** The crossing subarray must contain `a[mid-1]`
and `a[mid]`, because that is what "crossing" means. Seeding the scans with 0
silently permits an empty half, so the crossing candidate becomes "the best
non-negative thing on each side", which on an all-negative array is 0 — a value
no subarray achieves.

`{-5, -2, -3}` is the smallest case that exposes it, and it is worth noticing
that the bug is invisible whenever any element is positive. Problems that say
"the subarray must be non-empty" are pointing straight at it, and this is also
why `LLONG_MIN` rather than 0 is the right seed for a maximum over a non-empty
set.

**Reduce after every multiply.** `base %= mod` at the top is not enough: the loop
squares `base` repeatedly, and after one unreduced squaring it is around 10¹⁸,
after two it is around 10³⁶, which `std::uint64_t` cannot hold. Unsigned
overflow wraps rather than being undefined, so nothing warns — the arithmetic
just stops meaning what you wanted.

The rule for modular code is mechanical: **every `*` and `+` is immediately
followed by `% mod`**, and the operands are 64-bit. With `mod` up to 10⁹ the
product of two reduced values is at most about 10¹⁸, which is the largest thing
that fits, and that is exactly why the reduction cannot be postponed by even one
step. If `mod` can reach 10¹⁸, ordinary 64-bit multiplication is not enough at
all and you need `__int128` or a mulmod routine.
