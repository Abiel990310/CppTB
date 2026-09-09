---
id: memoise-it
title: "Two caches that remember too much"
difficulty: core
chapter: recursion-and-backtracking
topics: [recursion, memoisation, algorithms]
check: unit
standard: c++20
---

Two memoised recursions. Both are fast and both are wrong, in the two ways a
cache can be wrong: it outlives the problem it was built for, or its key does
not identify the state.

- `climb_ways(n, steps)` — the number of ordered ways to reach exactly `n` by
  repeatedly adding one of the given step sizes. Caches in a `static` local, so
  a second call with different steps reads the first call's answers.
- `grid_paths(rows, cols, blocked)` — the number of monotone paths from the
  top-left to the bottom-right of a grid, moving only down or right, avoiding
  the blocked cells. Keys the cache on the row alone.

Both functions may be called any number of times, in any order.

## Starter
```cpp
#include <cstddef>
#include <utility>
#include <vector>

long long climb_ways(int n, const std::vector<int>& steps) {
    static std::vector<long long> memo;              // survives every call
    if (static_cast<int>(memo.size()) < n + 1) memo.assign(n + 1, -1);

    auto go = [&](auto&& self, int remaining) -> long long {
        if (remaining == 0) return 1;
        if (remaining < 0) return 0;
        long long& slot = memo[remaining];
        if (slot >= 0) return slot;
        long long total = 0;
        for (int s : steps) total += self(self, remaining - s);
        return slot = total;
    };
    return go(go, n);
}

long long grid_paths(int rows, int cols,
                     const std::vector<std::pair<int, int>>& blocked) {
    std::vector<std::vector<bool>> wall(rows, std::vector<bool>(cols, false));
    for (auto [r, c] : blocked) wall[r][c] = true;

    std::vector<long long> memo(rows, -1);           // one slot per row

    auto go = [&](auto&& self, int r, int c) -> long long {
        if (r >= rows || c >= cols || wall[r][c]) return 0;
        if (r == rows - 1 && c == cols - 1) return 1;
        long long& slot = memo[r];
        if (slot >= 0) return slot;
        return slot = self(self, r + 1, c) + self(self, r, c + 1);
    };
    return go(go, 0, 0);
}
```

## Tests
```cpp
// climb_ways -- note the repeated calls with different steps
CHECK_EQ(climb_ways(4, {1, 2}), 5LL);
CHECK_EQ(climb_ways(4, {1, 2, 3}), 7LL);       // same n, different steps
CHECK_EQ(climb_ways(4, {1, 2}), 5LL);          // and back again
CHECK_EQ(climb_ways(0, {1, 2}), 1LL);          // the empty way
CHECK_EQ(climb_ways(1, {2}), 0LL);
CHECK_EQ(climb_ways(10, {1, 2}), 89LL);
CHECK_EQ(climb_ways(10, {2, 3}), 7LL);
CHECK_EQ(climb_ways(7, {1, 3, 5}), 12LL);
CHECK_EQ(climb_ways(5, {5}), 1LL);
CHECK_EQ(climb_ways(6, {2}), 1LL);

// grid_paths
CHECK_EQ(grid_paths(3, 3, {}), 6LL);
CHECK_EQ(grid_paths(3, 3, {{1, 1}}), 2LL);
CHECK_EQ(grid_paths(1, 1, {}), 1LL);
CHECK_EQ(grid_paths(2, 2, {{0, 1}}), 1LL);
CHECK_EQ(grid_paths(4, 5, {{1, 2}, {2, 3}}), 9LL);
CHECK_EQ(grid_paths(3, 3, {{0, 0}}), 0LL);
CHECK_EQ(grid_paths(5, 5, {}), 70LL);
CHECK_EQ(grid_paths(1, 6, {}), 1LL);
```

## Hints
- A `static` local lives for the whole program, so it carries answers from one call into the next. Here the answers depend on `steps`, which the next call may change — make the cache a plain local instead.
- The `memo.size() < n + 1` test does not help: a later call with a *smaller* `n` leaves the old contents in place, and a later call with a bigger `n` throws away work it could have kept. Neither is the bug's fix.
- For `grid_paths`, the answer depends on the row **and** the column. A one-dimensional cache says `(0, 2)` and `(0, 0)` have the same answer, and they do not.
- Make it `std::vector<std::vector<long long>> memo(rows, std::vector<long long>(cols, -1));` and key it on `memo[r][c]`.
- `-1` works as the "not computed yet" marker because every real answer is a non-negative count. When 0 is a legitimate answer — and it is, for a fully blocked grid — a sentinel of 0 would silently recompute forever.
- Check the cache after the base cases, not before: `(rows-1, cols-1)` and the out-of-range coordinates must answer without consulting it.

## Solution
```cpp
#include <cstddef>
#include <utility>
#include <vector>

long long climb_ways(int n, const std::vector<int>& steps) {
    std::vector<long long> memo(n + 1, -1);          // per call, not per program

    auto go = [&](auto&& self, int remaining) -> long long {
        if (remaining == 0) return 1;
        if (remaining < 0) return 0;
        long long& slot = memo[remaining];
        if (slot >= 0) return slot;
        long long total = 0;
        for (int s : steps) total += self(self, remaining - s);
        return slot = total;
    };
    return go(go, n);
}

long long grid_paths(int rows, int cols,
                     const std::vector<std::pair<int, int>>& blocked) {
    std::vector<std::vector<bool>> wall(rows, std::vector<bool>(cols, false));
    for (auto [r, c] : blocked) wall[r][c] = true;

    // The state is (row, column), so the cache is indexed by both.
    std::vector<std::vector<long long>> memo(rows, std::vector<long long>(cols, -1));

    auto go = [&](auto&& self, int r, int c) -> long long {
        if (r >= rows || c >= cols || wall[r][c]) return 0;
        if (r == rows - 1 && c == cols - 1) return 1;
        long long& slot = memo[r][c];
        if (slot >= 0) return slot;
        return slot = self(self, r + 1, c) + self(self, r, c + 1);
    };
    return go(go, 0, 0);
}
```

## Notes
A memo table is a claim: *the answer for this key is always this value*. Both
bugs are that claim being false.

**The cache that outlives its problem.** `static` inside a function is
tempting — it avoids reallocating the table on every call, which looks like an
optimisation. But the values cached depend on `steps`, and `steps` is an
argument. The second test asks for `climb_ways(4, {1, 2, 3})` right after
`climb_ways(4, {1, 2})`, and the starter returns 5 instead of 7 without doing
any work at all: every slot is already filled from the previous call.

This is not a contrived case. A global or `static` DP table is *standard*
practice in competitive programming, and it is correct exactly when the table is
cleared between test cases — which is why multi-test-case problems (chapter
10.3) break so many otherwise-correct solutions. The rule: **if the table is
reused, clearing it is part of the algorithm**, and clearing costs O(states),
which must be inside your complexity budget.

**The cache whose key is not the state.** `grid_paths` recursion depends on `r`
and `c`; a cache indexed by `r` alone asserts that every cell in a row has the
same answer. On a 3 × 3 grid it returns 9 instead of 6, having decided that
`(0, 1)` and `(0, 2)` are the same subproblem.

The discipline that prevents this is mechanical: **write down the arguments the
recursive function actually branches on, and make the cache exactly that
shape.** If the function reads `rows`, `cols` and `wall` too, those are fine —
they are constant for the whole call. It is the *varying* arguments that form
the key.

**Why `-1` and not `0`.** The sentinel must be a value the answer can never
take. Counts are non-negative, so `-1` works and `0` does not — `grid_paths(3, 3,
{{0, 0}})` is legitimately 0, and with a 0 sentinel that cell would be
recomputed every time it was reached. That costs correctness nothing and time
everything, which is the worst kind of bug to find. When no impossible value
exists, use a separate `std::vector<bool> done`.

**Check the cache after the base cases.** In both solutions the out-of-range and
terminal checks come first. Consulting `memo[r][c]` before checking `r >= rows`
would index out of bounds; consulting it before the terminal case would be
harmless but pointless. Base cases first, cache second, recursion third — in
that order, every time.
