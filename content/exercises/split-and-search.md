---
id: split-and-search
title: "Half the items, twice"
difficulty: stretch
chapter: meet-in-the-middle
topics: [meet-in-the-middle, binary-search, algorithms]
check: unit
standard: c++20
---

Two meet-in-the-middle searches, each losing something at the boundary between
the halves.

- `count_subsets_with_sum(a, target)` — how many subsets sum to exactly
  `target`, counting the empty subset when `target` is 0. Asks *whether* a
  matching right-half sum exists rather than *how many* there are.
- `max_sum_at_most(a, cap)` — the largest subset sum not exceeding `cap`, or `0`
  for the empty subset. Enumerates the left half's masks from 1, so subsets that
  use nothing from the left are never considered.

Values are non-negative, `cap ≥ 0`, and `a.size()` is at most 20.

## Starter
```cpp
#include <algorithm>
#include <bit>
#include <cstddef>
#include <vector>

std::vector<long long> half_sums(const std::vector<int>& a, int from, int to) {
    int k = to - from;
    std::vector<long long> sums(std::size_t{1} << k, 0);
    for (unsigned m = 1; m < (1u << k); ++m)
        sums[m] = sums[m & (m - 1)] + a[from + std::countr_zero(m)];
    return sums;
}

long long count_subsets_with_sum(const std::vector<int>& a, long long target) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long total = 0;
    for (long long s : ls)
        if (std::binary_search(rs.begin(), rs.end(), target - s)) ++total;   // one?
    return total;
}

long long max_sum_at_most(const std::vector<int>& a, long long cap) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long best = -1;
    for (std::size_t m = 1; m < ls.size(); ++m) {        // skips the empty left subset
        long long s = ls[m];
        auto it = std::upper_bound(rs.begin(), rs.end(), cap - s);
        if (it != rs.begin()) best = std::max(best, s + *(it - 1));
    }
    return best;
}
```

## Tests
```cpp
// count_subsets_with_sum
CHECK_EQ(count_subsets_with_sum({1, 2, 3, 4}, 5), 2LL);       // {1,4} and {2,3}
CHECK_EQ(count_subsets_with_sum({2, 2, 2, 2}, 4), 6LL);
CHECK_EQ(count_subsets_with_sum({1, 1, 1}, 1), 3LL);
CHECK_EQ(count_subsets_with_sum({3, 1, 4, 1, 5}, 5), 4LL);
CHECK_EQ(count_subsets_with_sum({7}, 7), 1LL);
CHECK_EQ(count_subsets_with_sum({7}, 0), 1LL);                // the empty subset
CHECK_EQ(count_subsets_with_sum({}, 0), 1LL);
CHECK_EQ(count_subsets_with_sum({}, 1), 0LL);
CHECK_EQ(count_subsets_with_sum({10, 20, 30}, 60), 1LL);

// max_sum_at_most
CHECK_EQ(max_sum_at_most({10, 3}, 5), 3LL);
CHECK_EQ(max_sum_at_most({1, 2, 3, 4}, 7), 7LL);
CHECK_EQ(max_sum_at_most({5, 5, 5}, 12), 10LL);
CHECK_EQ(max_sum_at_most({100}, 50), 0LL);                    // only the empty subset fits
CHECK_EQ(max_sum_at_most({}, 0), 0LL);
CHECK_EQ(max_sum_at_most({2, 3, 7, 11}, 13), 13LL);
CHECK_EQ(max_sum_at_most({1, 1, 1, 1}, 3), 3LL);
CHECK_EQ(max_sum_at_most({9, 8}, 17), 17LL);
```

## Hints
- `std::binary_search` returns a `bool`. The number of right-half subsets with a given sum is `std::upper_bound(...) - std::lower_bound(...)`, or `std::equal_range` in one call.
- `{2,2,2,2}` with a target of 4 has six matching subsets; the starter finds fewer, because several right-half subsets share each sum.
- `std::equal_range` returns both iterators at once and is the idiomatic spelling: `auto [first, last] = std::equal_range(rs.begin(), rs.end(), target - s); total += last - first;`.
- `half_sums` already stores the empty subset at index 0 — its sum is 0 — so `max_sum_at_most` must iterate `ls` from index 0, not 1. Skipping it discards every subset that lies entirely in the right half.
- `{10, 3}` with a cap of 5 is the smallest case: the answer `{3}` uses nothing from the left half.
- The empty subset is a legitimate answer, so `max_sum_at_most({100}, 50)` is 0, not −1.

## Solution
```cpp
#include <algorithm>
#include <bit>
#include <cstddef>
#include <vector>

std::vector<long long> half_sums(const std::vector<int>& a, int from, int to) {
    int k = to - from;
    std::vector<long long> sums(std::size_t{1} << k, 0);
    for (unsigned m = 1; m < (1u << k); ++m)
        sums[m] = sums[m & (m - 1)] + a[from + std::countr_zero(m)];
    return sums;
}

long long count_subsets_with_sum(const std::vector<int>& a, long long target) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long total = 0;
    for (long long s : ls) {
        auto [first, last] = std::equal_range(rs.begin(), rs.end(), target - s);
        total += last - first;                            // every matching partner
    }
    return total;
}

long long max_sum_at_most(const std::vector<int>& a, long long cap) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long best = -1;
    for (std::size_t m = 0; m < ls.size(); ++m) {         // index 0 is the empty subset
        long long s = ls[m];
        auto it = std::upper_bound(rs.begin(), rs.end(), cap - s);
        if (it != rs.begin()) best = std::max(best, s + *(it - 1));
    }
    return best;
}
```

## Notes
Both bugs are about the same thing: **the empty subset is a subset, and equal
sums are distinct subsets.**

**`binary_search` answers the wrong question.** It reports whether a value is
present, and the question is how many times. With repeated values — and subset
sums repeat constantly, since `{2,2}` and `{2,2}` from different positions are
different subsets with the same sum — one match can stand for many. `{2,2,2,2}`
with a target of 4 has six subsets; the starter counts one per *left* subset
that has any partner at all.

`std::equal_range` is the right tool and returns the pair in one search:

```cpp
auto [first, last] = std::equal_range(rs.begin(), rs.end(), want);
total += last - first;
```

It is `lower_bound` and `upper_bound` together, and it makes the intent obvious
in a way that two separate calls do not.

**Index 0 is the empty subset.** `half_sums` builds a table indexed by mask, and
mask 0 — no elements chosen — has sum 0. Starting the *build* loop at 1 is
correct, because `sums[0]` is already 0 and there is no lower bit to reuse.
Starting the *consumption* loop at 1 is not: it discards the case where the left
half contributes nothing, and therefore every subset lying entirely in the right
half. `{10, 3}` with a cap of 5 has its answer there.

This asymmetry — build from 1, consume from 0 — is exactly the kind of detail
that looks like a copy-paste consistency issue and is not. Write a comment.

**The sentinel and the empty subset.** `best` starts at −1 to mean "nothing
found", but the empty subset always qualifies when `cap ≥ 0`, so a correct
implementation can never return −1 for the stated constraints. That makes −1
harmless here — and it also means a −1 coming out is a signal that the empty
subset went missing, which is precisely the bug. Sentinels that can only appear
when something is wrong are worth keeping for that reason.

**Complexity.** Both are `O(2^(n/2) · n)`: `2^(n/2)` left subsets, each doing a
binary search over `2^(n/2)` right sums. At `n = 40` that is a million times
twenty, or 2 × 10⁷ — comfortable. The sort of the right side is the same order
and is done once.
