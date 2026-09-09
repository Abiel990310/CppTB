---
id: dijkstra-audit
title: "Three shortest-path searches"
difficulty: core
chapter: dijkstra
topics: [graphs, dijkstra, algorithms]
check: unit
standard: c++20
---

Three routines over a weighted graph with non-negative weights, given as
adjacency lists of `(neighbour, weight)`. Each has one bug in what it does when
an edge is examined.

- `shortest_distances(g, src)` — the distance to every vertex, `-1` where
  unreachable. Uses the unweighted-BFS test "have I seen this vertex" instead of
  "can I improve it".
- `shortest_path(g, src, dst)` — the vertices of one shortest path, in order,
  or empty when there is none. Reconstructs from the destination and forgets to
  reverse.
- `count_shortest(g, src, dst)` — how many shortest paths there are, modulo
  10⁹+7. Adds to the count when it finds a strictly better route instead of
  replacing it.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

using Graph = std::vector<std::vector<std::pair<int, long long>>>;   // (to, weight)
const long long INF = std::numeric_limits<long long>::max() / 4;
const std::uint64_t MOD = 1'000'000'007;

std::vector<long long> shortest_distances(const Graph& g, int src) {
    std::vector<long long> dist(g.size(), INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (dist[to] == INF) {                 // "not seen", not "can improve"
                dist[to] = d + w;
                pq.emplace(dist[to], to);
            }
    }
    for (long long& x : dist) if (x >= INF) x = -1;
    return dist;
}

std::vector<int> shortest_path(const Graph& g, int src, int dst) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    std::vector<int> parent(n, -1);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (d + w < dist[to]) {
                dist[to] = d + w;
                parent[to] = v;
                pq.emplace(dist[to], to);
            }
    }
    if (dist[dst] >= INF) return {};
    std::vector<int> path;
    for (int v = dst; v != -1; v = parent[v]) path.push_back(v);
    return path;                                   // still running backwards
}

std::uint64_t count_shortest(const Graph& g, int src, int dst) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    std::vector<std::uint64_t> ways(n, 0);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    ways[src] = 1;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v]) {
            if (d + w < dist[to]) {
                dist[to] = d + w;
                ways[to] = (ways[to] + ways[v]) % MOD;   // a better route is not another one
                pq.emplace(dist[to], to);
            } else if (d + w == dist[to]) {
                ways[to] = (ways[to] + ways[v]) % MOD;
            }
        }
    }
    return ways[dst];
}
```

## Tests
```cpp
// 0 ->1 (1), 1 ->3 (2), 0 ->2 (2), 2 ->3 (1), 0 ->3 (7)
const Graph diamond{{{1, 1}, {2, 2}, {3, 7}}, {{3, 2}}, {{3, 1}}, {}};

// shortest_distances
CHECK_EQ(shortest_distances(diamond, 0), (std::vector<long long>{0, 1, 2, 3}));
CHECK_EQ(shortest_distances(Graph{{{1, 5}}, {{2, 5}}, {}}, 0),
         (std::vector<long long>{0, 5, 10}));
CHECK_EQ(shortest_distances(Graph{{}, {}}, 0), (std::vector<long long>{0, -1}));
CHECK_EQ(shortest_distances(Graph{{}}, 0), (std::vector<long long>{0}));
// The direct edge 0 ->1 costs 3; going through 2 costs 2.
CHECK_EQ(shortest_distances(Graph{{{1, 3}, {2, 1}}, {{3, 1}}, {{1, 1}, {3, 5}}, {}}, 0),
         (std::vector<long long>{0, 2, 1, 3}));
CHECK_EQ(shortest_distances(Graph{{{1, 1}, {4, 10}}, {{2, 1}}, {{3, 1}}, {{4, 1}}, {}}, 0),
         (std::vector<long long>{0, 1, 2, 3, 4}));

// shortest_path
CHECK_EQ(shortest_path(diamond, 0, 3), (std::vector<int>{0, 1, 3}));
CHECK_EQ(shortest_path(diamond, 0, 0), (std::vector<int>{0}));
CHECK_EQ(shortest_path(Graph{{{1, 5}}, {{2, 5}}, {}}, 0, 2), (std::vector<int>{0, 1, 2}));
CHECK_EQ(shortest_path(Graph{{}, {}}, 0, 1), (std::vector<int>{}));
CHECK_EQ(shortest_path(Graph{{{1, 3}, {2, 1}}, {{3, 1}}, {{1, 1}, {3, 5}}, {}}, 0, 3),
         (std::vector<int>{0, 2, 1, 3}));

// count_shortest
CHECK_EQ(count_shortest(diamond, 0, 3), 2ULL);          // 0-1-3 and 0-2-3
CHECK_EQ(count_shortest(diamond, 0, 0), 1ULL);
CHECK_EQ(count_shortest(Graph{{{1, 5}}, {{2, 5}}, {}}, 0, 2), 1ULL);
CHECK_EQ(count_shortest(Graph{{}, {}}, 0, 1), 0ULL);
CHECK_EQ(count_shortest(Graph{{{1, 2}, {2, 2}}, {{2, 0}}, {}}, 0, 2), 2ULL);
CHECK_EQ(count_shortest(Graph{{{1, 1}, {4, 10}}, {{2, 1}}, {{3, 1}}, {{4, 1}}, {}}, 0, 4),
         1ULL);
```

## Hints
- With weights, the first route to a vertex need not be the cheapest. The test is `if (d + w < dist[to])` — relax, do not merely visit.
- The BFS test is correct only when every edge costs the same; here it freezes whatever route happened to arrive first. The five-vertex case where the direct edge costs 3 and the detour costs 2 is the smallest demonstration.
- `parent` walks *backwards* from the destination, so the collected vertices come out in reverse. `std::reverse(path.begin(), path.end())` before returning.
- The single-vertex path — `shortest_path(g, 0, 0)` — is `{0}`, which the reversal leaves alone but is worth checking.
- For the counts: a strictly better route makes every previously counted route obsolete, so the count is *replaced* by `ways[v]`, not added to. Only an equally good route adds.
- `ways[src] = 1` is the base case: one path from the source to itself, the empty one.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

using Graph = std::vector<std::vector<std::pair<int, long long>>>;
const long long INF = std::numeric_limits<long long>::max() / 4;
const std::uint64_t MOD = 1'000'000'007;

std::vector<long long> shortest_distances(const Graph& g, int src) {
    std::vector<long long> dist(g.size(), INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (d + w < dist[to]) {                // relax
                dist[to] = d + w;
                pq.emplace(dist[to], to);
            }
    }
    for (long long& x : dist) if (x >= INF) x = -1;
    return dist;
}

std::vector<int> shortest_path(const Graph& g, int src, int dst) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    std::vector<int> parent(n, -1);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (d + w < dist[to]) {
                dist[to] = d + w;
                parent[to] = v;
                pq.emplace(dist[to], to);
            }
    }
    if (dist[dst] >= INF) return {};
    std::vector<int> path;
    for (int v = dst; v != -1; v = parent[v]) path.push_back(v);
    std::reverse(path.begin(), path.end());        // built backwards
    return path;
}

std::uint64_t count_shortest(const Graph& g, int src, int dst) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    std::vector<std::uint64_t> ways(n, 0);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    ways[src] = 1;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v]) {
            if (d + w < dist[to]) {
                dist[to] = d + w;
                ways[to] = ways[v];                // the old routes are obsolete
                pq.emplace(dist[to], to);
            } else if (d + w == dist[to]) {
                ways[to] = (ways[to] + ways[v]) % MOD;
            }
        }
    }
    return ways[dst];
}
```

## Notes
**Weighted is not unweighted.** BFS may treat "reached" as "finalised" because
every edge costs one, so the first arrival is via a shortest route. As soon as
the weights differ that stops being true, and the test has to change from
`dist[to] == INF` to `d + w < dist[to]`.

The starter's version is subtly comfortable: it gives correct answers on graphs
where the first route found happens to be the cheapest, which includes every
graph with equal weights and most small hand-written examples. The test with a
direct edge of cost 3 and a two-step detour of cost 2 is the smallest one that
separates them.

**A parent chain runs backwards.** `parent[dst]`, `parent[parent[dst]]`, … walks
towards the source, so the vector is in reverse and has to be flipped. The
alternative — pushing to the front — is O(n) per insertion and turns an O(n)
reconstruction into O(n²).

`parent[src] == -1` is what stops the walk, which is why −1 rather than `src` is
the initial value: a self-parent would loop forever.

**Better replaces; equal adds.** When a strictly shorter route to `to` is found,
every route counted so far reached `to` by a longer path and is no longer
shortest — so the count becomes `ways[v]`, not `ways[to] + ways[v]`. Adding is
correct *only* in the equal case, and using the same line for both is the bug.

The two branches are worth writing out as a pair, because they are the template
for every "count the optimal solutions" problem:

```cpp
if      (candidate <  best[to]) { best[to] = candidate; count[to] = count[v]; }
else if (candidate == best[to])                         count[to] += count[v];
```

`ways[src] = 1` is the base case, the empty path — the same convention as
`seen[0] = 1` in chapter 10.7 and `ways[src] = 1` in chapter 10.19. And the
modulus is needed because the number of shortest paths can be exponential in the
number of vertices, even when the distance is small.
