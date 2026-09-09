---
id: search-the-answer
title: "Search for the answer, not the value"
difficulty: stretch
chapter: binary-search
topics: [binary-search, monotonicity, algorithms]
check: unit
standard: c++20
---

Three "smallest X such that…" problems. None of the inputs is sorted and none of
the answers has a formula, but each has a monotone predicate — so each is a
binary search over the answer.

- `min_capacity(weights, days)` — packages ship in the given order, at most
  `capacity` weight per day. The smallest capacity that finishes within `days`.
- `min_speed(piles, hours)` — eating `speed` items per hour from one pile at a
  time, each pile taking `ceil(pile / speed)` hours. The smallest speed that
  finishes within `hours`.
- `max_pieces(lengths, count)` — cutting the given rods into pieces all of the
  same integer length, the longest piece length that yields at least `count`
  pieces, or `0` if even length 1 cannot.

Write each as a `feasible` check plus a search. Do not try to derive a formula.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

long long min_capacity(const std::vector<int>& weights, int days) {
    return 0;
}

long long min_speed(const std::vector<int>& piles, int hours) {
    return 0;
}

long long max_pieces(const std::vector<int>& lengths, int count) {
    return 0;
}
```

## Tests
```cpp
// min_capacity
{
    std::vector<int> w{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    CHECK_EQ(min_capacity(w, 1), 55LL);      // everything in one day
    CHECK_EQ(min_capacity(w, 2), 28LL);
    CHECK_EQ(min_capacity(w, 3), 21LL);
    CHECK_EQ(min_capacity(w, 5), 15LL);
    CHECK_EQ(min_capacity(w, 10), 10LL);     // the largest single package
}
CHECK_EQ(min_capacity({7}, 1), 7LL);
CHECK_EQ(min_capacity({5, 5, 5, 5}, 2), 10LL);
CHECK_EQ(min_capacity({1, 1, 1}, 10), 1LL);  // more days than packages

// min_speed
CHECK_EQ(min_speed({3, 6, 7, 11}, 8), 4LL);
CHECK_EQ(min_speed({30, 11, 23, 4, 20}, 5), 30LL);
CHECK_EQ(min_speed({30, 11, 23, 4, 20}, 6), 23LL);
CHECK_EQ(min_speed({1}, 1), 1LL);
CHECK_EQ(min_speed({1000000000}, 1), 1000000000LL);
CHECK_EQ(min_speed({1, 1, 1, 1}, 4), 1LL);

// max_pieces
CHECK_EQ(max_pieces({9, 7, 5}, 3), 5LL);
CHECK_EQ(max_pieces({9, 7, 5}, 4), 4LL);
CHECK_EQ(max_pieces({5, 9, 7}, 6), 3LL);
CHECK_EQ(max_pieces({1, 1}, 3), 0LL);        // impossible at any length
CHECK_EQ(max_pieces({10}, 1), 10LL);
CHECK_EQ(max_pieces({10}, 10), 1LL);
CHECK_EQ(max_pieces({}, 1), 0LL);
```

## Hints
- For each one, first write `feasible(x)` — "can it be done with `x`?" — and convince yourself it is monotone before writing any search.
- `min_capacity`: simulate. Walk the weights, start a new day whenever adding the next would exceed the capacity, and return whether the day count is within budget. A capacity below the largest single weight is never feasible. Search `[max weight, total weight]`.
- `min_speed`: hours needed is the sum of `ceil(pile / speed)` over the piles. Integer ceiling division is `(pile + speed - 1) / speed`. Search `[1, largest pile]`.
- `max_pieces` searches for a **maximum**, so the monotonicity runs the other way: if length `L` yields enough pieces, so does every smaller length. Search for the largest feasible `L`, and return 0 when even `L = 1` fails.
- For a maximum, either flip the loop — `mid = lo + (hi - lo + 1) / 2` with `lo = mid` and `hi = mid - 1`, rounding *up* to avoid hanging — or search for the smallest infeasible value and subtract one. The second is easier to get right.
- `mid = lo + (hi - lo) / 2`, never `(lo + hi) / 2`.
- Sums can reach 10⁹ × the vector size, so accumulate in `long long`.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

// --- min_capacity -----------------------------------------------------
static bool ships_within(const std::vector<int>& weights, int days, long long capacity) {
    long long used = 1;
    long long load = 0;
    for (int w : weights) {
        if (w > capacity) return false;
        if (load + w > capacity) { ++used; load = 0; }
        load += w;
    }
    return used <= days;
}

long long min_capacity(const std::vector<int>& weights, int days) {
    long long lo = 1;
    long long hi = 0;
    for (int w : weights) hi += w;
    if (hi == 0) return 0;

    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (ships_within(weights, days, mid)) hi = mid;
        else                                  lo = mid + 1;
    }
    return lo;
}

// --- min_speed --------------------------------------------------------
static bool eats_within(const std::vector<int>& piles, int hours, long long speed) {
    long long needed = 0;
    for (int p : piles) needed += (p + speed - 1) / speed;   // ceiling division
    return needed <= hours;
}

long long min_speed(const std::vector<int>& piles, int hours) {
    long long lo = 1;
    long long hi = 1;
    for (int p : piles) hi = std::max(hi, static_cast<long long>(p));

    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (eats_within(piles, hours, mid)) hi = mid;
        else                                lo = mid + 1;
    }
    return lo;
}

// --- max_pieces -------------------------------------------------------
static bool yields_enough(const std::vector<int>& lengths, int count, long long piece) {
    long long pieces = 0;
    for (int len : lengths) pieces += len / piece;
    return pieces >= count;
}

long long max_pieces(const std::vector<int>& lengths, int count) {
    if (lengths.empty()) return 0;
    if (!yields_enough(lengths, count, 1)) return 0;   // impossible at any length

    // Find the smallest infeasible length, then step back one.
    long long lo = 1;
    long long hi = *std::max_element(lengths.begin(), lengths.end()) + 1;

    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (yields_enough(lengths, count, mid)) lo = mid + 1;   // still feasible
        else                                    hi = mid;
    }
    return lo - 1;
}
```

## Notes
Three problems, one technique, and the shape is identical every time: a
`feasible` function that answers a yes/no question about one candidate, and a
search that finds where the answer changes.

What makes it work is monotonicity, and it is worth stating for each rather than
assuming. **Capacity:** if a capacity of 20 ships everything in 3 days, so does
21 — a larger capacity can only ever fit more per day. **Speed:** faster never
takes longer. **Piece length:** shorter pieces can only yield more pieces. In
all three the feasible set is one contiguous block, so there is a single
boundary and binary search finds it.

The third is the one worth studying, because it searches for a **maximum** and
that is where people write hanging loops. The naive flip — `lo = mid` when
feasible — does not shrink the interval when `hi == lo + 1`, so it spins
forever. The two ways out are to round the midpoint *up* (`lo + (hi - lo + 1) / 2`)
so that `lo = mid` always advances, or to do what the solution does: search for
the smallest **in**feasible value and subtract one. The second keeps the same
loop as the other two functions, which is worth a great deal when you are
writing this under time pressure.

`max_pieces` also needs its impossible case handled before the search rather
than inside it. If length 1 does not yield enough pieces, nothing does, and the
"smallest infeasible" search would return 1, giving an answer of 0 by accident
rather than by design — which happens to be right here, and would not be if the
function were specified to return −1. Handling it explicitly says what is meant.

The ceiling division in `min_speed` is worth having in your fingers:
`(a + b - 1) / b` for non-negative integers. Writing it as
`static_cast<int>(std::ceil(double(a) / b))` compiles, is slower, and is wrong
for large values, because a `double` cannot represent every `long long` exactly
past 2⁵³ — the same fact Chapter 10.1 raised about value ranges.

The cost of all three is `log(range)` calls to `feasible`, each linear in the
input. For a range of 10⁹ that is thirty passes, which is nothing — and this is
why "I can check an answer but not construct one" is a good position to be in
rather than a bad one.
