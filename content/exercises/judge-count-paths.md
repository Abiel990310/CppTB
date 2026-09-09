---
id: judge-count-paths
title: "Routes through a network"
difficulty: core
chapter: topological-order
topics: [graphs, topological-sort, dynamic-programming, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Count the distinct directed paths from vertex 1 to vertex `n` in an acyclic
graph. Print the count modulo 10⁹+7.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `u` and `v`, a directed edge from `u` to `v`. The graph is acyclic.
The vertices are **not** guaranteed to be numbered in any particular order.

**Output.** One line: the number of paths, modulo 10⁹+7.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`.

## Starter
```cpp
#include <cstdint>
#include <iostream>
#include <vector>

const std::uint64_t MOD = 1'000'000'007;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
    }

    std::vector<std::uint64_t> ways(n, 0);
    ways[0] = 1;

    for (int v = 0; v < n; ++v)              // in which order are these final?
        if (ways[v])
            for (int w : g[v]) ways[w] = (ways[w] + ways[v]) % MOD;

    std::cout << ways[n - 1] << '\n';
}
```

## Cases

### Sample
```in
4 5
1 2
1 3
1 4
2 4
3 4
```
```out
3
```

### the numbering runs against the flow
```in
4 3
1 3
3 2
2 4
```
```out
1
```

### a detour through a higher number
```in
5 4
1 4
4 3
3 5
1 5
```
```out
2
```

### a simple chain
```in
4 3
1 2
2 3
3 4
```
```out
1
```

### no route at all
```in
2 0
```
```out
0
```

### one vertex
```in
1 0
```
```out
1
```

### a triangle of routes
```in
3 3
1 2
1 3
2 3
```
```out
2
```

### branches that rejoin
```in
5 5
1 2
1 3
2 5
3 5
2 3
```
```out
3
```

## Hints
- The DP is right: `ways[w] += ways[v]` for every edge. What matters is that `ways[v]` is final before the edge is used.
- Looping over vertices by index gives that guarantee only when every edge runs from a lower number to a higher one — which the statement explicitly does *not* promise.
- Compute a topological order first (Kahn's algorithm: in-degrees, a queue, take whatever is ready) and sweep in that order.
- The second case is the smallest counterexample: the flow is 1 → 3 → 2 → 4, so processing vertex 2 before vertex 3 loses the route entirely.
- Reduce modulo 10⁹+7 after every addition. The counts are Fibonacci-sized on a ladder-shaped graph and have no representation otherwise.
- `ways[0] = 1` is the base case: there is exactly one path from vertex 1 to itself, the empty one. A single-vertex graph therefore answers 1.

## Solution
```cpp
#include <cstdint>
#include <iostream>
#include <queue>
#include <vector>

const std::uint64_t MOD = 1'000'000'007;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> g(n);
    std::vector<int> indeg(n, 0);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
        ++indeg[v - 1];
    }

    std::queue<int> ready;                   // Kahn: a topological order
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);
    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }

    std::vector<std::uint64_t> ways(n, 0);
    ways[0] = 1;
    for (int v : order)                      // every predecessor is now final
        if (ways[v])
            for (int w : g[v]) ways[w] = (ways[w] + ways[v]) % MOD;

    std::cout << ways[n - 1] << '\n';
}
```

## Notes
The recurrence is correct and the sweep order is not.

A DP over a DAG works because a vertex is processed only once every vertex that
can reach it is final. Index order provides that when — and only when — every
edge runs from a smaller number to a larger one. Many problems are generated that
way and many are not, and this one says so explicitly in the constraints, which
is the sentence to read.

The second case makes it concrete. The flow is 1 → 3 → 2 → 4, so an index-order
sweep handles vertex 2 while `ways[2]` is still 0, then reaches vertex 3 and sets
`ways[2]` to 1 — too late for the edge 2 → 4, which has already been processed.
The answer comes out 0 where it is 1.

**The fix is a topological order**, computed with Kahn's algorithm: count
in-degrees, start from the vertices with none, and release a vertex when its last
prerequisite is emitted. Chapter 10.19 shows the DFS-based alternative; either
gives the guarantee the DP needs.

**Read for the gift.** When a statement says "each edge goes from a
lower-numbered vertex to a higher-numbered one", the plain loop is correct and
the sort is wasted work. That sentence is a common and deliberate simplification,
and noticing it saves both code and time. Its absence, as here, is equally
deliberate.

**Why modulo.** A ladder-shaped DAG — every vertex joined to the next two — has
Fibonacci-many paths, so 200,000 vertices give a number with about 40,000 digits.
Reducing after every addition is the only reason the count fits in a register at
all, and it is why counting problems specify a modulus rather than to be
awkward.

**The base case.** `ways[0] = 1` says there is exactly one path from vertex 1 to
itself: the empty one. That makes the single-vertex input answer 1 with no
special case, and it is the same convention as the empty subset in chapter 10.12
and the leading zero in chapter 10.7.
