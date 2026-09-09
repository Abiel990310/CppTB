---
id: judge-count-shortest
title: "How many cheapest routes"
difficulty: stretch
chapter: dijkstra
topics: [graphs, dijkstra, counting, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Print how many distinct cheapest routes there are from city 1 to city `n`,
modulo 10⁹+7. Print `0` if there is no route at all.

Two routes are distinct if their sequences of roads differ.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `u`, `v` and `w`: a two-way road between `u` and `v` costing `w`.

**Output.** One line: the number of cheapest routes, modulo 10⁹+7.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`, `1 ≤ w ≤ 10⁹`. Roads may
repeat, and a repeated road counts as a separate route.

## Starter
```cpp
#include <cstdint>
#include <iostream>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;
const std::uint64_t MOD = 1'000'000'007;

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
    std::vector<std::uint64_t> ways(n, 0);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[0] = 0;
    ways[0] = 1;
    pq.emplace(0, 0);

    while (!pq.empty()) {
        auto [d, v] = pq.top();
        pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v]) {
            if (d + w < dist[to]) {
                dist[to] = d + w;
                ways[to] = (ways[to] + ways[v]) % MOD;   // a cheaper route is not another one
                pq.emplace(dist[to], to);
            } else if (d + w == dist[to]) {
                ways[to] = (ways[to] + ways[v]) % MOD;
            }
        }
    }

    std::cout << (dist[n - 1] >= INF ? 0 : ways[n - 1]) << '\n';
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
2
```

### only one way round
```in
5 5
1 2 1
2 3 1
3 4 1
4 5 1
1 5 10
```
```out
1
```

### an expensive route is found first
```in
4 5
1 2 3
1 3 1
3 2 1
2 4 1
3 4 5
```
```out
1
```

### two equal routes and one that is not
```in
6 7
1 2 1
2 4 1
1 3 1
3 4 1
4 6 1
1 5 5
5 6 5
```
```out
2
```

### a triangle with two equal sides
```in
3 3
1 2 2
2 3 2
1 3 4
```
```out
2
```

### repeated roads count separately
```in
4 3
1 2 1
1 2 1
2 4 1
```
```out
2
```

### no route
```in
3 1
1 2 1
```
```out
0
```

### already there
```in
1 0
```
```out
1
```

## Hints
- The count rides on the relaxation. Keep `ways[v]` alongside `dist[v]` and update both in the same place.
- When a **strictly cheaper** route to `to` is found, every route counted so far took a more expensive path and is no longer cheapest: `ways[to] = ways[v]`, replacing rather than adding.
- When an **equally cheap** route is found, add: `ways[to] += ways[v]`.
- The third case is the one that catches the difference. City 2 is first reached at cost 3 by the direct road, so `ways[2]` becomes 1; then the cheaper two-step route arrives and must *replace* that count, not add to it.
- `ways[0] = 1` is the base case — one route from city 1 to itself, the empty one — which also makes the single-city input answer 1.
- The number of cheapest routes can be exponential in `n`, which is why the answer is taken modulo 10⁹+7.

## Solution
```cpp
#include <cstdint>
#include <iostream>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;
const std::uint64_t MOD = 1'000'000'007;

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
    std::vector<std::uint64_t> ways(n, 0);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[0] = 0;
    ways[0] = 1;
    pq.emplace(0, 0);

    while (!pq.empty()) {
        auto [d, v] = pq.top();
        pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v]) {
            if (d + w < dist[to]) {
                dist[to] = d + w;
                ways[to] = ways[v];                      // the old routes are obsolete
                pq.emplace(dist[to], to);
            } else if (d + w == dist[to]) {
                ways[to] = (ways[to] + ways[v]) % MOD;   // another equally cheap one
            }
        }
    }

    std::cout << (dist[n - 1] >= INF ? 0 : ways[n - 1]) << '\n';
}
```

## Notes
Two branches, and the first one is an assignment rather than an addition.

When a strictly cheaper route to a city appears, everything counted so far
arrived by a more expensive path and stops being a cheapest route. The count
therefore *becomes* `ways[v]`; adding would keep obsolete routes in the total.
The third case is the demonstration: city 2 is reached directly at cost 3,
`ways[2]` becomes 1, and then the route through city 3 arrives at cost 2. The
answer is 1 and the starter says 2.

The pair of branches is the template for counting optimal solutions of any kind:

```cpp
if      (candidate <  best[to]) { best[to] = candidate; count[to] = count[v]; }
else if (candidate == best[to])                         count[to] += count[v];
```

It appears again in chapter 10.26's dynamic programming, where the same
distinction is between a better transition and an equally good one.

**Why the counts are correct even though a vertex can be relaxed many times.**
When `v` is popped with `d == dist[v]`, `dist[v]` is final — that is Dijkstra's
guarantee for non-negative weights — and so is `ways[v]`, because every route to
`v` passes through vertices that were popped earlier and had already contributed.
Each vertex therefore hands out its count exactly once, at the moment it is
popped, and the count it hands out is complete.

That argument fails with zero-weight edges pointing between vertices at the same
distance, which is why the constraints here say `1 ≤ w`. With zero weights the
safe route is to compute the distances first, then count along the shortest-path
DAG in order of distance.

**Two other things.** `ways[0] = 1` is the empty route, which makes the
single-city input answer 1 with no special case. And the modulus is not
decoration: a graph of `k` diamonds in a row has 2ᵏ cheapest routes, so at
n = 2 × 10⁵ the true count has tens of thousands of digits.
