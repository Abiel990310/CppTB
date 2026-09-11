---
id: mst-bottleneck
title: "Questions the tree answers"
difficulty: stretch
chapter: minimum-spanning-trees
topics: [graphs, mst, bottleneck, clustering]
check: unit
standard: c++20
---

Build the MST once, then answer three questions with it — none of which is
"what does the network cost".

- `bottleneck(n, edges, src, dst)` — over all routes from `src` to `dst`, the
  smallest possible value of the heaviest edge used; `-1` when there is no
  route, and `0` when `src == dst`.
- `max_spanning_weight(n, edges)` — the total weight of a **maximum** spanning
  forest.
- `cluster_gap(n, edges, k)` — split the vertices into exactly `k` clusters so
  that the smallest distance between two different clusters is as large as
  possible, and return that distance. The graph is connected and
  `1 <= k <= n`; with `k == 1` there is no pair to measure, so return `-1`.
- `component_count(n, edges)` — how many connected components the graph has.

`edges` is a list of `{u, v, w}` describing an undirected graph, possibly with
parallel edges and self-loops.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <limits>
#include <numeric>
#include <queue>
#include <utility>
#include <vector>

struct Edge { int u, v; long long w; };

struct DSU {
    std::vector<int> parent, size;
    explicit DSU(int n) : parent(n), size(n, 1) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    }
    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        return true;
    }
};

long long bottleneck(int n, std::vector<Edge> edges, int src, int dst) {
    return 0;
}

long long max_spanning_weight(int n, std::vector<Edge> edges) {
    return 0;
}

long long cluster_gap(int n, std::vector<Edge> edges, int k) {
    return 0;
}

int component_count(int n, std::vector<Edge> edges) {
    return n;
}
```

## Tests
```cpp
// A path 0-1-2-3 with one heavy step in the middle, plus a heavy shortcut.
std::vector<Edge> path = {{0, 1, 1}, {1, 2, 8}, {2, 3, 1}, {0, 3, 9}};

CHECK(bottleneck(4, path, 0, 3) == 8);       // via the middle, worst edge 8
CHECK(bottleneck(4, path, 0, 1) == 1);
CHECK(bottleneck(4, path, 1, 2) == 8);
CHECK(bottleneck(4, path, 2, 2) == 0);

// Two ways round a square: the four light edges beat the one heavy one.
std::vector<Edge> square =
    {{0, 1, 2}, {1, 2, 2}, {2, 3, 2}, {3, 0, 2}, {0, 2, 100}};
CHECK(bottleneck(4, square, 0, 2) == 2);

// Disconnected.
std::vector<Edge> split = {{0, 1, 5}, {2, 3, 5}};
CHECK(bottleneck(4, split, 0, 1) == 5);
CHECK(bottleneck(4, split, 0, 3) == -1);
CHECK(bottleneck(4, split, 3, 3) == 0);
CHECK(bottleneck(2, {}, 0, 1) == -1);

CHECK(component_count(4, split) == 2);
CHECK(component_count(4, path) == 1);
CHECK(component_count(4, {}) == 4);
CHECK(component_count(1, {}) == 1);

// Maximum spanning: on the triangle 2, 2, 3 it keeps 3 and one 2.
std::vector<Edge> triangle = {{0, 1, 2}, {1, 2, 2}, {0, 2, 3}};
CHECK(max_spanning_weight(3, triangle) == 5);
CHECK(max_spanning_weight(4, path) == 9 + 8 + 1);
CHECK(max_spanning_weight(4, split) == 10);
CHECK(max_spanning_weight(3, {}) == 0);

// A self-loop is never useful either way.
std::vector<Edge> loopy = {{0, 0, 100}, {0, 1, 4}};
CHECK(max_spanning_weight(2, loopy) == 4);
CHECK(bottleneck(2, loopy, 0, 1) == 4);

// Clustering: two tight pairs a long way apart.
std::vector<Edge> pairs =
    {{0, 1, 1}, {2, 3, 1}, {1, 2, 50}};
CHECK(cluster_gap(4, pairs, 2) == 50);       // cut the 50, gap is 50
CHECK(cluster_gap(4, pairs, 3) == 1);        // cut the 50 and one 1
CHECK(cluster_gap(4, pairs, 4) == 1);
CHECK(cluster_gap(4, pairs, 1) == -1);
CHECK(cluster_gap(1, {}, 1) == -1);

// Every vertex its own cluster when k == n, whatever the weights.
std::vector<Edge> chain = {{0, 1, 3}, {1, 2, 7}, {2, 3, 5}};
CHECK(cluster_gap(4, chain, 2) == 7);
CHECK(cluster_gap(4, chain, 3) == 5);
CHECK(cluster_gap(4, chain, 4) == 3);

// Cross-check the bottleneck against a brute-force widest-path search.
std::mt19937 rng(31337);
bool agree = true;
for (int trial = 0; trial < 300; ++trial) {
    int n = 2 + static_cast<int>(rng() % 6);
    std::vector<Edge> es;
    std::vector<std::vector<std::pair<int, long long>>> g(n);
    for (int u = 0; u < n; ++u)
        for (int v = u + 1; v < n; ++v)
            if (rng() % 100 < 50) {
                long long w = 1 + static_cast<long long>(rng() % 20);
                es.push_back({u, v, w});
                g[u].emplace_back(v, w);
                g[v].emplace_back(u, w);
            }
    const long long BIG = std::numeric_limits<long long>::max() / 4;
    for (int s = 0; s < n; ++s) {
        std::vector<long long> best(n, BIG);
        best[s] = 0;
        using Item = std::pair<long long, int>;
        std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
        pq.emplace(0, s);
        while (!pq.empty()) {
            auto [b, v] = pq.top();
            pq.pop();
            if (b != best[v]) continue;
            for (auto [to, w] : g[v]) {
                long long through = std::max(b, w);
                if (through < best[to]) {
                    best[to] = through;
                    pq.emplace(through, to);
                }
            }
        }
        for (int t = 0; t < n; ++t) {
            long long expected = best[t] >= BIG ? -1 : best[t];
            if (bottleneck(n, es, s, t) != expected) agree = false;
        }
    }
}
CHECK(agree);
```

## Hints
- All four are the same loop: sort the edges and unite. Only what you record
  differs.
- `bottleneck` — sort **ascending** and unite until `src` and `dst` share a
  root. The weight of the edge that joined them is the answer, because every
  lighter edge has already been used and could not connect them. Check
  `src == dst` before the loop, and return `-1` if the loop ends without them
  meeting.
- `max_spanning_weight` — the same as the minimum, sorting **descending**.
- `cluster_gap` — the MST edges in ascending order are exactly the merges of
  single-linkage clustering. Cutting the `k - 1` heaviest leaves `k` clusters,
  and the gap is the heaviest edge you cut... which means the answer is the
  `(k-1)`-th largest MST edge. Careful with `k == 1`.
- `component_count` is `n` minus the number of edges the forest keeps.
- A self-loop always fails `unite`, so none of these needs to special-case it.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <limits>
#include <numeric>
#include <queue>
#include <random>
#include <utility>
#include <vector>

struct Edge { int u, v; long long w; };

struct DSU {
    std::vector<int> parent, size;
    explicit DSU(int n) : parent(n), size(n, 1) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    }
    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        return true;
    }
};

// The weights of the forest's edges, ascending.
static std::vector<long long> forest_weights(int n, std::vector<Edge> edges, bool ascending) {
    std::sort(edges.begin(), edges.end(), [ascending](const Edge& a, const Edge& b) {
        return ascending ? a.w < b.w : a.w > b.w;
    });
    DSU dsu(n);
    std::vector<long long> kept;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) kept.push_back(e.w);
    return kept;
}

long long bottleneck(int n, std::vector<Edge> edges, int src, int dst) {
    if (src == dst) return 0;
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    for (const Edge& e : edges) {
        dsu.unite(e.u, e.v);
        if (dsu.find(src) == dsu.find(dst)) return e.w;
    }
    return -1;
}

long long max_spanning_weight(int n, std::vector<Edge> edges) {
    long long total = 0;
    for (long long w : forest_weights(n, std::move(edges), false)) total += w;
    return total;
}

long long cluster_gap(int n, std::vector<Edge> edges, int k) {
    if (k <= 1) return -1;
    std::vector<long long> kept = forest_weights(n, std::move(edges), true);
    if (static_cast<int>(kept.size()) < k - 1) return -1;
    // kept is ascending; the k-1 heaviest are the ones we cut, and the
    // smallest of those is the gap.
    return kept[kept.size() - static_cast<std::size_t>(k - 1)];
}

int component_count(int n, std::vector<Edge> edges) {
    return n - static_cast<int>(forest_weights(n, std::move(edges), true).size());
}
```

## Notes
One sort-and-unite loop answers all four, which is the point: an MST is not
really "the cheapest network", it is *the order in which a graph connects up as
you admit edges from cheapest to dearest*, and most of these questions are
about that order rather than about the total.

**`bottleneck`** does not even build the tree. Admitting edges in ascending
order, the moment `src` and `dst` land in the same component you are holding
the answer — every lighter edge was already available and did not connect them,
so no route can avoid one this heavy, and this route exists. That is the
chapter's minimax property in four lines, and it is why the cross-check against
a widest-path Dijkstra passes: two completely different algorithms, same answer
on every pair of 300 random graphs.

**`cluster_gap`** is single-linkage clustering, and the indexing is the part
worth slowing down for. The kept weights ascending are the merges in the order
they happened. To end with `k` clusters you refuse the last `k - 1` merges, so
the gap between the resulting clusters is the *smallest* weight you refused —
which is `kept[size - (k-1)]`, not `kept[size - 1]` and not `kept[size - k]`.
The `chain` test pins all three cases: with `k = 2` the answer is the single
heaviest MST edge, and with `k = n` it is the lightest.

**`max_spanning_weight`** is the minimum with the comparator flipped, which is
the whole content of "maximum spanning tree" as a topic. Anyone who has written
Kruskal has already written it.

**`component_count`** falls out for free: a spanning forest of a graph with `c`
components has `n - c` edges, so `c = n - taken`. If you already run Kruskal,
you never need a separate connectivity pass.

The self-loop cases exist because they are the input that breaks a hand-written
cycle check. `unite(0, 0)` finds the same root twice and returns `false`, so a
loop is rejected by the same line that rejects any other cycle-closing edge —
no special case, and a routine that adds one has usually broken something else.
