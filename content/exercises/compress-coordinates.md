---
id: compress-coordinates
title: "A billion values, a hundred thousand slots"
difficulty: core
chapter: sorting-and-comparators
topics: [sorting, compression, binary-search]
check: unit
standard: c++20
---

Implement coordinate compression and one thing that needs it.

- `distinct_sorted(values)` — the distinct values, ascending.
- `compress(values)` — each value replaced by its rank among the distinct
  values, so the result contains only integers in `[0, distinct count)` and
  preserves order: if `a < b` then `rank(a) < rank(b)`.
- `most_frequent_rank(values)` — the rank of the most frequent value, breaking
  ties towards the smaller value. Must be O(n log n), so it may not index an
  array by the values themselves.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

std::vector<long long> distinct_sorted(const std::vector<long long>& values) {
    return values;
}

std::vector<int> compress(const std::vector<long long>& values) {
    return std::vector<int>(values.size(), 0);
}

int most_frequent_rank(const std::vector<long long>& values) {
    return 0;
}
```

## Tests
```cpp
// distinct_sorted
{
    std::vector<long long> v{1000000000LL, 5, 1000000000LL, -7, 42, 5, 0};
    std::vector<long long> d = distinct_sorted(v);
    CHECK_EQ(d.size(), std::size_t{5});
    CHECK_EQ(d[0], -7LL);
    CHECK_EQ(d[1], 0LL);
    CHECK_EQ(d[2], 5LL);
    CHECK_EQ(d[3], 42LL);
    CHECK_EQ(d[4], 1000000000LL);
    CHECK_EQ(v.size(), std::size_t{7});     // the caller's vector is untouched
}
CHECK(distinct_sorted({}).empty());
CHECK_EQ(distinct_sorted({4, 4, 4}).size(), std::size_t{1});

// compress
{
    std::vector<long long> v{1000000000LL, 5, 1000000000LL, -7, 42, 5, 0};
    std::vector<int> r = compress(v);
    CHECK_EQ(r.size(), std::size_t{7});
    CHECK_EQ(r[0], 4);
    CHECK_EQ(r[1], 2);
    CHECK_EQ(r[2], 4);
    CHECK_EQ(r[3], 0);
    CHECK_EQ(r[4], 3);
    CHECK_EQ(r[5], 2);
    CHECK_EQ(r[6], 1);
}
CHECK(compress({}).empty());
{
    std::vector<int> r = compress({9, 9, 9});
    CHECK_EQ(r.size(), std::size_t{3});
    CHECK_EQ(r[0], 0);
    CHECK_EQ(r[2], 0);
}
{
    // Order is preserved: a smaller value never gets a larger rank.
    std::vector<long long> v{-1000000000LL, 0, 1000000000LL};
    std::vector<int> r = compress(v);
    CHECK_EQ(r[0], 0);
    CHECK_EQ(r[1], 1);
    CHECK_EQ(r[2], 2);
}

// most_frequent_rank
{
    // 5 appears twice, 1000000000 twice; the smaller value wins the tie,
    // and 5 has rank 2 among {-7, 0, 5, 42, 1000000000}.
    std::vector<long long> v{1000000000LL, 5, 1000000000LL, -7, 42, 5, 0};
    CHECK_EQ(most_frequent_rank(v), 2);
}
{
    std::vector<long long> v{7, 7, 7, 3, 3};
    CHECK_EQ(most_frequent_rank(v), 1);     // 7 has rank 1 among {3, 7}
}
{
    std::vector<long long> v{1, 2, 3};
    CHECK_EQ(most_frequent_rank(v), 0);     // all tie; smallest wins
}
{
    std::vector<long long> v{-5};
    CHECK_EQ(most_frequent_rank(v), 0);
}
{
    // Large, sparse values: an array indexed by value is not an option.
    std::vector<long long> v;
    for (int i = 0; i < 1000; ++i) v.push_back(1000000000LL - i * 1000000LL);
    v.push_back(1000000000LL - 500 * 1000000LL);        // one value twice
    CHECK_EQ(most_frequent_rank(v), 499);
}
```

## Hints
- `distinct_sorted` is the three-line idiom: copy, `std::sort`, then `erase(std::unique(...), end())`. Copy first — the checks verify the caller's vector is unchanged.
- `std::unique` removes nothing on its own; it moves the duplicates to the end and returns the new logical end. The `erase` is what shortens the vector.
- `compress` builds the distinct list once, then maps each original value with `std::lower_bound(d.begin(), d.end(), v) - d.begin()`.
- Build the distinct list **once**, outside the loop. Rebuilding it per element is O(n² log n).
- `most_frequent_rank` can compress first and then count with a `std::vector<int>` of size equal to the distinct count — which is the whole reason to compress.
- Ties go to the smaller value, and the ranks are already in ascending value order, so scanning the counts from index 0 and keeping a strict `>` comparison does it.
- The last check has 1001 values spread across a billion. An array indexed by value would need 10⁹ entries; an array indexed by rank needs 1000.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

std::vector<long long> distinct_sorted(const std::vector<long long>& values) {
    std::vector<long long> sorted = values;              // copy: caller keeps theirs
    std::sort(sorted.begin(), sorted.end());
    sorted.erase(std::unique(sorted.begin(), sorted.end()), sorted.end());
    return sorted;
}

std::vector<int> compress(const std::vector<long long>& values) {
    const std::vector<long long> sorted = distinct_sorted(values);

    std::vector<int> ranks;
    ranks.reserve(values.size());
    for (long long v : values)
        ranks.push_back(static_cast<int>(
            std::lower_bound(sorted.begin(), sorted.end(), v) - sorted.begin()));
    return ranks;
}

int most_frequent_rank(const std::vector<long long>& values) {
    if (values.empty()) return 0;

    const std::vector<int> ranks = compress(values);
    const std::size_t distinct =
        static_cast<std::size_t>(*std::max_element(ranks.begin(), ranks.end())) + 1;

    std::vector<int> counts(distinct, 0);                 // indexed by rank, not value
    for (int r : ranks) ++counts[static_cast<std::size_t>(r)];

    int best = 0;
    for (std::size_t i = 1; i < counts.size(); ++i)
        if (counts[i] > counts[static_cast<std::size_t>(best)])
            best = static_cast<int>(i);                   // strict >, so ties keep the smaller
    return best;
}
```

## Notes
The whole technique is three lines, and the reason to learn it as a unit is that
each line is easy to get subtly wrong on its own.

`std::unique` is the classic one. It does not erase — it cannot, since it only
has iterators and no container — so it compacts the unique elements to the front
and returns where they end. Forgetting the `erase` leaves the vector its
original length with rubbish after the useful part, and the bug shows up much
later as a rank that is too large. Chapter 4.5 called this the erase–remove
idiom; this is the same shape with `unique` in place of `remove`.

The copy at the top of `distinct_sorted` is deliberate and checked. A function
that sorts its caller's data as a side effect is a bad neighbour — and here it
would also destroy the original order, which `compress` needs immediately
afterwards to map each value back.

`most_frequent_rank` is the payoff. Counting occurrences wants an array indexed
by value, and the values run to 10⁹; after compression the same array is indexed
by rank and has one slot per distinct value. The last check makes that concrete:
1001 values spread over a billion, needing an array of 1000. That substitution —
*index by rank instead of by value* — is what unlocks counting arrays, Fenwick
trees, segment trees and DP-over-values for inputs whose values are large and
sparse, which is most of them.

The tie-breaking is worth one sentence. Ranks are assigned in ascending value
order, so scanning `counts` from index 0 and only replacing the best on a strict
`>` keeps the earliest — that is, the smallest-valued — winner. Using `>=` would
keep the largest, which is a one-character difference and a different function.
