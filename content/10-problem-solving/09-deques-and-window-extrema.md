---
title: "Deques and sliding-window extrema"
navTitle: "Monotonic deques"
summary: >-
  A monotonic stack with an expiry date: the maximum of every window, in one
  pass and no logarithms.
objectives:
  - Maintain the maximum of a sliding window in O(1) amortised per step
  - State the two reasons an index leaves a monotonic deque
  - Compare the deque against a multiset and know what the log factor costs
  - Combine two deques to bound a window's spread
  - Use a deque over prefix sums where a window is invalid
status: complete
standard: c++20
requires: [monotonic-stacks]
---

Chapter 10.8's stack answered "what is the nearest bigger element". This chapter
answers "what is the biggest element **in the last k**", which sounds like the
same question and needs one more idea: things can leave the structure not
because a better candidate arrived, but because they got old.

A monotonic deque is a monotonic stack that pops from *both* ends. That is the
entire difference, and `std::deque` exists precisely for it.

## Three ways to take a maximum

```cpp run title="Rescan, multiset, deque"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <deque>
#include <set>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

std::vector<int> naive(const std::vector<int>& a, int k) {
    std::vector<int> out;
    out.reserve(a.size() - k + 1);
    for (std::size_t i = 0; i + k <= a.size(); ++i) {
        int best = a[i];
        for (int j = 1; j < k; ++j) best = std::max(best, a[i + j]);
        out.push_back(best);
    }
    return out;
}

std::vector<int> with_multiset(const std::vector<int>& a, int k) {
    std::vector<int> out;
    std::multiset<int> window;
    for (std::size_t i = 0; i < a.size(); ++i) {
        window.insert(a[i]);
        if (i + 1 > static_cast<std::size_t>(k)) window.erase(window.find(a[i - k]));
        if (i + 1 >= static_cast<std::size_t>(k)) out.push_back(*window.rbegin());
    }
    return out;
}

std::vector<int> with_deque(const std::vector<int>& a, int k) {
    std::vector<int> out;
    std::deque<int> dq;                                   // indices, values decreasing
    for (std::size_t i = 0; i < a.size(); ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();   // never the max again
        dq.push_back(static_cast<int>(i));
        if (dq.front() + k <= static_cast<int>(i)) dq.pop_front();   // fell out of the window
        if (i + 1 >= static_cast<std::size_t>(k)) out.push_back(a[dq.front()]);
    }
    return out;
}

int main() {
    const int n = 150'000, k = 400;
    std::vector<int> a(n);
    for (int i = 0; i < n; ++i) a[i] = static_cast<int>(i * 7919LL % 1000003);

    auto time = [&](auto f) {
        auto start = std::chrono::steady_clock::now();
        std::vector<int> r = f(a, k);
        double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
        keep(r);
        return std::pair<std::vector<int>, double>{r, ms};
    };

    auto [slow, slow_ms] = time(naive);
    auto [mid, mid_ms] = time(with_multiset);
    auto [fast, fast_ms] = time(with_deque);

    std::printf("rescan window %9.1f ms\n", slow_ms);
    std::printf("multiset      %9.1f ms\n", mid_ms);
    std::printf("deque         %9.1f ms\n", fast_ms);
    std::printf("all three agree: %s\n",
                (slow == mid && mid == fast) ? "yes" : "no");
}
```

About 900 ms, 420 ms, and 80 ms on this machine, for identical output.

The middle one is worth dwelling on. `std::multiset` is a perfectly correct
answer — O(n log k) — and it is the one to reach for when the window's contents
change in ways a deque cannot follow. Two things make it five times slower here.
One is the log factor: log₂ 400 is about nine, so each insert and erase does
roughly nine comparisons where the deque does an amortised handful. The other is
that every insert allocates a red-black tree node and every traversal chases
pointers through memory the prefetcher cannot guess, which chapter 7.3 measured
directly. Note that the measured ratio, 5×, is *smaller* than the comparison
ratio of 9× — the deque's own bookkeeping is not free either, and that is the
usual shape of these comparisons: the asymptotic gap sets the direction, not the
number.

## Two ways out

The deque holds **indices**, and their values are decreasing. An index leaves
for exactly one of two reasons:

1. **From the back**, because a new element is at least as large. The old one
   can never be the maximum of any future window: the new one is bigger *and*
   younger, so it survives at least as long.
2. **From the front**, because it fell out of the window. Age, not merit.

```cpp run title="Watching both ends"
#include <cstdio>
#include <deque>
#include <vector>

int main() {
    std::vector<int> a{9, 1, 2, 3, 8, 2, 1, 5};
    const int k = 3;

    std::deque<int> dq;
    int pushes = 0, back_pops = 0, front_pops = 0;

    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) { dq.pop_back(); ++back_pops; }
        dq.push_back(i);
        ++pushes;
        if (dq.front() + k <= i) { dq.pop_front(); ++front_pops; }

        std::printf("i=%d a=%2d  deque:", i, a[i]);
        for (int idx : dq) std::printf(" %d", a[idx]);
        if (i + 1 >= k) std::printf("   max=%d", a[dq.front()]);
        std::printf("\n");
    }
    std::printf("n=%zu  pushes=%d  back pops=%d  front pops=%d\n",
                a.size(), pushes, back_pops, front_pops);
}
```

Eight pushes, five back pops, two front pops — seven removals for eight
insertions, and no index is ever removed twice. That is the amortised argument
again, and it is why the two `while`/`if` lines inside the loop do not make it
quadratic.

Three implementation points the trace makes visible:

- **`<=` and not `<` on the back.** An equal element is younger, so the older
  equal one is redundant. Using `<` keeps duplicates, which is not *wrong* — the
  answer is the same — but the deque grows and the code has to think about
  equality later. Prefer `<=`.
- **One `if`, not a `while`, on the front.** At most one index expires per step,
  because the window advances by one.
- **The front is the answer, always.** No scanning, no comparison. If the front
  is not the maximum of the current window, the invariant has already been
  broken somewhere above.

For the *minimum*, flip the comparison to `>=`. Do not be tempted to negate the
values: it works for `int` but not at the extremes, and the flipped comparison
is the same amount of typing.

## Two deques: bounding the spread

"Longest subarray in which the largest and smallest values differ by at most
`limit`" is a sliding window (10.6) whose validity test needs both extrema at
once. Two deques, one of each kind.

```cpp run title="The longest window whose spread fits"
#include <algorithm>
#include <cstdio>
#include <deque>
#include <random>
#include <vector>

// Longest contiguous subarray whose largest and smallest elements differ by at
// most `limit`. Two deques: one holding the window's maxima, one its minima.
int longest_bounded_spread(const std::vector<int>& a, int limit) {
    std::deque<int> maxq, minq;                  // indices
    int best = 0, lo = 0;

    for (int hi = 0; hi < static_cast<int>(a.size()); ++hi) {
        while (!maxq.empty() && a[maxq.back()] <= a[hi]) maxq.pop_back();
        maxq.push_back(hi);
        while (!minq.empty() && a[minq.back()] >= a[hi]) minq.pop_back();
        minq.push_back(hi);

        // Shrink from the left until the spread fits.
        while (a[maxq.front()] - a[minq.front()] > limit) {
            if (maxq.front() == lo) maxq.pop_front();
            if (minq.front() == lo) minq.pop_front();
            ++lo;
        }
        best = std::max(best, hi - lo + 1);
    }
    return best;
}

int brute(const std::vector<int>& a, int limit) {
    int best = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        int lo = a[i], hi = a[i];
        for (std::size_t j = i; j < a.size(); ++j) {
            lo = std::min(lo, a[j]);
            hi = std::max(hi, a[j]);
            if (hi - lo <= limit) best = std::max(best, static_cast<int>(j - i + 1));
        }
    }
    return best;
}

int main() {
    std::vector<int> a{8, 2, 4, 7, 3, 5, 6};
    for (int limit : {0, 2, 4, 100})
        std::printf("limit %3d -> %d\n", limit, longest_bounded_spread(a, limit));

    std::mt19937 rng(4242);
    bool ok = true;
    int checked = 0;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 12);
        std::vector<int> v(n);
        for (int& x : v) x = static_cast<int>(rng() % 10);
        int limit = static_cast<int>(rng() % 6);
        if (longest_bounded_spread(v, limit) != brute(v, limit)) ok = false;
        ++checked;
    }
    std::printf("%d random arrays checked against brute force: %s\n",
                checked, ok ? "all agree" : "MISMATCH");
}
```

1, 2, 5 and 7 for the four limits, and 3,000 random arrays agree with the
quadratic check.

Notice the shrink loop: `lo` advances one at a time, and each deque's front is
popped only if it *is* `lo`. Writing `maxq.pop_front()` unconditionally would
throw away a maximum that is still inside the window — the deque holds a subset
of the window's indices, not all of them, so `front() == lo` is a question, not
a certainty.

The window here is the one from chapter 10.6, unchanged. What the deques provide
is the validity test, in O(1) instead of a rescan. That composition — window for
the structure, deque for the predicate — covers a large family of problems.

## Where the window will not go: a deque over prefix sums

"Shortest subarray with sum at least `k`" is a sliding window when the values
are positive (10.6 does exactly that). With negative values the sum is no longer
monotone in the window and the technique is invalid — but prefix sums plus a
deque recover it.

For endpoint `i` you want the *largest* `j < i` with `P[i] - P[j] ≥ k`, over all
`j`. Two observations make that a deque:

- If `j₁ < j₂` and `P[j₁] ≥ P[j₂]`, then `j₁` is useless forever: `j₂` gives a
  sum at least as large and a shorter subarray. So the useful prefixes form an
  increasing sequence — a monotonic deque.
- Once the front satisfies `P[i] - P[front] ≥ k`, that is the shortest subarray
  ending at `i` through that front, and no later `i` will want it, because any
  later endpoint gives a longer subarray. Record it and pop it.

```cpp run title="Shortest subarray with sum at least k, negatives allowed"
#include <algorithm>
#include <cstdio>
#include <deque>
#include <random>
#include <vector>

// Shortest contiguous subarray with sum at least k. Values may be NEGATIVE, so
// no sliding window applies -- but a deque over the prefix sums does.
int shortest_at_least(const std::vector<int>& a, long long k) {
    int n = static_cast<int>(a.size());
    std::vector<long long> p(n + 1, 0);
    for (int i = 0; i < n; ++i) p[i + 1] = p[i] + a[i];

    std::deque<int> dq;                       // indices into p, values increasing
    int best = n + 1;

    for (int i = 0; i <= n; ++i) {
        // The front is the smallest prefix so far; if it already reaches k, this
        // is the shortest window ending at i that uses it, and no later endpoint
        // will need it again.
        while (!dq.empty() && p[i] - p[dq.front()] >= k) {
            best = std::min(best, i - dq.front());
            dq.pop_front();
        }
        // Any earlier prefix at least as large as p[i] is useless from now on:
        // p[i] is smaller and closer, so it beats it for every future endpoint.
        while (!dq.empty() && p[dq.back()] >= p[i]) dq.pop_back();
        dq.push_back(i);
    }
    return best == n + 1 ? 0 : best;
}

int brute(const std::vector<int>& a, long long k) {
    int best = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        long long s = 0;
        for (std::size_t j = i; j < a.size(); ++j) {
            s += a[j];
            if (s >= k) {
                int len = static_cast<int>(j - i + 1);
                if (best == 0 || len < best) best = len;
            }
        }
    }
    return best;
}

int main() {
    std::vector<int> a{2, -1, 2, -3, 4, -1, 2};
    for (long long k : {1, 3, 5, 7, 100})
        std::printf("k=%3lld -> %d\n", k, shortest_at_least(a, k));

    std::mt19937 rng(31337);
    bool ok = true;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 10);
        std::vector<int> v(n);
        for (int& x : v) x = static_cast<int>(rng() % 11) - 5;   // -5 .. 5
        long long k = static_cast<long long>(rng() % 9) - 2;     // -2 .. 6
        if (shortest_at_least(v, k) != brute(v, k)) ok = false;
    }
    std::printf("3000 random arrays with negatives: %s\n",
                ok ? "all agree with brute force" : "MISMATCH");
}
```

The order of the two loops in that function is not stylistic, and it cost a
debugging session to find out. Cleaning the back **before** checking the front
pops indices `j` with `P[j] ≥ P[i]` — and when `k ≤ 0`, such a `j` can still
satisfy `P[i] - P[j] ≥ k`, so a valid, possibly shortest, answer is discarded
before it is ever measured. With `k > 0` the two orders agree, which is exactly
why the bug survives casual testing: the random check above includes negative
`k`, and that is what caught it.

Two smaller notes on the same function. The loop runs to `i == n` inclusive
because `P` has `n + 1` entries and the last one is a legitimate endpoint. And
`best` uses `n + 1` as its "impossible" sentinel rather than `0`, because 0 is a
length the caller might otherwise mistake for an answer — it is converted at the
boundary, once.

## Choosing the structure

| The window needs | Use | Cost |
|---|---|---|
| max or min, window slides forward only | monotonic deque | O(1) amortised |
| max and min at once | two deques | O(1) amortised |
| median, k-th largest, arbitrary erasure | `std::multiset` | O(log k), ~5× slower here |
| max over arbitrary ranges, no sliding | sparse table (10.34) | O(1) after O(n log n) |
| max with updates | segment tree (10.32) | O(log n) per operation |

The deque's precondition is the same one two pointers needs: **both ends move
forward only.** If the left end can move backwards, or the window is given as an
arbitrary range rather than a slide, the deque cannot help and one of the last
two rows is the answer.

:::quiz
{
  "question": "In a sliding-window-maximum deque you write the back-cleanup as `while (!dq.empty() && a[dq.back()] < a[i]) dq.pop_back();` — strictly less, so equal elements are kept. What is the consequence?",
  "options": [
    { "text": "The answers stay correct, but the deque holds redundant duplicates and the front-expiry logic has to be right about which copy is oldest", "correct": true, "why": "Equal elements are still non-increasing, so the front is still the maximum. The cost is memory and one more thing to reason about; `<=` drops the older copy, which can never outlive the younger one anyway." },
    { "text": "The maximum comes out wrong whenever the window contains duplicates", "why": "The invariant is that values are non-increasing, and keeping equals preserves it. The front remains a maximum of the window." },
    { "text": "It becomes O(nk), because equal elements are never removed", "why": "They are removed by the front-expiry rule when they age out. Every index is still pushed once and popped at most once." },
    { "text": "It breaks only for the sliding-window minimum, not the maximum", "why": "The two are mirror images; whatever holds for one holds for the other with the comparison flipped." }
  ]
}
:::

## Practice

:::exercise deque-audit

:::exercise window-extrema

:::exercise judge-window-max

:::exercise judge-bounded-spread

:::recap
- A monotonic deque is a monotonic stack that also pops from the front. Indices
  leave for merit (something at least as large arrived) or for age (they fell
  out of the window), and never for anything else.
- The front is the answer, with no scan. If it is not, the invariant broke
  earlier.
- Measured here: 900 ms rescanning, 420 ms with a `std::multiset`, 80 ms with a
  deque, for identical output on 150,000 elements and a window of 400. The
  multiset is correct and reachable; it costs a node allocation per insert.
- One `if` on the front, not a `while`: the window advances by one, so at most
  one index expires per step. Pop the front only when it *is* the departing
  index — the deque holds a subset of the window.
- Two deques give a window both extrema, which turns "spread at most `limit`"
  into an O(1) validity test inside an ordinary sliding window.
- With negative values, a deque over the prefix sums solves "shortest subarray
  with sum at least k". Check the front before cleaning the back, or valid
  answers are discarded when `k ≤ 0`.
:::
