---
title: "Meet in the middle"
navTitle: "Meet in the middle"
summary: >-
  Split the input in half, enumerate both halves, and let the two lists find
  each other — 2^n becomes 2^(n/2), and n = 40 becomes possible.
objectives:
  - Recognise the n around 40 constraint as a meet-in-the-middle signal
  - Enumerate half the input and combine with sorting or hashing
  - Choose between binary search, two pointers, and a hash map for the combine
  - Judge when the memory cost makes the technique unavailable
status: complete
standard: c++20
requires: [divide-and-conquer]
---

Chapter 10.12's table put `n ≤ 20` next to 2ⁿ ≈ 10⁶ and `n ≤ 40` next to 2ⁿ ≈
10¹². The second is out of reach and the first is trivial, and the gap between
them is exactly one idea: enumerate each half separately and combine.

`2^40` is a trillion. `2 × 2^20` is two million. The saving is not a constant
factor.

## The shape

Split the items into two halves. Enumerate all subsets of each half — 2^(n/2)
of them, which is affordable — and then find the pairs, one from each side, that
together answer the question.

```cpp run title="Splitting 36 items as evenly as possible"
#include <algorithm>
#include <bit>
#include <chrono>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Every subset sum of a list, as a vector indexed by mask.
std::vector<long long> all_subset_sums(const std::vector<long long>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> sums(std::size_t{1} << n, 0);
    for (unsigned m = 1; m < (1u << n); ++m) {
        int low = std::countr_zero(m);
        sums[m] = sums[m & (m - 1)] + a[low];
    }
    return sums;
}

int main() {
    const int n = 36;
    std::vector<long long> a(n);
    std::mt19937_64 rng(99);
    for (long long& x : a) x = 1 + static_cast<long long>(rng() % 1'000'000'000ULL);

    long long total = 0;
    for (long long x : a) total += x;
    const long long target = total / 2;                 // split the set as evenly as possible

    std::vector<long long> left(a.begin(), a.begin() + n / 2);
    std::vector<long long> right(a.begin() + n / 2, a.end());

    auto t0 = std::chrono::steady_clock::now();
    std::vector<long long> ls = all_subset_sums(left);
    std::vector<long long> rs = all_subset_sums(right);
    std::sort(rs.begin(), rs.end());
    auto t1 = std::chrono::steady_clock::now();

    long long best = -1;
    for (long long s : ls) {
        long long want = target - s;
        auto it = std::lower_bound(rs.begin(), rs.end(), want);
        if (it != rs.end()) best = std::max(best, s + *it <= target ? s + *it : best);
        if (it != rs.begin()) { long long v = *(it - 1); if (s + v <= target) best = std::max(best, s + v); }
    }
    auto t2 = std::chrono::steady_clock::now();

    keep(best);
    std::printf("n = %d, halves of %d -> %zu sums each\n", n, n / 2, ls.size());
    std::printf("  build and sort %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count());
    std::printf("  search         %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count());
    std::printf("  half the total is %lld; the best subset sum not exceeding it is %lld\n",
                target, best);
    std::printf("  so the two halves differ by %lld out of %lld\n",
                total - 2 * best, total);
    std::printf("  subsets examined: 2 x %zu = %zu, against 2^%d = %lld for brute force\n",
                ls.size(), 2 * ls.size(), n, 1LL << n);
}
```

Under a second, and it finds a split of 36 nine-digit numbers differing by 1 out
of 18,690,345,153. Full enumeration would have visited 68,719,476,736 subsets.

Three parts, and each of them matters:

- **Build.** `sums[m] = sums[m & (m-1)] + a[countr_zero(m)]` is chapter 10.12's
  O(2^k) construction. Building each sum with an inner loop over the bits would
  make this step `k` times slower for no reason.
- **Sort one side.** Only one — the side you will search. The other is scanned
  once.
- **Combine.** For each left sum, find the right sums that complete it. Here
  that is a `lower_bound` and its predecessor, because "as close as possible
  without exceeding" needs both neighbours.

The `lower_bound` returning `rs.end()` and `rs.begin()` are both real cases, and
they are why the two candidate checks are guarded separately rather than with an
`if`/`else`. A combine step that indexes an iterator without checking it is the
usual way this technique produces a crash instead of an answer.

## The combine is the whole design

Meet in the middle is not one algorithm; it is a family, and what changes is how
the two lists are matched.

| The question | Combine with | Cost |
|---|---|---|
| Is there a pair summing to exactly `S`? | hash set on one side | O(2^(n/2)) |
| How many pairs sum to exactly `S`? | hash map with counts | O(2^(n/2)) |
| Closest sum to `S` without exceeding | sort + `lower_bound` | O(2^(n/2) · n) |
| How many pairs sum into `[lo, hi]`? | sort + two `lower_bound`s | O(2^(n/2) · n) |
| Best pair under a constraint on one side | sort + prefix maxima | O(2^(n/2) · n) |

The hash map version is the one to reach for when the question is "exactly", and
it generalises past subsets. The classic case has four separate lists rather
than one set split in two.

```cpp run title="Quadruples summing to zero, from four lists"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <random>
#include <unordered_map>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

long long brute(const std::vector<int>& A, const std::vector<int>& B,
                const std::vector<int>& C, const std::vector<int>& D) {
    long long count = 0;
    for (int a : A) for (int b : B) for (int c : C) for (int d : D)
        if (a + b + c + d == 0) ++count;
    return count;
}

long long meet(const std::vector<int>& A, const std::vector<int>& B,
               const std::vector<int>& C, const std::vector<int>& D) {
    std::unordered_map<int, int> left;
    left.reserve(A.size() * B.size() * 2);
    for (int a : A) for (int b : B) ++left[a + b];

    long long count = 0;
    for (int c : C) for (int d : D) {
        auto it = left.find(-(c + d));
        if (it != left.end()) count += it->second;
    }
    return count;
}

int main() {
    const int n = 60;
    std::mt19937 rng(3);
    auto make = [&] {
        std::vector<int> v(n);
        for (int& x : v) x = static_cast<int>(rng() % 2001) - 1000;
        return v;
    };
    std::vector<int> A = make(), B = make(), C = make(), D = make();

    auto t0 = std::chrono::steady_clock::now();
    long long r1 = brute(A, B, C, D);
    auto t1 = std::chrono::steady_clock::now();
    long long r2 = meet(A, B, C, D);
    auto t2 = std::chrono::steady_clock::now();

    keep(r1); keep(r2);
    std::printf("n = %d per list\n", n);
    std::printf("  four nested loops %8.1f ms  (%lld combinations)\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(),
                static_cast<long long>(n) * n * n * n);
    std::printf("  meet in the middle %7.1f ms  (2 x %lld pairs)\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count(),
                static_cast<long long>(n) * n);
    std::printf("  both count %lld quadruples: %s\n", r1, r1 == r2 ? "agreed" : "MISMATCH");
}
```

329 ms against 5.5 ms at `n = 60`, for the same 4,164 quadruples — and the gap
is `n²`, so at `n = 1000` it is the difference between 10¹² and 10⁶.

Note `count += it->second` rather than `++count`: the map holds *how many* pairs
made each sum, and forgetting that turns a count into a "does one exist". That
is the most common bug in this pattern, and it only shows up when two different
pairs share a sum — which, in random data, is immediately.

## Counting, and cross-checking

A combine that counts a *range* rather than a point needs the sorted side and
two binary searches. It is also the version worth cross-checking hardest,
because two off-by-ones can cancel on small inputs.

```cpp run title="How many subsets land in a window"
#include <algorithm>
#include <bit>
#include <chrono>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

std::vector<long long> all_subset_sums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> sums(std::size_t{1} << n, 0);
    for (unsigned m = 1; m < (1u << n); ++m)
        sums[m] = sums[m & (m - 1)] + a[std::countr_zero(m)];
    return sums;
}

// How many subsets have a sum in [lo, hi]?
long long count_in_range(const std::vector<int>& a, long long lo, long long hi) {
    int n = static_cast<int>(a.size());
    std::vector<int> left(a.begin(), a.begin() + n / 2);
    std::vector<int> right(a.begin() + n / 2, a.end());

    std::vector<long long> ls = all_subset_sums(left);
    std::vector<long long> rs = all_subset_sums(right);
    std::sort(rs.begin(), rs.end());

    long long total = 0;
    for (long long s : ls) {
        auto first = std::lower_bound(rs.begin(), rs.end(), lo - s);
        auto last = std::upper_bound(rs.begin(), rs.end(), hi - s);
        total += last - first;
    }
    return total;
}

long long brute(const std::vector<int>& a, long long lo, long long hi) {
    int n = static_cast<int>(a.size());
    long long total = 0;
    for (unsigned m = 0; m < (1u << n); ++m) {
        long long s = 0;
        for (int i = 0; i < n; ++i) if (m >> i & 1) s += a[i];
        if (s >= lo && s <= hi) ++total;
    }
    return total;
}

int main() {
    std::mt19937 rng(17);
    bool ok = true;
    for (int trial = 0; trial < 500; ++trial) {
        int n = 2 + static_cast<int>(rng() % 11);
        std::vector<int> v(n);
        for (int& x : v) x = static_cast<int>(rng() % 41) - 20;
        long long lo = static_cast<long long>(rng() % 41) - 20;
        long long hi = lo + static_cast<long long>(rng() % 30);
        if (count_in_range(v, lo, hi) != brute(v, lo, hi)) ok = false;
    }
    std::printf("500 random sets cross-checked against full enumeration: %s\n",
                ok ? "all agree" : "MISMATCH");

    const int n = 34;
    std::vector<int> a(n);
    for (int& x : a) x = 1 + static_cast<int>(rng() % 1000);
    auto t0 = std::chrono::steady_clock::now();
    long long c = count_in_range(a, 8000, 8100);
    auto t1 = std::chrono::steady_clock::now();
    keep(c);
    std::printf("n = %d: %lld subsets sum into [8000, 8100], found in %.1f ms\n",
                n, c, std::chrono::duration<double, std::milli>(t1 - t0).count());
    std::printf("full enumeration would have visited %lld subsets\n", 1LL << n);
}
```

500 random sets agree with full enumeration, and then 298,945,488 subsets of a
34-element set are counted in half a second, where enumerating them would take
17 billion steps.

`lower_bound` for the low end and `upper_bound` for the high end is what makes
the range inclusive on both sides: `lower_bound(lo - s)` is the first element
not less than the low bound, and `upper_bound(hi - s)` is the first strictly
greater than the high bound. Mixing them up gives a range that is off by the
number of *ties*, so it is correct on distinct values and wrong on repeated
ones — precisely the bug the 500-trial cross-check exists to catch.

Note that the split is `n / 2`, which for odd `n` puts the extra element in the
right half. That is deliberate: the right half is the one that gets sorted, and
`n / 2` rounding down keeps the *left* loop — which runs once per left subset —
as short as possible. It is a small thing and it is free.

## The wall

The technique costs memory proportional to `2^(n/2)`, and that is where it stops.

```cpp run title="Doubling, four times"
#include <algorithm>
#include <bit>
#include <chrono>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    std::mt19937_64 rng(2);
    std::printf(" half   sums     bytes    build+sort\n");
    for (int k : {13, 15, 17, 19}) {
        std::vector<long long> a(k);
        for (long long& x : a) x = 1 + static_cast<long long>(rng() % 1'000'000'000ULL);

        auto t0 = std::chrono::steady_clock::now();
        std::vector<long long> sums(std::size_t{1} << k, 0);
        for (unsigned m = 1; m < (1u << k); ++m)
            sums[m] = sums[m & (m - 1)] + a[std::countr_zero(m)];
        std::sort(sums.begin(), sums.end());
        double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - t0).count();

        keep(sums);
        std::printf("  %2d  %7zu  %8zu KB  %8.1f ms\n",
                    k, sums.size(), sums.size() * sizeof(long long) / 1024, ms);
    }
    std::printf("\nEach extra element in the half doubles both columns.\n");
    std::printf("A half of 25 would need %zu MB and a half of 30, %zu MB.\n",
                (std::size_t{1} << 25) * sizeof(long long) / (1024 * 1024),
                (std::size_t{1} << 30) * sizeof(long long) / (1024 * 1024));
}
```

64 KB, 256 KB, 1 MB, 4 MB — and 12 ms, 50 ms, 257 ms, 1012 ms. Both columns
double with each element, exactly as promised.

The practical consequence, with a typical 256 MB memory limit:

- **`n ≤ 40`** — halves of 20, one million sums, 8 MB. Comfortable.
- **`n ≤ 46`** — halves of 23, eight million sums, 64 MB. Tight but possible,
  and the sort is a second or two.
- **`n ≤ 50`** — halves of 25, 256 MB for one side alone. Over the limit.

So "meet in the middle" is a technique for `n` in the thirties and forties, and
the constraint in the statement will say so. Above that the problem wants
something else: a dynamic program over the *sum* rather than the items (chapter
10.27), if the sums are small; or a structural insight the setter has in mind.

Two ways to buy a little room when you are near the wall:

- **Store 32-bit values** where the range allows it, halving the memory.
- **Do not store the left side at all.** Only the searched side needs to be
  materialised; the other can be generated and consumed in the same loop, as the
  first sample does. That halves the peak memory for free.

:::quiz
{
  "question": "A problem gives n ≤ 40 items and asks for the number of subsets whose sum is exactly S, with values up to 10^9. Why is meet in the middle the intended solution rather than a dynamic program over the sum?",
  "options": [
    { "text": "The DP's table is indexed by the sum, which reaches 4·10^10 here — far too large — while meet in the middle depends only on n, giving about a million sums per half", "correct": true, "why": "Subset-sum DP costs O(n · S) time and O(S) memory. It is the right answer when S is small and impossible when the values are large. Meet in the middle is indifferent to the magnitudes and cares only about 2^(n/2)." },
    { "text": "Dynamic programming cannot count subsets, only decide whether one exists", "why": "Counting DP for subset sum is standard — the table holds counts instead of booleans. The obstacle here is the size of the sum, not the kind of question." },
    { "text": "Meet in the middle is always faster than dynamic programming", "why": "With n = 40 and values up to 100, the DP table has 4,000 entries and is far faster. Which technique wins depends entirely on which of n and S is small." },
    { "text": "n = 40 is too small for dynamic programming to be worth setting up", "why": "n is not what makes the DP expensive; S is. The same n with small values makes the DP the easy solution." }
  ]
}
:::

## Practice

:::exercise meet-audit

:::exercise split-and-search

:::exercise judge-closest-subset-sum

:::exercise judge-four-sum

:::recap
- Enumerating each half separately turns 2ⁿ into 2 × 2^(n/2). At n = 36 that is
  524,288 subsets instead of 68,719,476,736, and the whole search took under a
  second.
- Build the half-sums with `sums[m] = sums[m & (m-1)] + a[countr_zero(m)]`; sort
  only the side you will search.
- The combine step is the design decision: a hash map for "exactly", a
  `lower_bound` for "closest", a pair of them for "in this range". Count the
  *multiplicity* stored in the map, not the presence.
- `lower_bound` for the low end and `upper_bound` for the high end make an
  inclusive range; swapping them is wrong only when values repeat, so
  cross-check against full enumeration on small random inputs.
- Memory is `2^(n/2)` and doubles per element: measured 64 KB, 256 KB, 1 MB and
  4 MB for halves of 13, 15, 17 and 19. A half of 25 needs 256 MB, which is
  where the technique stops.
- `n ≤ 40` in a statement is the signal. If instead the *sums* are small, the
  answer is a dynamic program over the sum.
:::
