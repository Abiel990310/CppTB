---
id: mst-audit
title: "Three spanning-tree routines"
difficulty: core
chapter: minimum-spanning-trees
topics: [graphs, mst, kruskal, prim, algorithms]
check: unit
standard: c++20
---

Three routines over an undirected weighted graph. Each has one bug, and each
bug is the kind that produces a plausible number rather than a crash.

- `mst_weight(n, edges)` — the total weight of a minimum spanning forest.
  Sorts descending, so it builds the *maximum* one.
- `mst_edge_count(n, edges)` — how many edges the forest uses, which is
  `n` minus the number of components. Counts every edge it looks at instead of
  every edge it keeps.
- `prim_weight(g)` — the same total, grown from one vertex with a heap. Adds
  the popped weight before the `inTree` test, so a stale heap entry is charged
  twice.

`edges` is a list of `{u, v, w}`; `g` is an adjacency list of `(to, weight)`.
Both describe the same undirected graph, which may be disconnected.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <queue>
#include <random>
#include <utility>
#include <vector>

struct Edge { int u, v; long long w; };
using Graph = std::vector<std::vector<std::pair<int, long long>>>;   // (to, weight)

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

long long mst_weight(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w > b.w; });   // which way?
    DSU dsu(n);
    long long total = 0;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) total += e.w;
    return total;
}

int mst_edge_count(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    int taken = 0;
    for (const Edge& e : edges) {
        dsu.unite(e.u, e.v);
        ++taken;                                   // every edge, or every keeper?
    }
    return taken;
}

long long prim_weight(const Graph& g) {
    int n = static_cast<int>(g.size());
    std::vector<char> inTree(n, 0);
    long long total = 0;
    using Item = std::pair<long long, int>;

    for (int start = 0; start < n; ++start) {
        if (inTree[start]) continue;
        std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
        pq.emplace(0, start);
        while (!pq.empty()) {
            auto [w, v] = pq.top();
            pq.pop();
            total += w;                            // charged before the check
            if (inTree[v]) continue;
            inTree[v] = 1;
            for (auto [to, weight] : g[v])
                if (!inTree[to]) pq.emplace(weight, to);
        }
    }
    return total;
}
```

## Tests
```cpp
// A triangle of 2, 2, 3: the MST drops the 3.
std::vector<Edge> triangle = {{0, 1, 2}, {1, 2, 2}, {0, 2, 3}};
Graph triangleG(3);
for (const Edge& e : triangle) {
    triangleG[e.u].emplace_back(e.v, e.w);
    triangleG[e.v].emplace_back(e.u, e.w);
}

CHECK(mst_weight(3, triangle) == 4);
CHECK(mst_edge_count(3, triangle) == 2);
CHECK(prim_weight(triangleG) == 4);

// A single vertex, no edges.
CHECK(mst_weight(1, {}) == 0);
CHECK(mst_edge_count(1, {}) == 0);
CHECK(prim_weight(Graph(1)) == 0);

// Two components: 0-1 and 2-3-4.
std::vector<Edge> forest = {{0, 1, 5}, {2, 3, 1}, {3, 4, 2}, {2, 4, 9}};
Graph forestG(5);
for (const Edge& e : forest) {
    forestG[e.u].emplace_back(e.v, e.w);
    forestG[e.v].emplace_back(e.u, e.w);
}
CHECK(mst_weight(5, forest) == 8);              // 5 + 1 + 2
CHECK(mst_edge_count(5, forest) == 3);          // 5 vertices, 2 components
CHECK(prim_weight(forestG) == 8);

// No edges at all: every vertex is its own component.
CHECK(mst_weight(4, {}) == 0);
CHECK(mst_edge_count(4, {}) == 0);
CHECK(prim_weight(Graph(4)) == 0);

// Parallel edges and a self-loop: the cheapest parallel edge wins and the
// loop is never useful.
std::vector<Edge> messy = {{0, 1, 7}, {0, 1, 3}, {1, 1, 1}, {1, 2, 4}};
Graph messyG(3);
for (const Edge& e : messy) {
    messyG[e.u].emplace_back(e.v, e.w);
    if (e.u != e.v) messyG[e.v].emplace_back(e.u, e.w);
}
CHECK(mst_weight(3, messy) == 7);               // 3 + 4
CHECK(mst_edge_count(3, messy) == 2);
CHECK(prim_weight(messyG) == 7);

// A square with a heavy diagonal, so a stale heap entry is guaranteed.
std::vector<Edge> square =
    {{0, 1, 1}, {1, 2, 1}, {2, 3, 1}, {3, 0, 1}, {0, 2, 100}};
Graph squareG(4);
for (const Edge& e : square) {
    squareG[e.u].emplace_back(e.v, e.w);
    squareG[e.v].emplace_back(e.u, e.w);
}
CHECK(mst_weight(4, square) == 3);
CHECK(mst_edge_count(4, square) == 3);
CHECK(prim_weight(squareG) == 3);

// Kruskal and Prim must agree on 400 random graphs.
std::mt19937 rng(4242);
bool agree = true;
for (int trial = 0; trial < 400; ++trial) {
    int n = 1 + static_cast<int>(rng() % 7);
    std::vector<Edge> es;
    Graph g(n);
    for (int u = 0; u < n; ++u)
        for (int v = u + 1; v < n; ++v)
            if (rng() % 100 < 45) {
                long long w = static_cast<long long>(rng() % 20);
                es.push_back({u, v, w});
                g[u].emplace_back(v, w);
                g[v].emplace_back(u, w);
            }
    if (mst_weight(n, es) != prim_weight(g)) agree = false;
}
CHECK(agree);
```

## Hints
- `mst_weight` sorts with `>`. Every other line is right.
- `mst_edge_count` counts each edge it *examines*. `unite` already returns
  whether the edge was kept.
- `prim_weight` adds `w` before it knows whether `v` is new. A vertex can sit
  in the heap several times, and every copy but the first is stale — the same
  lazy deletion as chapter 10.21.
- The forest cases are the ones that catch a routine written for connected
  graphs only. Both algorithms already loop over components; make sure your fix
  does not break that.
- A self-loop is joined to itself, so `unite` returns `false` and it is never
  taken. Nothing extra is needed for it.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <queue>
#include <random>
#include <utility>
#include <vector>

struct Edge { int u, v; long long w; };
using Graph = std::vector<std::vector<std::pair<int, long long>>>;

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

long long mst_weight(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    long long total = 0;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) total += e.w;
    return total;
}

int mst_edge_count(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    int taken = 0;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) ++taken;
    return taken;
}

long long prim_weight(const Graph& g) {
    int n = static_cast<int>(g.size());
    std::vector<char> inTree(n, 0);
    long long total = 0;
    using Item = std::pair<long long, int>;

    for (int start = 0; start < n; ++start) {
        if (inTree[start]) continue;
        std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
        pq.emplace(0, start);
        while (!pq.empty()) {
            auto [w, v] = pq.top();
            pq.pop();
            if (inTree[v]) continue;               // discard the stale copy first
            inTree[v] = 1;
            total += w;                            // the start contributes 0
            for (auto [to, weight] : g[v])
                if (!inTree[to]) pq.emplace(weight, to);
        }
    }
    return total;
}
```

## Notes
Every one of these three returns a number for every input, and none of them
crashes. That is what makes them worth practising on: an MST routine that is
wrong tends to be wrong by a plausible amount, and only a cross-check catches
it.

**The sort direction** is a one-character bug with a name: `>` builds the
*maximum* spanning tree, which is a real algorithm someone might want, so no
warning fires and no assertion trips. On the triangle it returns 5 instead of
4 — close enough to look like an off-by-one somewhere else. Note that the
maximum spanning tree is obtained exactly this way, deliberately, and every
argument in the chapter survives the reversal; the cut property becomes "the
*most expensive* edge crossing any split belongs to some maximum spanning
tree".

**Counting examined edges instead of kept ones** is the same shape. On a
connected graph the answer should be `n - 1` and instead it is `m`, which is
obviously wrong; but the routine is usually called on graphs where the two are
not far apart, and `unite` already returns the bit you need. The general form —
`n - taken` is the number of components — is worth remembering, because it
makes Kruskal a connectivity check for free.

**Charging before the `inTree` test** is the interesting one, and it is
specific to lazy deletion. The heap holds a vertex once per edge that reaches
it, so a vertex with three neighbours already in the tree appears three times.
Only the first pop is real; the rest are stale copies whose weights must not be
added. The square with the heavy diagonal exists to guarantee at least one
stale pop — vertex 2 is pushed both from vertex 1 (weight 1) and from vertex 0
(weight 100), and the expensive copy is still in the heap when it is reached
cheaply. Get this wrong and the answer is too large by however many stale
entries happened to be queued, which varies with the graph and is therefore
almost impossible to spot from a single test.

The `total += w` in the fixed version is safe on the first pop of each
component because that entry was pushed with weight 0 — the start vertex joins
free, which is what makes the loop uniform across components without a separate
case.
