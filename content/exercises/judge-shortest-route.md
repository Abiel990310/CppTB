---
id: judge-shortest-route
title: "The cheapest route"
difficulty: core
chapter: dijkstra
topics: [graphs, dijkstra, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Print the cost of the cheapest route from city 1 to city `n`, or `-1` if there
is none.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `u`, `v` and `w`: a two-way road between cities `u` and `v` costing
`w`.

**Output.** One line: the cheapest total cost, or `-1`.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`, `0 ≤ w ≤ 10⁹`. Roads may
repeat.

## Starter
```cpp
#include <iostream>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<std::pair<int, long long>>> g(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        long long w;
        std::cin >> u >> v >> w;
        g[u - 1].emplace_back(v - 1, w);
        g[v - 1].emplace_back(u - 1, w);
    }

    std::vector<long long> dist(n, INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[0] = 0;
    pq.emplace(0, 0);

    while (!pq.empty()) {
        auto [d, v] = pq.top();
        pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (dist[to] == INF) {              // seen, or improvable?
                dist[to] = d + w;
                pq.emplace(dist[to], to);
            }
    }

    std::cout << (dist[n - 1] >= INF ? -1 : dist[n - 1]) << '\n';
}
```

## Cases

### Sample
```in
4 5
1 2 1
2 4 2
1 3 2
3 4 1
1 4 7
```
```out
3
```

### the detour is cheaper than the direct road
```in
4 5
1 2 3
1 3 1
3 2 1
2 4 1
3 4 5
```
```out
3
```

### a long way round beats one big road
```in
5 5
1 2 1
2 3 1
3 4 1
4 5 1
1 5 10
```
```out
4
```

### no route
```in
3 1
1 2 1
```
```out
-1
```

### already there
```in
1 0
```
```out
0
```

### a cost no int can hold
```in
4 3
1 2 1000000000
2 3 1000000000
3 4 1000000000
```
```out
3000000000
```

### repeated roads
```in
4 3
1 2 1
1 2 1
2 4 1
```
```out
2
```

### a single road
```in
2 1
1 2 1000000000
```
```out
1000000000
```

## Hints
- With weights, the first time a city is reached is not necessarily by the cheapest route. The test must be `if (d + w < dist[to])` — relax, not "have I seen this".
- The BFS test is right only when every edge costs the same. The second case is the smallest counterexample: reaching city 2 directly costs 3, and going via city 3 costs 2.
- Everything else in the starter is already right: `std::greater<>` for a min-heap, `(distance, vertex)` in that order, and the stale-entry skip.
- The distances reach 2 × 10⁵ roads of 10⁹ each, or 2 × 10¹⁴ — `long long`, not `int`.
- `INF` is `max() / 4` rather than `max()` so that `d + w` cannot overflow when a large tentative distance is extended.
- City 1 to itself costs 0, and the general code says so without a special case.

## Solution
```cpp
#include <iostream>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<std::pair<int, long long>>> g(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        long long w;
        std::cin >> u >> v >> w;
        g[u - 1].emplace_back(v - 1, w);
        g[v - 1].emplace_back(u - 1, w);
    }

    std::vector<long long> dist(n, INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[0] = 0;
    pq.emplace(0, 0);

    while (!pq.empty()) {
        auto [d, v] = pq.top();
        pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (d + w < dist[to]) {             // a cheaper route to `to`
                dist[to] = d + w;
                pq.emplace(dist[to], to);
            }
    }

    std::cout << (dist[n - 1] >= INF ? -1 : dist[n - 1]) << '\n';
}
```

## Notes
One condition. `dist[to] == INF` asks "have I reached this city before"; the
question is "can I reach it more cheaply than I have so far".

They are the same question only when every edge costs the same, which is the
case BFS handles. Once the weights differ, the first arrival at a city can be by
an expensive route — and freezing it there is exactly what the starter does. The
second case is the smallest input that shows it: the direct road to city 2 costs
3, the two-step route costs 2, and the starter finds only the first.

The bug is easy to reach for, because chapter 10.17's BFS *does* write
`if (dist[to] == -1)` and is correct. What licenses that line there is the
uniform weight, not the fact that it is a graph search.

**What the rest of the loop already gets right**, and why each piece is there:

- **`std::greater<>`** makes `std::priority_queue` a min-heap. The default
  max-heap expands the most distant city first and finds nothing useful.
- **`(distance, vertex)`**, in that order, so pairs compare on distance.
- **`if (d != dist[v]) continue;`** discards stale copies. C++ has no
  decrease-key, so an improved distance is pushed as a second entry and the old
  one is skipped when it surfaces — chapter 10.21 measures 37% of pops being
  stale on a large graph.

**Two widths.** With 2 × 10⁵ roads of cost 10⁹, a route can cost 2 × 10¹⁴, so
`dist` is `long long` and so is `w` as it is read. And `INF` is `max() / 4`
rather than `max()`: the expression `d + w` is evaluated before the comparison,
and adding to `max()` would overflow — undefined behaviour, not a large number.

**On the alternatives.** With all weights equal this is BFS in O(n + m); with
weights of 0 and 1 it is a deque BFS; with small integer weights, bucket queues
(Dial's algorithm) beat the heap. The general non-negative case is what Dijkstra
is for, and the log factor is the price.
