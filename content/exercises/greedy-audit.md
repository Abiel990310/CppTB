---
id: greedy-audit
title: "Three greedies sorted by the wrong key"
difficulty: core
chapter: greedy
topics: [greedy, sorting, algorithms]
check: unit
standard: c++20
---

Three greedy algorithms whose code is right and whose *rule* is wrong. In each
case the fix is one comparison or one container.

- `max_non_overlapping(v)` — the largest number of pairwise non-overlapping
  intervals `[start, finish)`. Sorts by start time.
- `min_total_wait(jobs)` — the smallest possible sum of completion times, where
  jobs run one after another. Runs the longest job first.
- `min_merge_cost(sizes)` — repeatedly merge two piles into one at a cost equal
  to their combined size, until one pile remains; the smallest total cost. Merges
  them left to right in the order given.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <queue>
#include <utility>
#include <vector>

int max_non_overlapping(std::vector<std::pair<int, int>> v) {
    std::sort(v.begin(), v.end(), [](auto a, auto b) { return a.first < b.first; });

    int taken = 0;
    long long last_end = -1;
    for (auto [start, finish] : v)
        if (start >= last_end) { ++taken; last_end = finish; }
    return taken;
}

long long min_total_wait(std::vector<int> jobs) {
    std::sort(jobs.begin(), jobs.end(), std::greater<int>{});   // longest first

    long long clock = 0, total = 0;
    for (int d : jobs) { clock += d; total += clock; }
    return total;
}

long long min_merge_cost(const std::vector<int>& sizes) {
    if (sizes.size() < 2) return 0;

    long long running = sizes[0], total = 0;
    for (std::size_t i = 1; i < sizes.size(); ++i) {   // left to right, as given
        running += sizes[i];
        total += running;
    }
    return total;
}
```

## Tests
```cpp
// max_non_overlapping
CHECK_EQ(max_non_overlapping({{1, 3}, {2, 5}, {4, 7}, {1, 8}, {5, 9}, {8, 10}}), 3);
CHECK_EQ(max_non_overlapping({{0, 1}, {1, 2}, {2, 3}}), 3);
CHECK_EQ(max_non_overlapping({{0, 5}, {0, 4}, {0, 1}, {1, 5}}), 2);
CHECK_EQ(max_non_overlapping({{0, 10}}), 1);
CHECK_EQ(max_non_overlapping({}), 0);
CHECK_EQ(max_non_overlapping({{1, 2}, {1, 2}, {1, 2}}), 1);

// min_total_wait
CHECK_EQ(min_total_wait({4, 1, 3}), 13LL);        // 1 + (1+3) + (1+3+4)
CHECK_EQ(min_total_wait({5, 2, 7}), 23LL);
CHECK_EQ(min_total_wait({1}), 1LL);
CHECK_EQ(min_total_wait({}), 0LL);
CHECK_EQ(min_total_wait({3, 3, 3}), 18LL);
CHECK_EQ(min_total_wait({10, 1, 1, 1}), 19LL);

// min_merge_cost
CHECK_EQ(min_merge_cost({4, 3, 2, 6}), 29LL);
CHECK_EQ(min_merge_cost({1, 2, 3, 4, 5}), 33LL);
CHECK_EQ(min_merge_cost({5}), 0LL);
CHECK_EQ(min_merge_cost({}), 0LL);
CHECK_EQ(min_merge_cost({2, 2}), 4LL);
CHECK_EQ(min_merge_cost({1, 1, 1, 1}), 8LL);
```

## Hints
- For `max_non_overlapping`, the interval to take is the one that leaves the most room afterwards — the one that **finishes** earliest. Sorting by start makes one long interval block everything behind it.
- `{{0,5}, {0,4}, {0,1}, {1,5}}` is the counterexample: sorted by start it takes `[0,5)` and stops; sorted by finish it takes `[0,1)` then `[1,5)`.
- For `min_total_wait`, every job still waiting pays for the one running now, so the job that delays the most others should be the *shortest*. Sort ascending.
- Check with `{10, 1, 1, 1}`: shortest-first gives 1 + 2 + 3 + 13 = 19; longest-first gives 10 + 11 + 12 + 13 = 46.
- For `min_merge_cost`, the two piles merged first are counted in every later merge, so they must be the two **smallest** at each step — and after merging, the new pile re-enters the pool and may itself be smallest. That needs a `std::priority_queue<long long, std::vector<long long>, std::greater<>>`, not a sort.
- A single sort is not enough: `{4, 3, 2, 6}` sorted is `2 3 4 6`, and after merging 2 and 3 the new pile of 5 must be compared against 4 before the next merge.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <functional>
#include <queue>
#include <utility>
#include <vector>

int max_non_overlapping(std::vector<std::pair<int, int>> v) {
    std::sort(v.begin(), v.end(), [](auto a, auto b) { return a.second < b.second; });

    int taken = 0;
    long long last_end = -1;
    for (auto [start, finish] : v)
        if (start >= last_end) { ++taken; last_end = finish; }
    return taken;
}

long long min_total_wait(std::vector<int> jobs) {
    std::sort(jobs.begin(), jobs.end());                        // shortest first

    long long clock = 0, total = 0;
    for (int d : jobs) { clock += d; total += clock; }
    return total;
}

long long min_merge_cost(const std::vector<int>& sizes) {
    if (sizes.size() < 2) return 0;

    std::priority_queue<long long, std::vector<long long>, std::greater<>> pool(
        sizes.begin(), sizes.end());

    long long total = 0;
    while (pool.size() > 1) {
        long long a = pool.top(); pool.pop();
        long long b = pool.top(); pool.pop();
        total += a + b;
        pool.push(a + b);                                       // it competes again
    }
    return total;
}
```

## Notes
Three rules, three exchange arguments, and each one explains the fix.

**Earliest finish, not earliest start.** Take the interval finishing first; if
some optimal solution does not contain it, swap it in for whatever that solution
takes first. Everything else in the solution starts after that interval's finish
time, hence after ours, so the swap is legal and the size is unchanged.
Therefore *some* optimum contains the earliest-finishing interval, and induction
does the rest. Sorting by start has no such argument, and the four-interval test
above is a counterexample small enough to check by eye.

**Shortest job first.** If two adjacent jobs run long-then-short, swapping them
leaves every other job's completion time unchanged — the pair occupies the same
total time — and reduces the earlier of the two completions by the difference in
duration. So any order that is not sorted ascending can be improved, and sorted
ascending is optimal. `{10, 1, 1, 1}` shows the size of the error: 19 against 46.

**The two smallest, repeatedly.** A pile's size is added to the total once for
each merge it takes part in, so the piles that get merged earliest are counted
most. Keeping the smallest two together at every step is Huffman's algorithm,
and the crucial detail is that the *merged* pile goes back into the pool: it may
now be one of the two smallest, or it may not.

That is why a single `std::sort` cannot express it. On `{4, 3, 2, 6}` the sorted
order is `2 3 4 6`; merging 2 and 3 makes a pile of 5, which must be compared
against 4 and 6 — and 4 wins. A left-to-right fold gives 31 where the answer is
29, and a sort-once-then-fold gives the wrong pairing for the same reason.

The container that maintains "smallest, after arbitrary insertions" is a
min-heap:

```cpp
std::priority_queue<long long, std::vector<long long>, std::greater<>> pool;
```

`std::priority_queue` is a *max*-heap by default, so the `std::greater<>`
comparator is what turns it around — an easy thing to leave out, and the reason
the type has three template arguments here rather than one.

One last shared point: all three functions accumulate into `long long`. Both
totals grow quadratically in the number of items — each job's duration is
counted once for every job that follows it — so 2 × 10⁵ jobs of length 10⁹ give
about 2 × 10¹⁹, which overflows even a `long long` and means a real problem
would have to bound something further. Well before that, at a few thousand
items, both totals pass 2³¹. Sum types are wide by default; see chapter 10.7.
