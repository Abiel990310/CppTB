---
id: judge-negative-cycle
title: "Is there a negative cycle?"
difficulty: core
chapter: negative-weights
topics: [graphs, bellman-ford, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Print `YES` if the directed graph contains a cycle of negative total weight
**anywhere**, and `NO` otherwise.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `u`, `v` and `w`: a directed edge from `u` to `v` of weight `w`.

**Output.** One line: `YES` or `NO`.

**Constraints.** `1 ≤ n ≤ 2000`, `0 ≤ m ≤ 5000`, `|w| ≤ 10⁹`. Vertices are
1-indexed.

## Starter
```cpp
#include <array>
#include <iostream>
#include <limits>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::array<long long, 3>> edges(m);
    for (auto& e : edges) {
        long long u, v, w;
        std::cin >> u >> v >> w;
        e = {u - 1, v - 1, w};
    }

    std::vector<long long> dist(n, INF);
    dist[0] = 0;                            // one starting point

    for (int round = 0; round < n; ++round) {
        bool changed = false;
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] < INF && dist[u] + e[2] < dist[v]) {
                dist[v] = dist[u] + e[2];
                changed = true;
            }
        }
        if (!changed) { std::cout << "NO\n"; return 0; }
    }

    std::cout << "YES\n";
}
```

## Cases

### Sample
```in
3 3
1 2 1
2 3 -1
3 2 -1
```
```out
YES
```

### the cycle is not reachable from vertex 1
```in
4 3
2 3 -1
3 4 -1
4 2 -1
```
```out
YES
```

### negative edges but no negative cycle
```in
4 4
1 2 1
1 3 5
3 2 -10
2 4 1
```
```out
NO
```

### a positive cycle
```in
3 3
1 2 1
2 3 1
3 1 1
```
```out
NO
```

### no edges
```in
5 0
```
```out
NO
```

### a negative self-loop
```in
2 1
2 2 -1
```
```out
YES
```

### a cycle that is exactly zero
```in
3 3
1 2 2
2 3 -1
3 2 1
```
```out
NO
```

### two components, only one bad
```in
5 4
1 2 3
3 4 -2
4 5 -2
5 3 -2
```
```out
YES
```

## Hints
- Starting from vertex 1 only finds cycles reachable from vertex 1. The question asks about the whole graph.
- Initialise **every** distance to 0. That is exactly the graph with one extra vertex joined to all the others by zero-weight edges, and it reaches every component at once.
- With every distance finite from the start, the `dist[u] < INF` guard becomes unnecessary — though it costs nothing to leave in.
- The rule stays the same: `n − 1` rounds are enough to settle a graph with no negative cycle, so an improvement in round `n` proves one exists.
- Stopping early when a round changes nothing is both an optimisation and the `NO` answer.
- Weights reach 10⁹ and paths can be 2000 edges long, so the sums reach 2 × 10¹² — `long long` throughout.

## Solution
```cpp
#include <array>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::array<long long, 3>> edges(m);
    for (auto& e : edges) {
        long long u, v, w;
        std::cin >> u >> v >> w;
        e = {u - 1, v - 1, w};
    }

    std::vector<long long> dist(n, 0);       // a virtual source joined to everything

    for (int round = 0; round < n; ++round) {
        bool changed = false;
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] + e[2] < dist[v]) {
                dist[v] = dist[u] + e[2];
                changed = true;
            }
        }
        if (!changed) { std::cout << "NO\n"; return 0; }
    }

    std::cout << "YES\n";
}
```

## Notes
One initialisation.

Bellman–Ford from a single source detects negative cycles *reachable from that
source*, which is the right question when you are computing distances from it.
Here the question is about the graph, so the search has to start everywhere.

Setting every distance to 0 is not a hack — it is precisely the graph with one
extra vertex `s` and a zero-weight edge from `s` to every vertex. In that graph
every vertex is reachable from `s`, so a negative cycle anywhere is a negative
cycle reachable from `s`, and one run finds it. The second case is the
separator: a triangle of `−1` edges among vertices 2, 3 and 4, with nothing
leaving vertex 1.

**Three things the cases pin down.**

*A negative cycle is not the same as a negative edge.* The third case has an
edge of weight −10 and no cycle at all, and the answer is `NO`. The detector must
be "still improving after `n − 1` rounds", not "some weight is negative".

*Zero is not negative.* The seventh case has a cycle of total weight 0, which
never improves anything, so the relaxation settles and the answer is `NO`. That
matters because a zero cycle leaves distances well defined — you may go round it
as often as you like without gaining.

*A self-loop is a cycle.* `2 → 2` of weight −1 is a negative cycle of length one,
and the general code handles it with no special case.

**On the early exit.** `if (!changed) return NO` is the whole of the negative
answer, and it also turns the worst case O(n·m) into something usually far
smaller: most graphs settle in a handful of rounds. Keeping it is worth more than
any micro-optimisation of the inner loop.

**On the widths.** With `|w| ≤ 10⁹` and up to 2000 vertices on a path, a distance
can reach 2 × 10¹². Reading the weights straight into `long long` makes every
later expression wide, which is the habit chapter 10.7 argues for.
