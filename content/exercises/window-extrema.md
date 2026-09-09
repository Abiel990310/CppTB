---
id: window-extrema
title: "Two windows that need a second deque"
difficulty: stretch
chapter: deques-and-window-extrema
topics: [monotonic-deque, sliding-window, prefix-sums, algorithms]
check: unit
standard: c++20
---

Two harder windows. Neither is a plain sliding window, and each fails for a
reason worth meeting once.

- `shortest_at_least(a, k)` — the length of the shortest contiguous subarray
  whose sum is at least `k`, or `0` if there is none. Values may be **negative**
  and `k` may be zero or negative, so this is a deque over prefix sums rather
  than a window. The two cleanup loops are in the wrong order.
- `longest_bounded_spread(a, limit)` — the length of the longest contiguous
  subarray whose largest and smallest elements differ by at most `limit`
  (`limit ≥ 0`). Tracks only the maximum and assumes the newest element is the
  window's minimum.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <deque>
#include <vector>

int shortest_at_least(const std::vector<int>& a, long long k) {
    int n = static_cast<int>(a.size());
    std::vector<long long> p(n + 1, 0);
    for (int i = 0; i < n; ++i) p[i + 1] = p[i] + a[i];

    std::deque<int> dq;                        // indices into p, values increasing
    int best = n + 1;

    for (int i = 0; i <= n; ++i) {
        // Cleaning the back first can discard an index the front check still needs.
        while (!dq.empty() && p[dq.back()] >= p[i]) dq.pop_back();
        while (!dq.empty() && p[i] - p[dq.front()] >= k) {
            best = std::min(best, i - dq.front());
            dq.pop_front();
        }
        dq.push_back(i);
    }
    return best == n + 1 ? 0 : best;
}

int longest_bounded_spread(const std::vector<int>& a, int limit) {
    std::deque<int> maxq;                      // indices, values decreasing
    int best = 0, lo = 0;

    for (int hi = 0; hi < static_cast<int>(a.size()); ++hi) {
        while (!maxq.empty() && a[maxq.back()] <= a[hi]) maxq.pop_back();
        maxq.push_back(hi);

        // Uses a[hi] as if it were the smallest element of the window.
        while (a[maxq.front()] - a[hi] > limit) {
            if (maxq.front() == lo) maxq.pop_front();
            ++lo;
        }
        best = std::max(best, hi - lo + 1);
    }
    return best;
}
```

## Tests
```cpp
std::vector<int> a{2, -1, 2, -3, 4, -1, 2};

// shortest_at_least
CHECK_EQ(shortest_at_least(a, 1), 1);
CHECK_EQ(shortest_at_least(a, 3), 1);          // the 4 alone
CHECK_EQ(shortest_at_least(a, 5), 3);          // 4, -1, 2
CHECK_EQ(shortest_at_least(a, 7), 0);          // no subarray reaches 7
CHECK_EQ(shortest_at_least(a, 100), 0);
CHECK_EQ(shortest_at_least({1, 2, 3}, 6), 3);
CHECK_EQ(shortest_at_least({1, 2, 3}, 7), 0);
CHECK_EQ(shortest_at_least({5}, 5), 1);
CHECK_EQ(shortest_at_least({-1, -2, -3}, -2), 1);   // -1 already reaches -2
CHECK_EQ(shortest_at_least({0, -1}, 0), 1);
CHECK_EQ(shortest_at_least({}, 1), 0);

// longest_bounded_spread
CHECK_EQ(longest_bounded_spread({8, 2, 4, 7, 3, 5, 6}, 0), 1);
CHECK_EQ(longest_bounded_spread({8, 2, 4, 7, 3, 5, 6}, 2), 2);
CHECK_EQ(longest_bounded_spread({8, 2, 4, 7, 3, 5, 6}, 4), 5);
CHECK_EQ(longest_bounded_spread({8, 2, 4, 7, 3, 5, 6}, 100), 7);
CHECK_EQ(longest_bounded_spread({1, 1, 1, 1}, 0), 4);
CHECK_EQ(longest_bounded_spread({1, 5, 1, 5}, 3), 1);
CHECK_EQ(longest_bounded_spread({3, 1, 4, 1, 5, 9, 2, 6}, 3), 4);
CHECK_EQ(longest_bounded_spread({10, 1, 10, 1}, 0), 1);
CHECK_EQ(longest_bounded_spread({1, 2, 3, 4, 5}, 2), 3);
CHECK_EQ(longest_bounded_spread({4}, 0), 1);
CHECK_EQ(longest_bounded_spread({}, 0), 0);
```

## Hints
- `shortest_at_least`: check the front *before* cleaning the back. The back cleanup discards indices `j` with `p[j] ≥ p[i]`, and when `k ≤ 0` such a `j` can still satisfy `p[i] - p[j] ≥ k` — a valid answer thrown away before it was ever measured.
- With `k > 0` both orders agree, which is why this bug survives ordinary testing. `{-1, -2, -3}` with `k = -2` is the smallest case that separates them.
- The rest of `shortest_at_least` is already right, including the `n + 1` sentinel and the loop running to `i == n` inclusive — `p` has `n + 1` entries and the last is a legitimate endpoint.
- `longest_bounded_spread`: the newest element is not the window's minimum in general. `{1, 5, 1, 5}` with `limit = 3` shows it — at `hi = 1` the window's minimum is 1, not 5.
- Add a second deque holding the window's minima, popping the back while `a[minq.back()] >= a[hi]`, and test the spread as `a[maxq.front()] - a[minq.front()]`.
- In the shrink loop, pop each front only if it *is* `lo`. A deque holds a subset of the window's indices, so `front() == lo` is a question, not a certainty — and popping unconditionally empties the deque and reads past its end.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <deque>
#include <vector>

int shortest_at_least(const std::vector<int>& a, long long k) {
    int n = static_cast<int>(a.size());
    std::vector<long long> p(n + 1, 0);
    for (int i = 0; i < n; ++i) p[i + 1] = p[i] + a[i];

    std::deque<int> dq;
    int best = n + 1;

    for (int i = 0; i <= n; ++i) {
        // Front first: record and retire any prefix that already reaches k.
        while (!dq.empty() && p[i] - p[dq.front()] >= k) {
            best = std::min(best, i - dq.front());
            dq.pop_front();
        }
        // Then drop prefixes that p[i] beats: it is smaller and closer.
        while (!dq.empty() && p[dq.back()] >= p[i]) dq.pop_back();
        dq.push_back(i);
    }
    return best == n + 1 ? 0 : best;
}

int longest_bounded_spread(const std::vector<int>& a, int limit) {
    std::deque<int> maxq, minq;                // indices
    int best = 0, lo = 0;

    for (int hi = 0; hi < static_cast<int>(a.size()); ++hi) {
        while (!maxq.empty() && a[maxq.back()] <= a[hi]) maxq.pop_back();
        maxq.push_back(hi);
        while (!minq.empty() && a[minq.back()] >= a[hi]) minq.pop_back();
        minq.push_back(hi);

        while (a[maxq.front()] - a[minq.front()] > limit) {
            if (maxq.front() == lo) maxq.pop_front();
            if (minq.front() == lo) minq.pop_front();
            ++lo;
        }
        best = std::max(best, hi - lo + 1);
    }
    return best;
}
```

## Notes
**The order of two loops.** `shortest_at_least` is one of those functions where
both cleanup loops are individually correct and the sequence is not. Cleaning
the back removes every index `j` with `p[j] ≥ p[i]`, on the grounds that `p[i]`
is smaller and closer and therefore better for every future endpoint. True — but
`i` is not only a future endpoint's start, it is *this* endpoint. If `k ≤ 0`, a
`j` with `p[j] ≥ p[i]` can still satisfy `p[i] - p[j] ≥ k`, and the subarray
`(j, i]` is a legitimate answer that was deleted a line before it would have
been measured.

With `k > 0` the two orders give identical results, because `p[j] ≥ p[i]` forces
`p[i] - p[j] ≤ 0 < k`. So the bug is invisible on every "sum at least 7" test
anyone writes by hand, and appears the moment a setter includes `k ≤ 0`. Tests
`{-1, -2, -3}` with `k = -2` and `{0, -1}` with `k = 0` exist for exactly this,
and the correct answer to both is 1 while the starter says 0.

The general lesson is worth more than the fix: when two cleanup passes operate
on the same structure, ask whether either can delete what the other is about to
read. If it can, the order is part of the algorithm, not a matter of taste.

**One deque is not enough for two questions.** `longest_bounded_spread` needs
the window's maximum *and* its minimum, and `a[hi]` is neither in general — it
is merely the newest. On `{1, 5, 1, 5}` with `limit = 3` the starter reports 2,
believing the window `{1, 5}` has spread `5 - 5 = 0`. The fix is a second deque,
maintained identically with the comparison flipped.

Two details in the shrink loop that are easy to get wrong:

- **Pop the front only when it is `lo`.** Each deque holds a subset of the
  window's indices — the ones not yet beaten — so the element leaving the window
  may not be at the front at all. Popping unconditionally drains the deque and
  then reads `front()` on an empty one, which is undefined behaviour that
  usually presents as a segfault rather than an exception.
- **Test the two conditions separately.** `maxq.front() == lo` and
  `minq.front() == lo` can be true together (a one-element window), or one at a
  time, so they are two `if`s and not an `if`/`else`.

The window itself is the ordinary sliding window from chapter 10.6, with `lo`
and `hi` moving forward only. The deques change nothing about the window; they
supply its validity test in O(1) rather than by rescanning, which is the shape
worth carrying away: **window for the structure, deque for the predicate.**
