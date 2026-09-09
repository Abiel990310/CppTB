---
id: dag-dp
title: "Two sweeps over a DAG"
difficulty: core
chapter: topological-order
topics: [graphs, topological-sort, dynamic-programming, algorithms]
check: unit
standard: c++20
---

Two dynamic programs over a directed acyclic graph. Both have the right
recurrence and sweep in the wrong order, or forget part of it.

- `count_paths(n, g, src, dst)` — the number of distinct paths from `src` to
  `dst`, modulo 10⁹+7. Relaxes the vertices in index order rather than
  topological order, which is only the same thing when the input happens to be
  numbered conveniently.
- `makespan(n, g, duration)` — every vertex is a task taking `duration[v]` time
  that may start only once all its predecessors have finished; return the time
  at which the last task finishes. Propagates a predecessor's finish time
  without adding the successor's own duration.

The graph is guaranteed acyclic.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <queue>
#include <vector>

const std::uint64_t MOD = 1'000'000'007;

std::vector<int> topological_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];
    std::queue<int> ready;
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);
    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    return order;
}

std::uint64_t count_paths(int n, const std::vector<std::vector<int>>& g,
                          int src, int dst) {
    std::vector<std::uint64_t> ways(n, 0);
    ways[src] = 1;
    for (int v = 0; v < n; ++v)                    // index order, not topological
        if (ways[v])
            for (int w : g[v]) ways[w] = (ways[w] + ways[v]) % MOD;
    return ways[dst];
}

long long makespan(int n, const std::vector<std::vector<int>>& g,
                   const std::vector<int>& duration) {
    std::vector<long long> finish(n);
    for (int v = 0; v < n; ++v) finish[v] = duration[v];

    for (int v : topological_order(n, g))
        for (int w : g[v])
            finish[w] = std::max(finish[w], finish[v]);   // w's own duration is lost

    return *std::max_element(finish.begin(), finish.end());
}
```

## Tests
```cpp
using G = std::vector<std::vector<int>>;

// count_paths
CHECK_EQ(count_paths(4, G{{1, 2, 3}, {3}, {3}, {}}, 0, 3), 3ULL);
CHECK_EQ(count_paths(4, G{{1}, {2}, {3}, {}}, 0, 3), 1ULL);
CHECK_EQ(count_paths(3, G{{1}, {2}, {}}, 0, 2), 1ULL);
CHECK_EQ(count_paths(3, G{{1, 2}, {2}, {}}, 0, 2), 2ULL);
CHECK_EQ(count_paths(2, G{{}, {}}, 0, 1), 0ULL);
CHECK_EQ(count_paths(1, G{{}}, 0, 0), 1ULL);
CHECK_EQ(count_paths(5, G{{1, 2}, {3}, {3}, {4}, {}}, 0, 4), 2ULL);
// The vertices are numbered against the flow: 3 -> 1 -> 0 -> 2.
CHECK_EQ(count_paths(4, G{{2}, {0}, {}, {1}}, 3, 2), 1ULL);

// A 200-vertex ladder: the count is Fibonacci-sized, so the modulus matters.
std::vector<std::vector<int>> ladder(200);
for (int v = 0; v + 1 < 200; ++v) {
    ladder[v].push_back(v + 1);
    if (v + 2 < 200) ladder[v].push_back(v + 2);
}
CHECK_EQ(count_paths(200, ladder, 0, 199), 349361645ULL);

// makespan
CHECK_EQ(makespan(4, G{{1, 2}, {3}, {3}, {}}, {3, 2, 4, 1}), 8LL);
CHECK_EQ(makespan(1, G{{}}, {5}), 5LL);
CHECK_EQ(makespan(3, G{{1}, {2}, {}}, {1, 1, 1}), 3LL);
CHECK_EQ(makespan(4, G{{}, {0}, {1}, {2}}, {1, 2, 3, 4}), 10LL);
CHECK_EQ(makespan(2, G{{}, {}}, {7, 3}), 7LL);
CHECK_EQ(makespan(5, G{{1, 2}, {3}, {3}, {4}, {}}, {1, 2, 3, 4, 5}), 13LL);
```

## Hints
- A DP over a DAG is only correct if every vertex is final before it is used. That is what a topological order guarantees and what index order does not.
- Index order happens to work whenever every edge runs from a smaller number to a larger one — which is how most hand-written test graphs are numbered, and not something a problem promises.
- `{{2}, {0}, {}, {1}}` with source 3 is the case that says so: the flow is 3 → 1 → 0 → 2, exactly against the numbering.
- Reuse the `topological_order` helper that is already there: `for (int v : topological_order(n, g))`.
- `makespan` should propagate `finish[v] + duration[w]`, since `w` cannot start before `v` ends and then takes its own time.
- Seeding `finish[v] = duration[v]` is right for a task with no predecessors, and the relaxation has to keep the `+ duration[w]` for everything else.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <queue>
#include <vector>

const std::uint64_t MOD = 1'000'000'007;

std::vector<int> topological_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];
    std::queue<int> ready;
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);
    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    return order;
}

std::uint64_t count_paths(int n, const std::vector<std::vector<int>>& g,
                          int src, int dst) {
    std::vector<std::uint64_t> ways(n, 0);
    ways[src] = 1;
    for (int v : topological_order(n, g))          // every predecessor is final
        if (ways[v])
            for (int w : g[v]) ways[w] = (ways[w] + ways[v]) % MOD;
    return ways[dst];
}

long long makespan(int n, const std::vector<std::vector<int>>& g,
                   const std::vector<int>& duration) {
    std::vector<long long> finish(n);
    for (int v = 0; v < n; ++v) finish[v] = duration[v];

    for (int v : topological_order(n, g))
        for (int w : g[v])
            finish[w] = std::max(finish[w], finish[v] + duration[w]);

    return *std::max_element(finish.begin(), finish.end());
}
```

## Notes
**The order is the algorithm.** A DAG DP works because when a vertex is
processed, every vertex that can influence it is already final. Index order
provides that guarantee only if the input is numbered so that every edge runs
forwards — which is a property of the *test data*, not of the problem.

That is what makes this bug dangerous: it passes almost every graph you write by
hand, because people number vertices in the direction the arrows point. The
fourth test numbers them against the flow, and the starter returns 0 where the
answer is 1: `ways[3]` is set to 1 only after vertices 0, 1 and 2 have already
been processed with a value of 0.

If you *know* the input is numbered topologically — some problems say "each edge
goes from a lower-numbered task to a higher-numbered one" — then the plain loop
is correct and the sort is wasted work. Read for that sentence; it is a common
gift.

**A recurrence has to be complete.** `finish[w] = max(finish[w], finish[v])`
says "w cannot finish before v does", which is true and is not the recurrence.
The task takes its own time on top: `finish[v] + duration[w]`. On the chain
`3 → 2 → 1 → 0` with durations 1, 2, 3, 4 the answer is 4 + 3 + 2 + 1 = 10, and
the starter reports 4 — the largest single duration, which is exactly what
propagating without adding computes.

Two small things worth keeping:

- **The seed encodes the base case.** `finish[v] = duration[v]` is the right
  answer for a vertex with no predecessors, and the sweep only ever raises it.
  Seeding with 0 instead would require a separate pass to fix the sources.
- **`if (ways[v])` in the counting version** keeps unreachable vertices at zero.
  Without it nothing breaks — adding zero changes nothing — but it makes the
  intent explicit and saves the inner loop over a vertex that cannot contribute.

**Why the modulus is not optional.** The 200-vertex ladder has Fibonacci(200)
paths, which is about 4.5 × 10⁴¹ — beyond any built-in integer type. Reducing
after every addition keeps the value small and is the only reason the count fits
at all. That is the usual reason a counting problem says "modulo 10⁹+7": not to
be awkward, but because the true answer has no representation.
