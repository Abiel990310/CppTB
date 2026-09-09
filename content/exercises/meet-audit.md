---
id: meet-audit
title: "Three combines that miscount"
difficulty: core
chapter: meet-in-the-middle
topics: [meet-in-the-middle, binary-search, hashing, algorithms]
check: unit
standard: c++20
---

Three meet-in-the-middle routines. The split and the enumeration are right in
all three; the **combine** is where each goes wrong.

- `count_pairs_summing_to(A, B, target)` — how many pairs, one from each list,
  sum to `target`. Counts one per match instead of the number of partners
  stored.
- `count_subsets_in_range(a, lo, hi)` — how many subsets of `a` have a sum in
  `[lo, hi]`, inclusive. Uses `lower_bound` for both ends, which excludes the
  values equal to `hi`.
- `closest_not_exceeding(a, target)` — the largest subset sum that does not
  exceed `target` (the empty subset, summing to 0, always qualifies). Looks only
  at where `lower_bound` lands, never at the element before it.

All values are non-negative and `target ≥ 0`; `a.size()` is at most 20.

## Starter
```cpp
#include <algorithm>
#include <bit>
#include <cstddef>
#include <unordered_map>
#include <vector>

long long count_pairs_summing_to(const std::vector<int>& A,
                                 const std::vector<int>& B, long long target) {
    std::unordered_map<long long, int> seen;
    for (int a : A) ++seen[a];

    long long total = 0;
    for (int b : B)
        if (seen.find(target - b) != seen.end()) ++total;   // one, or however many?
    return total;
}

std::vector<long long> half_sums(const std::vector<int>& a, int from, int to) {
    int k = to - from;
    std::vector<long long> sums(std::size_t{1} << k, 0);
    for (unsigned m = 1; m < (1u << k); ++m)
        sums[m] = sums[m & (m - 1)] + a[from + std::countr_zero(m)];
    return sums;
}

long long count_subsets_in_range(const std::vector<int>& a, long long lo, long long hi) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long total = 0;
    for (long long s : ls) {
        auto first = std::lower_bound(rs.begin(), rs.end(), lo - s);
        auto last = std::lower_bound(rs.begin(), rs.end(), hi - s);   // excludes hi
        total += last - first;
    }
    return total;
}

long long closest_not_exceeding(const std::vector<int>& a, long long target) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long best = -1;
    for (long long s : ls) {
        auto it = std::lower_bound(rs.begin(), rs.end(), target - s);
        if (it != rs.end() && s + *it <= target) best = std::max(best, s + *it);
    }
    return best;
}
```

## Tests
```cpp
// count_pairs_summing_to
CHECK_EQ(count_pairs_summing_to({1, 2, 3}, {1, 2, 3}, 4), 3LL);
CHECK_EQ(count_pairs_summing_to({1, 1}, {1, 1}, 2), 4LL);      // every pair matches
CHECK_EQ(count_pairs_summing_to({0}, {0}, 0), 1LL);
CHECK_EQ(count_pairs_summing_to({1, 2}, {3, 4}, 10), 0LL);
CHECK_EQ(count_pairs_summing_to({-1, 1}, {1, -1}, 0), 2LL);
CHECK_EQ(count_pairs_summing_to({5}, {5}, 10), 1LL);

// count_subsets_in_range
CHECK_EQ(count_subsets_in_range({1, 2, 3}, 0, 3), 5LL);
CHECK_EQ(count_subsets_in_range({1, 2, 3}, 3, 3), 2LL);        // {3} and {1,2}
CHECK_EQ(count_subsets_in_range({1, 1, 1}, 1, 2), 6LL);
CHECK_EQ(count_subsets_in_range({5}, 0, 10), 2LL);             // {} and {5}
CHECK_EQ(count_subsets_in_range({}, 0, 0), 1LL);
CHECK_EQ(count_subsets_in_range({2, 2, 2}, 2, 4), 6LL);
CHECK_EQ(count_subsets_in_range({1, 2, 3, 4}, 5, 6), 4LL);

// closest_not_exceeding
CHECK_EQ(closest_not_exceeding({1, 2, 3}, 5), 5LL);
CHECK_EQ(closest_not_exceeding({1, 2, 3}, 0), 0LL);            // the empty subset
CHECK_EQ(closest_not_exceeding({3, 5, 7}, 9), 8LL);
CHECK_EQ(closest_not_exceeding({10}, 5), 0LL);
CHECK_EQ(closest_not_exceeding({2, 4, 8}, 14), 14LL);
CHECK_EQ(closest_not_exceeding({1, 1, 1}, 2), 2LL);
CHECK_EQ(closest_not_exceeding({5, 5}, 7), 5LL);
```

## Hints
- The map in `count_pairs_summing_to` stores *how many* elements of `A` have each value. A match therefore contributes `it->second` pairs, not one. `{1,1}` against `{1,1}` has four pairs summing to 2.
- Use the iterator you already have: `auto it = seen.find(target - b); if (it != seen.end()) total += it->second;` — one lookup, and the count is right there.
- For an inclusive range `[lo, hi]`, the end of the matching span is `upper_bound(hi - s)`: the first element **strictly greater** than the bound. `lower_bound` stops at the first element *not less*, which excludes every value equal to `hi`.
- `count_subsets_in_range({1,2,3}, 3, 3)` is the smallest case that shows it: the starter returns 0 because the span from `lower_bound(3)` to `lower_bound(3)` is empty.
- `lower_bound(target - s)` finds the first right-sum that is **too large**. The candidate you want is usually the one *before* it, so check `it != rs.begin()` and look at `*(it - 1)` as well.
- Both checks are needed: the element at `it` qualifies only when it is exactly `target - s`.

## Solution
```cpp
#include <algorithm>
#include <bit>
#include <cstddef>
#include <unordered_map>
#include <vector>

long long count_pairs_summing_to(const std::vector<int>& A,
                                 const std::vector<int>& B, long long target) {
    std::unordered_map<long long, int> seen;
    for (int a : A) ++seen[a];

    long long total = 0;
    for (int b : B) {
        auto it = seen.find(target - b);
        if (it != seen.end()) total += it->second;          // every stored partner
    }
    return total;
}

std::vector<long long> half_sums(const std::vector<int>& a, int from, int to) {
    int k = to - from;
    std::vector<long long> sums(std::size_t{1} << k, 0);
    for (unsigned m = 1; m < (1u << k); ++m)
        sums[m] = sums[m & (m - 1)] + a[from + std::countr_zero(m)];
    return sums;
}

long long count_subsets_in_range(const std::vector<int>& a, long long lo, long long hi) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long total = 0;
    for (long long s : ls) {
        auto first = std::lower_bound(rs.begin(), rs.end(), lo - s);
        auto last = std::upper_bound(rs.begin(), rs.end(), hi - s);   // inclusive
        total += last - first;
    }
    return total;
}

long long closest_not_exceeding(const std::vector<int>& a, long long target) {
    int n = static_cast<int>(a.size());
    std::vector<long long> ls = half_sums(a, 0, n / 2);
    std::vector<long long> rs = half_sums(a, n / 2, n);
    std::sort(rs.begin(), rs.end());

    long long best = -1;
    for (long long s : ls) {
        auto it = std::lower_bound(rs.begin(), rs.end(), target - s);
        if (it != rs.end() && s + *it <= target) best = std::max(best, s + *it);
        if (it != rs.begin() && s + *(it - 1) <= target)                // the one before
            best = std::max(best, s + *(it - 1));
    }
    return best;
}
```

## Notes
Three combines, three ways to be off by the number of ties.

**A hash map of counts is not a hash set.** `seen[a]` holds how many elements of
`A` equal `a`, and each of them pairs with the current `b`. Counting one per
match answers "how many elements of `B` have at least one partner", which is a
different question with the same shape. `{1,1}` against `{1,1}` makes it obvious
— four pairs, and the starter says two.

There is a second reason to write `auto it = seen.find(...)` rather than
`seen.count(...)` followed by `seen[...]`: `operator[]` **inserts** on a missing
key, so the version that looks up twice also grows the map by one entry per
failed lookup. Chapter 10.10 measured what that costs.

**`lower_bound` and `upper_bound` mark the two ends of a run of equal values.**
For an inclusive `[lo, hi]`:

```
lower_bound(lo)   first element >= lo    -- the start
upper_bound(hi)   first element >  hi    -- one past the end
```

Using `lower_bound` at both ends produces `[lo, hi)`, which loses exactly the
elements equal to `hi`. On distinct data that is often nothing, which is why the
bug survives casual testing; `{1,2,3}` with the range `[3,3]` returns 0 instead
of 2. The cross-check to run is against full enumeration on small inputs *with
repeats* — chapter 10.15's sample does 500 of them.

**`lower_bound` finds the first thing too big.** For "largest sum not exceeding
the target", `lower_bound(target - s)` lands on the first right-sum that makes
the total meet or exceed the target — so it qualifies only in the exact-hit
case, and the real candidate is normally `*(it - 1)`. Checking both, with both
guards, is three lines and is the whole difference between `{3,5,7}` answering 8
and answering −1.

The general habit: after any `lower_bound`, ask what the *predecessor* means. In
"closest to" problems it is always one of the two, and which one depends on data
you do not control.
