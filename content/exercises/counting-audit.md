---
id: counting-audit
title: "Three counters that lose track"
difficulty: core
chapter: hashing-and-frequency
topics: [hashing, frequency-maps, multiset, algorithms]
check: unit
standard: c++20
---

Three functions built on frequency maps, each with a different way of getting
the bookkeeping wrong.

- `most_frequent(a)` — the value that occurs most often; ties broken by the
  **smallest** such value. Breaks ties the other way.
- `distinct_per_window(a, k)` — the number of distinct values in each window of
  length `k`. Decrements counts but never removes the zeros, so `size()` keeps
  counting values that have left.
- `window_min(a, k)` — the minimum of each window, using a `std::multiset`.
  Erases by value, which removes every copy rather than one.

Assume `1 ≤ k ≤ n` and a non-empty array for the windowed functions.

## Starter
```cpp
#include <cstddef>
#include <map>
#include <set>
#include <vector>

int most_frequent(const std::vector<int>& a) {
    std::map<int, int> counts;
    for (int x : a) ++counts[x];

    int best = counts.begin()->first;                 // the smallest value present
    for (auto [value, count] : counts)
        if (count >= counts[best]) best = value;      // >= keeps the last, not the first
    return best;
}

std::vector<int> distinct_per_window(const std::vector<int>& a, int k) {
    std::map<int, int> counts;
    std::vector<int> out;
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        ++counts[a[i]];
        if (i >= k) --counts[a[i - k]];               // count reaches zero and stays
        if (i + 1 >= k) out.push_back(static_cast<int>(counts.size()));
    }
    return out;
}

std::vector<int> window_min(const std::vector<int>& a, int k) {
    std::multiset<int> window;
    std::vector<int> out;
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        window.insert(a[i]);
        if (i >= k) window.erase(a[i - k]);           // erases every copy
        if (i + 1 >= k) out.push_back(*window.begin());
    }
    return out;
}
```

## Tests
```cpp
// most_frequent
CHECK_EQ(most_frequent({3, 1, 3, 2, 1, 3}), 3);
CHECK_EQ(most_frequent({1, 1, 2, 2}), 1);           // tie: the smaller value wins
CHECK_EQ(most_frequent({7, 7, 1, 1, 2}), 1);        // tie between 1 and 7
CHECK_EQ(most_frequent({4, 4, 4}), 4);
CHECK_EQ(most_frequent({5}), 5);
CHECK_EQ(most_frequent({-2, -2, 9}), -2);

// distinct_per_window
CHECK_EQ(distinct_per_window({3, 1, 3, 2, 1, 3}, 3), (std::vector<int>{2, 3, 3, 3}));
CHECK_EQ(distinct_per_window({1, 1, 2, 2}, 2), (std::vector<int>{1, 2, 1}));
CHECK_EQ(distinct_per_window({1, 2, 1, 2, 1}, 3), (std::vector<int>{2, 2, 2}));
CHECK_EQ(distinct_per_window({4, 4, 4}, 2), (std::vector<int>{1, 1}));
CHECK_EQ(distinct_per_window({1, 2, 3, 4}, 2), (std::vector<int>{2, 2, 2}));
CHECK_EQ(distinct_per_window({9, 1, 2, 3, 8, 2, 1, 5}, 4), (std::vector<int>{4, 4, 3, 4, 4}));
CHECK_EQ(distinct_per_window({5}, 1), (std::vector<int>{1}));

// window_min
CHECK_EQ(window_min({3, 1, 3, 2, 1, 3}, 3), (std::vector<int>{1, 1, 1, 1}));
CHECK_EQ(window_min({1, 1, 2, 2}, 2), (std::vector<int>{1, 1, 2}));
CHECK_EQ(window_min({4, 4, 4}, 2), (std::vector<int>{4, 4}));
CHECK_EQ(window_min({1, 2, 3, 4}, 2), (std::vector<int>{1, 2, 3}));
CHECK_EQ(window_min({9, 1, 2, 3, 8, 2, 1, 5}, 4), (std::vector<int>{1, 1, 2, 1, 1}));
CHECK_EQ(window_min({5}, 1), (std::vector<int>{5}));
```

## Hints
- `most_frequent` iterates a `std::map`, so the values arrive in increasing order. To keep the *smallest* winner in a tie, the comparison must be strict: `>` and not `>=`.
- `{1, 1, 2, 2}` is the whole test: both values occur twice, and the answer is 1.
- The starting `best` matters as much as the comparison. Seeding it with `counts.begin()->first` — the smallest key — means the strict `>` can only ever move to a value with a *higher* count, never to an equal one.
- `distinct_per_window` counts distinct values as `counts.size()`, so an entry whose count has fallen to zero must be erased, not left behind. `if (--counts[x] == 0) counts.erase(x);`
- Careful with `counts.erase(x)` after `--counts[x]`: take the iterator once (`auto it = counts.find(x); if (--it->second == 0) counts.erase(it);`) and you do one lookup instead of three.
- `window_min` must remove one occurrence, not all of them: `window.erase(window.find(a[i - k]))`. `erase(value)` on a multiset removes every copy and returns how many it removed.
- `{1, 1, 2, 2}` with `k = 2` catches it — the window `{1, 1}` loses both 1s when only one should leave.

## Solution
```cpp
#include <cstddef>
#include <map>
#include <set>
#include <vector>

int most_frequent(const std::vector<int>& a) {
    std::map<int, int> counts;
    for (int x : a) ++counts[x];

    int best = counts.begin()->first;                 // the smallest value present
    for (auto [value, count] : counts)
        if (count > counts[best]) best = value;       // strict: the first wins a tie
    return best;
}

std::vector<int> distinct_per_window(const std::vector<int>& a, int k) {
    std::map<int, int> counts;
    std::vector<int> out;
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        ++counts[a[i]];
        if (i >= k) {
            auto it = counts.find(a[i - k]);
            if (--it->second == 0) counts.erase(it);  // a zero is not a distinct value
        }
        if (i + 1 >= k) out.push_back(static_cast<int>(counts.size()));
    }
    return out;
}

std::vector<int> window_min(const std::vector<int>& a, int k) {
    std::multiset<int> window;
    std::vector<int> out;
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        window.insert(a[i]);
        if (i >= k) window.erase(window.find(a[i - k]));   // exactly one copy
        if (i + 1 >= k) out.push_back(*window.begin());
    }
    return out;
}
```

## Notes
**A tie-break is part of the specification.** `>=` and `>` differ only when two
values have the same count, and which one you want is not a matter of taste —
the statement says so. Because a `std::map` iterates in increasing key order,
`>` keeps the first value seen, which is the smallest; `>=` keeps the last,
which is the largest. If the statement had asked for the largest, `>=` would be
the correct line and `>` the bug. Read it, then write the comparison.

Note also what this relies on: iteration order. The same loop over a
`std::unordered_map` would give an unspecified winner in a tie, and one that can
change between compilers, between runs, and between test cases. When a tie-break
exists, either iterate something ordered or compare the value explicitly:
`if (count > best_count || (count == best_count && value < best))`.

**A zero count is not a value.** `counts.size()` counts *entries*, and
`--counts[x]` leaves an entry behind with the value 0. On `{1, 1, 2, 2}` with
`k = 2` the starter reports 1, 2, 2 where the answer is 1, 2, 1 — the 1s have
left the window but their entry has not left the map. Erasing on zero is what
keeps `size()` meaning "distinct values present".

There is a second reason to erase, which matters at contest sizes: a map that
never shrinks costs memory proportional to the number of *distinct values ever
seen*, not to the window. On 2 × 10⁵ distinct values that is the difference
between a map of `k` entries and one of `n`.

**`erase(value)` erases all of them.** This is the most-hit trap in
`std::multiset`, because it is silent — no error, just a smaller container. The
two overloads do genuinely different things:

```cpp
ms.erase(x);            // removes every copy of x, returns how many
ms.erase(ms.find(x));   // removes exactly one, and is O(1) amortised
```

`erase(iterator)` is also faster: it needs no search, whereas `erase(value)` is
O(log n + count). The only care needed is that `find` must have found something
— `erase(end())` is undefined behaviour — which in a sliding window is
guaranteed, because the element you are removing is one you inserted `k` steps
ago.
