---
id: floyd-warshall-audit
title: "Three loops, in the wrong order"
difficulty: core
chapter: negative-weights
topics: [graphs, floyd-warshall, algorithms]
check: unit
standard: c++20
---

Two all-pairs routines built on the same triple loop.

- `all_pairs(n, edges)` — the shortest distance between every pair, `-1` where
  there is no route. Puts the intermediate vertex `k` in the innermost loop, so
  a route through a higher-numbered vertex is never considered.
- `reachable(n, edges)` — for every pair, whether `j` can be reached from `i`
  (a vertex reaches itself). Never marks a vertex as reaching itself.

Weights are non-negative here, and edges may repeat.

## Starter
```cpp
#include <algorithm>
#include <array>
#include <cstddef>
#include <limits>
#include <vector>

using Edges = std::vector<std::array<long long, 3>>;   // {from, to, weight}
const long long INF = std::numeric_limits<long long>::max() / 4;

std::vector<std::vector<long long>> all_pairs(int n, const Edges& edges) {
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    for (int v = 0; v < n; ++v) d[v][v] = 0;
    for (const auto& e : edges) {
        int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
        d[u][v] = std::min(d[u][v], e[2]);
    }

    for (int i = 0; i < n; ++i)                        // k belongs outermost
        for (int j = 0; j < n; ++j)
            for (int k = 0; k < n; ++k)
                if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];

    for (auto& row : d) for (long long& x : row) if (x >= INF) x = -1;
    return d;
}

std::vector<std::vector<int>> reachable(int n, const Edges& edges) {
    std::vector<std::vector<int>> r(n, std::vector<int>(n, 0));
    for (const auto& e : edges)
        r[static_cast<int>(e[0])][static_cast<int>(e[1])] = 1;
    // a vertex reaches itself -- but nothing says so

    for (int k = 0; k < n; ++k)
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (r[i][k] && r[k][j]) r[i][j] = 1;
    return r;
}
```

## Tests
```cpp
using M = std::vector<std::vector<long long>>;
using B = std::vector<std::vector<int>>;

// all_pairs -- the route 0 -> 1 -> 3 -> 2 passes through a higher number
CHECK_EQ(all_pairs(4, Edges{{0, 1, 1}, {1, 3, 1}, {3, 2, 1}}),
         (M{{0, 1, 3, 2}, {-1, 0, 2, 1}, {-1, -1, 0, -1}, {-1, -1, 1, 0}}));
CHECK_EQ(all_pairs(3, Edges{{0, 1, 2}, {1, 2, 3}, {0, 2, 10}}),
         (M{{0, 2, 5}, {-1, 0, 3}, {-1, -1, 0}}));
CHECK_EQ(all_pairs(2, Edges{}), (M{{0, -1}, {-1, 0}}));
CHECK_EQ(all_pairs(1, Edges{}), (M{{0}}));
CHECK_EQ(all_pairs(4, Edges{{0, 1, 5}, {1, 2, 5}, {2, 3, 5}, {0, 3, 20}}),
         (M{{0, 5, 10, 15}, {-1, 0, 5, 10}, {-1, -1, 0, 5}, {-1, -1, -1, 0}}));

// reachable
CHECK_EQ(reachable(3, Edges{{0, 1, 1}, {1, 2, 1}}),
         (B{{1, 1, 1}, {0, 1, 1}, {0, 0, 1}}));
CHECK_EQ(reachable(2, Edges{}), (B{{1, 0}, {0, 1}}));
CHECK_EQ(reachable(1, Edges{}), (B{{1}}));
CHECK_EQ(reachable(3, Edges{{0, 1, 1}, {1, 0, 1}}),
         (B{{1, 1, 0}, {1, 1, 0}, {0, 0, 1}}));
CHECK_EQ(reachable(4, Edges{{0, 1, 1}, {1, 3, 1}, {3, 2, 1}}),
         (B{{1, 1, 1, 1}, {0, 1, 1, 1}, {0, 0, 1, 0}, {0, 0, 1, 1}}));
```

## Hints
- The invariant is: after the outer loop has processed `k = 0 … K`, `d[i][j]` is the shortest route using only those vertices as intermediates. That only holds if `k` is the **outermost** loop.
- With `k` innermost, `d[i][j]` is finalised before higher-numbered vertices have been considered as intermediates. The first test is the smallest demonstration: the route from 0 to 2 goes through vertex 3.
- The fix is to move the `k` loop outside the `i` and `j` loops. Nothing else changes.
- For `reachable`, a vertex reaches itself by the empty route, so set `r[v][v] = 1` before the loop.
- Without it, the closure can still mark `r[v][v]` when `v` lies on a cycle — which is why the two-vertex cycle case passes and the isolated-vertex ones do not.
- The transitive-closure loop is the same triple loop with `min`/`+` replaced by `||`/`&&`, and `k` belongs outermost there for exactly the same reason.

## Solution
```cpp
#include <algorithm>
#include <array>
#include <cstddef>
#include <limits>
#include <vector>

using Edges = std::vector<std::array<long long, 3>>;
const long long INF = std::numeric_limits<long long>::max() / 4;

std::vector<std::vector<long long>> all_pairs(int n, const Edges& edges) {
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    for (int v = 0; v < n; ++v) d[v][v] = 0;
    for (const auto& e : edges) {
        int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
        d[u][v] = std::min(d[u][v], e[2]);
    }

    for (int k = 0; k < n; ++k)                        // the intermediate vertex
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];

    for (auto& row : d) for (long long& x : row) if (x >= INF) x = -1;
    return d;
}

std::vector<std::vector<int>> reachable(int n, const Edges& edges) {
    std::vector<std::vector<int>> r(n, std::vector<int>(n, 0));
    for (int v = 0; v < n; ++v) r[v][v] = 1;           // the empty route
    for (const auto& e : edges)
        r[static_cast<int>(e[0])][static_cast<int>(e[1])] = 1;

    for (int k = 0; k < n; ++k)
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (r[i][k] && r[k][j]) r[i][j] = 1;
    return r;
}
```

## Notes
**The loop order is the algorithm, not a detail of it.**

Floyd–Warshall's correctness rests on one invariant: after the outermost loop
has finished iteration `K`, `d[i][j]` is the length of the shortest route from
`i` to `j` that uses only vertices `0 … K` as intermediates. Each new `k`
enlarges the permitted set by one, and *every* pair is updated against it before
the set grows again.

Move `k` inside and that ordering is destroyed. `d[i][j]` is finalised while
vertices numbered above the current `i` may not yet have been used as
intermediates at all — so a route through them is never found. The four-vertex
chain `0 → 1 → 3 → 2` shows it exactly: the distance from 0 to 2 is 3 through
vertex 3, and the wrong order reports no route at all.

Chapter 10.22 measures how often it matters: the two orders disagree on 524 of
2,000 random graphs. The other 1,476 pass, which is why this bug survives a
sample input.

**A vertex reaches itself.** The transitive closure of an empty graph is the
identity matrix, not the zero matrix. Setting `r[v][v] = 1` before the loop says
so; leaving it out makes `r[v][v]` true only when `v` happens to lie on a cycle,
which is a different relation entirely — "can return to itself by a non-empty
walk", which is sometimes the question and is not this one.

Both conventions appear in real problems. Deciding which one you want, and
writing the initialisation to match, is the entire content of that line.

**The two loops are the same algorithm.** Replace `min` with `||` and `+` with
`&&` and shortest paths become reachability. The same substitution with `max`
and `min` gives bottleneck paths (chapter 10.21), and with `+` and `×` over
probabilities it gives the chance of getting through. Floyd–Warshall is really a
statement about closed semirings; the practical version of that fact is that the
loop shape is reusable and the operations are not the point.

**Why `INF / 4`.** `d[i][k] + d[k][j]` is evaluated for pairs where both are
infinite, so the sentinel has to survive being doubled. `max() / 4` leaves room;
`max()` overflows, which is undefined behaviour rather than a large number.
