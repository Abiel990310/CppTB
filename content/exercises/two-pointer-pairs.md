---
id: two-pointer-pairs
title: "Pairs, from both ends"
difficulty: stretch
chapter: two-pointers
topics: [two-pointers, sorting, counting]
check: unit
standard: c++20
---

Three questions about pairs of values, each answerable in one pass over a sorted
copy with two indices converging from the ends. All three stubs return nothing
useful.

- `count_pairs(values, target)` — how many **unordered pairs of positions**
  `i < j` have `values[i] + values[j] == target`. Duplicates count separately:
  `{1, 1, 1, 1}` with target 2 has six pairs.
- `closest_sum(values, target)` — the pair sum closest to `target`; on a tie the
  smaller sum. Returns `std::nullopt` when there are fewer than two values.
- `count_below(values, limit)` — how many pairs of positions have a sum
  **strictly less than** `limit`.

You may sort a copy. The originals must not change.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <optional>
#include <vector>

long long count_pairs(const std::vector<int>& values, long long target) {
    return 0;
}

std::optional<long long> closest_sum(const std::vector<int>& values, long long target) {
    return std::nullopt;
}

long long count_below(const std::vector<int>& values, long long limit) {
    return 0;
}
```

## Tests
```cpp
// count_pairs
CHECK_EQ(count_pairs({1, 3, 4, 6, 8, 11}, 7), 2LL);      // 1+6, 3+4
CHECK_EQ(count_pairs({1, 1, 1, 1}, 2), 6LL);             // every pair
CHECK_EQ(count_pairs({1, 2, 3, 4, 5}, 6), 2LL);          // 1+5, 2+4
CHECK_EQ(count_pairs({2, 2, 3, 3}, 5), 4LL);             // each 2 with each 3
CHECK_EQ(count_pairs({0, 0, 0}, 0), 3LL);
CHECK_EQ(count_pairs({5}, 5), 0LL);                      // no pair exists
CHECK_EQ(count_pairs({}, 3), 0LL);
CHECK_EQ(count_pairs({1, 2}, 100), 0LL);

// The caller's vector must be untouched.
{
    std::vector<int> v{5, 1, 4};
    (void)count_pairs(v, 6);
    CHECK_EQ(v[0], 5);
    CHECK_EQ(v[2], 4);
}

// closest_sum
CHECK_EQ(closest_sum({1, 3, 4, 6, 8, 11}, 7).value(), 7LL);    // exact
CHECK_EQ(closest_sum({1, 3, 4, 6, 8, 11}, 10).value(), 10LL);  // 4+6
CHECK_EQ(closest_sum({1, 2}, 100).value(), 3LL);               // only one pair
CHECK_EQ(closest_sum({1, 2}, -5).value(), 3LL);
CHECK_EQ(closest_sum({5, 5}, 10).value(), 10LL);
CHECK(!closest_sum({7}, 7).has_value());
CHECK(!closest_sum({}, 0).has_value());

// count_below
CHECK_EQ(count_below({1, 2, 3, 4}, 5), 2LL);             // 1+2 = 3 and 1+3 = 4
CHECK_EQ(count_below({1, 1, 1}, 3), 3LL);
CHECK_EQ(count_below({1, 1, 1}, 2), 0LL);
CHECK_EQ(count_below({}, 10), 0LL);
CHECK_EQ(count_below({4}, 10), 0LL);
CHECK_EQ(count_below({-5, 0, 5}, 1), 2LL);
```

## Hints
- Sort a copy first. Every one of these needs order, and none of them may disturb the caller's vector.
- `closest_sum` and `count_below` are the straightforward converging loops. `closest_sum` records at every step and then moves the index that can improve the sum; `count_below` adds `hi - lo` when the sum is below the limit, because every index between `lo` and `hi` also pairs with `lo` to give something smaller.
- `count_pairs` is the fiddly one, because duplicates have to be counted correctly. When `sorted[lo] + sorted[hi] == target` there are three cases.
- If `sorted[lo] == sorted[hi]`, every element in `[lo, hi]` equals the same value, and the pairs among `k = hi - lo + 1` of them number `k * (k - 1) / 2`. Add that and stop.
- Otherwise count how many copies of `sorted[lo]` there are at the left end and how many of `sorted[hi]` at the right, multiply them, and move both indices past their runs.
- Every count can exceed 2 × 10⁹ for a large input — `{1,1,…,1}` of length 100000 with target 2 has about 5 × 10⁹ pairs — so accumulate in `long long`.
- `count_below`'s `hi - lo` is a count of *positions*, and works whether or not there are duplicates: no special handling is needed.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <optional>
#include <vector>

long long count_pairs(const std::vector<int>& values, long long target) {
    std::vector<int> sorted = values;
    std::sort(sorted.begin(), sorted.end());

    long long pairs = 0;
    std::size_t lo = 0;
    std::size_t hi = sorted.empty() ? 0 : sorted.size() - 1;

    while (lo < hi) {
        long long sum = static_cast<long long>(sorted[lo]) + sorted[hi];
        if (sum < target) { ++lo; continue; }
        if (sum > target) { --hi; continue; }

        if (sorted[lo] == sorted[hi]) {
            // Everything between them is the same value: count pairs among k.
            long long k = static_cast<long long>(hi - lo + 1);
            pairs += k * (k - 1) / 2;
            break;
        }

        std::size_t left = lo;
        while (left < hi && sorted[left] == sorted[lo]) ++left;
        std::size_t right = hi;
        while (right > lo && sorted[right] == sorted[hi]) --right;

        pairs += static_cast<long long>(left - lo) * static_cast<long long>(hi - right);
        lo = left;
        hi = right;
    }
    return pairs;
}

std::optional<long long> closest_sum(const std::vector<int>& values, long long target) {
    if (values.size() < 2) return std::nullopt;

    std::vector<int> sorted = values;
    std::sort(sorted.begin(), sorted.end());

    std::size_t lo = 0;
    std::size_t hi = sorted.size() - 1;
    long long best = static_cast<long long>(sorted[lo]) + sorted[hi];

    while (lo < hi) {
        long long sum = static_cast<long long>(sorted[lo]) + sorted[hi];
        long long gap = sum > target ? sum - target : target - sum;
        long long best_gap = best > target ? best - target : target - best;
        if (gap < best_gap || (gap == best_gap && sum < best)) best = sum;

        if (sum == target) return sum;
        if (sum < target) ++lo;
        else              --hi;
    }
    return best;
}

long long count_below(const std::vector<int>& values, long long limit) {
    std::vector<int> sorted = values;
    std::sort(sorted.begin(), sorted.end());

    long long pairs = 0;
    std::size_t lo = 0;
    std::size_t hi = sorted.empty() ? 0 : sorted.size() - 1;

    while (lo < hi) {
        long long sum = static_cast<long long>(sorted[lo]) + sorted[hi];
        if (sum < limit) {
            // sorted[lo] pairs with every index in (lo, hi] to give something
            // no larger than this sum, so all of them are below the limit.
            pairs += static_cast<long long>(hi - lo);
            ++lo;
        } else {
            --hi;
        }
    }
    return pairs;
}
```

## Notes
`count_below` is the one to understand first, because its counting step is the
whole reason two pointers beat a nested loop here. When `sorted[lo] + sorted[hi]`
is below the limit, *every* index from `lo + 1` to `hi` pairs with `lo` to give a
sum no larger — the array is sorted, so those partners are all at most
`sorted[hi]`. That is `hi - lo` pairs counted in one step, and then `lo` can
advance for good. Counting a whole block per step rather than one pair is what
turns O(n²) into O(n).

`closest_sum` shows the other half of the converging argument. At every step the
sum is either too small — in which case no pair using `sorted[lo]` can do better,
since `sorted[hi]` is the largest partner left — or too large, and symmetrically
for `hi`. Each step therefore *discards* one index with a proof rather than a
guess. The tie-breaking is specified as "smaller sum wins" because otherwise the
answer depends on which order the loop happens to visit equally-close sums, and a
problem whose answer depends on that is under-specified.

`count_pairs` is where duplicates make it awkward, and it is worth doing once by
hand. Three situations arise when the sum hits the target exactly:

- **All the remaining values are equal** (`sorted[lo] == sorted[hi]`). Then every
  pair among the `k` of them works, which is `k(k−1)/2`, and there is nothing
  left to examine. `{1,1,1,1}` with target 2 is this case: `4 × 3 / 2 = 6`.
- **The two ends differ.** Count the run of `sorted[lo]` on the left and the run
  of `sorted[hi]` on the right; every left copy pairs with every right copy, so
  multiply. `{2,2,3,3}` with target 5 gives `2 × 2 = 4`.
- Advancing only one index, or advancing both by one, undercounts — which is the
  bug this problem exists to make you hit.

Note the `long long` on every accumulator. A hundred thousand equal values with
the matching target yields about 5 × 10⁹ pairs, which overflows an `int` by more
than a factor of two — the arithmetic Chapter 10.1 asks you to do before writing
the loop, on a quantity that is easy to forget is quadratic in the input.
