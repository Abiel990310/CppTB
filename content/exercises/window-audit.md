---
id: window-audit
title: "Three windows that slip"
difficulty: core
chapter: two-pointers
topics: [two-pointers, sliding-window, algorithms]
check: unit
standard: c++20
---

Three sliding windows over an array of **positive** integers. Each has a bug in
where it shrinks, what it records, or how far it moves.

- `longest_at_most(a, limit)` — the length of the longest contiguous subarray
  whose sum is at most `limit`. Resets the left index every iteration, which
  makes it quadratic and wrong.
- `shortest_at_least(a, target)` — the length of the shortest contiguous
  subarray whose sum is at least `target`, or `0` if none exists. Records the
  answer in the wrong place.
- `count_at_most(a, limit)` — how many contiguous subarrays have sum at most
  `limit`. Counts one per window instead of one per ending position.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

int longest_at_most(const std::vector<int>& a, long long limit) {
    int best = 0;
    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        long long sum = 0;
        std::size_t lo = 0;                       // reset every time
        for (std::size_t k = lo; k <= hi; ++k) sum += a[k];
        while (sum > limit) { sum -= a[lo]; ++lo; }
        best = std::max(best, static_cast<int>(hi - lo + 1));
    }
    return best;
}

int shortest_at_least(const std::vector<int>& a, long long target) {
    int best = 0;
    long long sum = 0;
    std::size_t lo = 0;
    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        sum += a[hi];
        // Records before shrinking, so it never sees the shortest window.
        if (sum >= target) best = static_cast<int>(hi - lo + 1);
        while (sum >= target) { sum -= a[lo]; ++lo; }
    }
    return best;
}

long long count_at_most(const std::vector<int>& a, long long limit) {
    long long total = 0;
    long long sum = 0;
    std::size_t lo = 0;
    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        sum += a[hi];
        while (sum > limit) { sum -= a[lo]; ++lo; }
        total += 1;                               // one per window, not per subarray
    }
    return total;
}
```

## Tests
```cpp
std::vector<int> a{2, 1, 5, 1, 3, 2};

// longest_at_most
CHECK_EQ(longest_at_most(a, 8), 3);        // 1 5 1 sums to 7
CHECK_EQ(longest_at_most(a, 3), 2);        // 2 1
CHECK_EQ(longest_at_most(a, 1), 1);        // a single 1
CHECK_EQ(longest_at_most(a, 0), 0);        // every value exceeds 0
CHECK_EQ(longest_at_most(a, 100), 6);      // all of it
CHECK_EQ(longest_at_most({}, 5), 0);
CHECK_EQ(longest_at_most({7}, 7), 1);
CHECK_EQ(longest_at_most({7}, 6), 0);

// shortest_at_least
CHECK_EQ(shortest_at_least(a, 7), 3);      // no window of length 2 reaches 7
CHECK_EQ(shortest_at_least(a, 5), 1);      // the 5 alone
CHECK_EQ(shortest_at_least(a, 14), 6);     // the whole array sums to 14
CHECK_EQ(shortest_at_least(a, 15), 0);     // impossible
CHECK_EQ(shortest_at_least(a, 1), 1);
CHECK_EQ(shortest_at_least({}, 1), 0);
CHECK_EQ(shortest_at_least({4}, 4), 1);

// count_at_most
CHECK_EQ(count_at_most({1, 2, 3}, 3), 4LL);        // [1] [2] [3] [1,2]
CHECK_EQ(count_at_most({1, 2, 3}, 0), 0LL);
CHECK_EQ(count_at_most({1, 2, 3}, 100), 6LL);      // every subarray
CHECK_EQ(count_at_most({}, 5), 0LL);
CHECK_EQ(count_at_most({5}, 5), 1LL);
CHECK_EQ(count_at_most({5}, 4), 0LL);
CHECK_EQ(count_at_most(a, 3), 6LL);
```

## Hints
- `longest_at_most` recomputes the sum and resets `lo` on every outer step. Hoist both out of the loop: `lo` and `sum` are the window's state and must persist across iterations. That is the entire technique.
- `shortest_at_least` records the length *before* shrinking, so it measures the window at its largest rather than its smallest. Record inside the shrinking loop, just before each removal, while the window is still valid.
- Careful with the order: `while (sum >= target) { best = min(best, hi - lo + 1); sum -= a[lo]; ++lo; }` measures each valid window exactly once.
- `shortest_at_least` must return 0 when no window ever reaches the target, so seed `best` with something that means "none" and convert at the end — or track a sentinel and check it.
- `count_at_most` should add the number of valid subarrays *ending at* `hi`, which after shrinking is `hi - lo + 1` — every start from `lo` to `hi` gives a valid subarray, because shrinking already removed the invalid ones.
- The count can exceed 2 × 10⁹ for a large array, which is why it returns `long long`.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

int longest_at_most(const std::vector<int>& a, long long limit) {
    int best = 0;
    long long sum = 0;
    std::size_t lo = 0;                            // state, not a local
    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        sum += a[hi];
        while (sum > limit && lo <= hi) { sum -= a[lo]; ++lo; }
        best = std::max(best, static_cast<int>(hi - lo + 1));
    }
    return best;
}

int shortest_at_least(const std::vector<int>& a, long long target) {
    int best = -1;
    long long sum = 0;
    std::size_t lo = 0;
    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        sum += a[hi];
        // Measure each valid window before shrinking past it.
        while (sum >= target) {
            int length = static_cast<int>(hi - lo + 1);
            if (best < 0 || length < best) best = length;
            sum -= a[lo];
            ++lo;
        }
    }
    return best < 0 ? 0 : best;
}

long long count_at_most(const std::vector<int>& a, long long limit) {
    long long total = 0;
    long long sum = 0;
    std::size_t lo = 0;
    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        sum += a[hi];
        while (sum > limit && lo <= hi) { sum -= a[lo]; ++lo; }
        // Every start in [lo, hi] gives a valid subarray ending at hi.
        total += static_cast<long long>(hi - lo + 1);
    }
    return total;
}
```

## Notes
Three bugs, one per decision the window shape asks you to make.

**`longest_at_most` reset the state.** `lo` and `sum` *are* the window; resetting
them each iteration turns the technique back into the quadratic scan it was meant
to replace, and — because the inner recomputation starts from index 0 rather than
from `lo` — it also gets the answer wrong. This is the most common way to write
a sliding window that is not one: the code has two indices and a `while`, and
none of the linear argument applies, because `lo` no longer moves monotonically.

**`shortest_at_least` recorded in the wrong place.** For a *longest* window you
record after restoring validity, when the window is as large as it can be. For a
*shortest* one you record while shrinking, just before removing an element,
because that is when the window is as small as it can be while still valid. Same
loop, opposite moment — and the check with target 5 catches it, since the single
element `5` is a valid window of length 1 that the starter never measures.

**`count_at_most` counted windows instead of subarrays.** After shrinking, every
start position from `lo` to `hi` gives a valid subarray ending at `hi` — because
sums are monotone in the window and the invalid prefixes have already been
removed — so the number to add is `hi - lo + 1`, not 1. Summing over all `hi`
counts each subarray exactly once, by its right endpoint. That "count by
endpoint" trick is worth keeping: it turns a great many counting problems into a
single window pass.

The `lo <= hi` guard in the two shrinking loops is what handles a single element
larger than the limit. Without it, `lo` can run past `hi`, `hi - lo + 1`
underflows through `std::size_t`, and the length becomes enormous — the
`longest_at_most({7}, 6)` case is exactly that, and it would return a huge
number rather than 0.
