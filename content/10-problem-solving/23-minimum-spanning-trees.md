---
title: "Minimum spanning trees"
navTitle: "Spanning trees"
summary: >-
  Connect everything for the least total weight. Two greedy algorithms that
  always agree, a property that is not shortest paths, and one that is more
  useful than it looks.
objectives:
  - Write Kruskal with union-find and Prim with a heap
  - Say why the greedy choice is safe, using the cut property
  - Show that an MST does not contain shortest paths
  - Use the MST to answer bottleneck questions
status: complete
standard: c++20
requires: [negative-weights]
---

The last three chapters asked how cheaply you can get from one place to
another. This one asks something different: how cheaply can you connect
*everything*.

Given a connected weighted graph, a **spanning tree** is a subset of the edges
that keeps every vertex reachable and contains no cycle — exactly `n - 1` edges
for `n` vertices. A **minimum** spanning tree is one whose total weight is as
small as possible. Laying cable, clustering points, building a network with no
redundant links: all the same question.

Two algorithms solve it, both greedy, both from the 1950s, and they always
produce the same weight.

## Two algorithms, one answer

```cpp run title="Kruskal and Prim, cross-checked on 3,000 random graphs"
#include <algorithm>
#include <cstdio>
#include <numeric>
#include <queue>
#include <random>
#include <vector>

struct Edge { int u, v; long long w; };

struct DSU {                                    // chapter 10.20
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

// Kruskal: sort every edge, keep the ones joining two different components.
std::pair<long long, int> kruskal(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    long long total = 0;
    int taken = 0;
    for (const Edge& e : edges) {
        if (dsu.unite(e.u, e.v)) {
            total += e.w;
            ++taken;
        }
    }
    return {total, taken};
}

// Prim: grow one tree, always adding the cheapest edge that leaves it.
std::pair<long long, int> prim(int n,
        const std::vector<std::vector<std::pair<int, long long>>>& g) {
    std::vector<char> inTree(n, 0);
    long long total = 0;
    int taken = 0;
    using Item = std::pair<long long, int>;                 // (weight, vertex)

    for (int start = 0; start < n; ++start) {
        if (inTree[start]) continue;                        // a new component
        std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
        pq.emplace(0, start);
        bool first = true;
        while (!pq.empty()) {
            auto [w, v] = pq.top();
            pq.pop();
            if (inTree[v]) continue;                        // lazy deletion again
            inTree[v] = 1;
            if (!first) { total += w; ++taken; }
            first = false;
            for (auto [to, weight] : g[v])
                if (!inTree[to]) pq.emplace(weight, to);
        }
    }
    return {total, taken};
}

int main() {
    std::mt19937 rng(23);
    bool agree = true;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 8);
        std::vector<Edge> edges;
        std::vector<std::vector<std::pair<int, long long>>> g(n);
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 45) {
                    long long w = static_cast<long long>(rng() % 20);
                    edges.push_back({u, v, w});
                    g[u].push_back({v, w});
                    g[v].push_back({u, w});
                }
        if (kruskal(n, edges) != prim(n, g)) agree = false;
    }
    std::printf("3,000 random graphs, Kruskal and Prim agree: %s\n",
                agree ? "yes" : "NO");
}
```

Two completely different strategies. **Kruskal** ignores connectivity and sorts
by weight, taking any edge that does not close a cycle — union-find from
chapter 10.20 is what makes "does not close a cycle" cost almost nothing.
**Prim** ignores weight order and grows a single tree, taking the cheapest edge
that leaves it — which is Dijkstra's loop from chapter 10.21 with one thing
changed.

That one thing is worth stating precisely. Dijkstra pushes `d + e.weight`: the
distance from the source. Prim pushes `e.weight`: the cost of the edge alone.
Everything else — the heap, the lazy deletion, the `inTree` check — is
identical. If you can write one you can write the other, and confusing them
gives an algorithm that computes neither.

Both loop over components, so both handle a **disconnected** graph by returning
a spanning *forest*. The edge count tells you which you got: `n - 1` means a
tree, and anything less means `n - taken` components.

## Why greedy is safe

Greedy algorithms usually are not (chapter 10.13). This one is, and the reason
is the **cut property**:

> Take any way of splitting the vertices into two non-empty groups. The
> cheapest edge crossing that split belongs to some minimum spanning tree.

The argument is an exchange, exactly as in chapter 10.13. Suppose `e` is the
cheapest edge crossing the split and some MST `T` does not contain it. Adding
`e` to `T` creates a cycle, and that cycle must cross the split a second time,
on some other edge `f`. Swap them: `T - f + e` is still a spanning tree, and
since `e` is the cheapest crossing edge, `weight(e) <= weight(f)`, so the new
tree is no heavier. Repeat until the tree contains `e`.

Both algorithms are that property applied over and over. Prim's split is
"in the tree so far" against "everything else", and it takes the cheapest edge
crossing it — directly the cut property. Kruskal's is subtler: when it accepts
an edge, that edge is the cheapest one crossing the split between the two
components it joins, because every cheaper edge has already been considered and
either taken or rejected as internal.

The mirror image is the **cycle property**: the *heaviest* edge on any cycle
can always be left out. That is what Kruskal's rejection step is doing.

## What an MST is not

The commonest mistake is to assume the MST contains shortest paths. It does
not:

```cpp run title="Three vertices, and a route that gets longer"
#include <algorithm>
#include <cstdio>
#include <limits>
#include <numeric>
#include <queue>
#include <vector>

struct Edge { int u, v; long long w; };

struct DSU {
    std::vector<int> parent;
    explicit DSU(int n) : parent(n) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    }
    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        parent[b] = a;
        return true;
    }
};

const long long INF = std::numeric_limits<long long>::max() / 4;

std::vector<Edge> mstEdges(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    std::vector<Edge> tree;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) tree.push_back(e);
    return tree;
}

std::vector<long long> dijkstra(int n,
        const std::vector<std::vector<std::pair<int, long long>>>& g, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top();
        pq.pop();
        if (d != dist[v]) continue;
        for (auto [to, w] : g[v])
            if (d + w < dist[to]) {
                dist[to] = d + w;
                pq.emplace(dist[to], to);
            }
    }
    return dist;
}

int main() {
    const int n = 3;
    std::vector<Edge> edges = {{0, 1, 2}, {1, 2, 2}, {0, 2, 3}};

    std::vector<std::vector<std::pair<int, long long>>> g(n);
    for (const Edge& e : edges) {
        g[e.u].push_back({e.v, e.w});
        g[e.v].push_back({e.u, e.w});
    }

    std::vector<Edge> tree = mstEdges(n, edges);
    long long total = 0;
    std::printf("MST edges:");
    for (const Edge& e : tree) {
        std::printf(" (%d-%d weight %lld)", e.u, e.v, e.w);
        total += e.w;
    }
    std::printf("   total %lld\n", total);

    std::vector<std::vector<std::pair<int, long long>>> treeGraph(n);
    for (const Edge& e : tree) {
        treeGraph[e.u].push_back({e.v, e.w});
        treeGraph[e.v].push_back({e.u, e.w});
    }

    std::printf("distance 0 to 2 in the graph: %lld\n", dijkstra(n, g, 0)[2]);
    std::printf("distance 0 to 2 in the MST:   %lld\n", dijkstra(n, treeGraph, 0)[2]);
}
```

A triangle with sides 2, 2 and 3. The MST takes the two edges of weight 2 and
drops the one of weight 3 — total 4, which is minimal. But the dropped edge
*was* the shortest route from 0 to 2, so in the tree that journey costs 4
instead of 3.

Minimising the total is not minimising any individual distance, and there is no
graph-wide fix: a tree that preserved every shortest path would generally have
to be a shortest-path tree, which is what Dijkstra builds and is usually
heavier. Pick the objective you actually have.

:::pitfall
"Cheapest network" and "fastest routes" are different requirements. An MST
gives the first. A shortest-path tree from a chosen root gives the second, for
that root only. If a specification asks for both, it is under-specified — ask
which one matters before you build either.
:::

## When the tree is unique

```cpp run title="Distinct weights, distinct answer"
#include <algorithm>
#include <array>
#include <cstdio>
#include <numeric>
#include <random>
#include <vector>

struct Edge { int u, v; long long w; };

struct DSU {
    std::vector<int> parent;
    explicit DSU(int n) : parent(n) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    }
    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        parent[b] = a;
        return true;
    }
};

std::vector<Edge> mstEdges(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    std::vector<Edge> tree;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) tree.push_back(e);
    return tree;
}

std::vector<std::array<long long, 3>> shape(const std::vector<Edge>& tree) {
    std::vector<std::array<long long, 3>> key;
    for (const Edge& e : tree)
        key.push_back({std::min(e.u, e.v), std::max(e.u, e.v), e.w});
    std::sort(key.begin(), key.end());
    return key;
}

int main() {
    std::mt19937 rng(7);
    int distinctTrials = 0, distinctSame = 0;
    int tiedTrials = 0, tiedDiffered = 0;

    for (int trial = 0; trial < 4000; ++trial) {
        int n = 4 + static_cast<int>(rng() % 4);
        std::vector<Edge> edges;
        std::vector<long long> weights;
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 60) {
                    long long w = 1 + static_cast<long long>(rng() % 6);
                    edges.push_back({u, v, w});
                    weights.push_back(w);
                }

        std::sort(weights.begin(), weights.end());
        bool allDistinct = std::adjacent_find(weights.begin(), weights.end())
                           == weights.end();

        std::vector<Edge> shuffled = edges;
        std::shuffle(shuffled.begin(), shuffled.end(), rng);
        bool same = shape(mstEdges(n, edges)) == shape(mstEdges(n, shuffled));

        if (allDistinct) {
            ++distinctTrials;
            if (same) ++distinctSame;
        } else {
            ++tiedTrials;
            if (!same) ++tiedDiffered;
        }
    }

    std::printf("all weights distinct: %d graphs, same tree both times in %d\n",
                distinctTrials, distinctSame);
    std::printf("some weights repeat:  %d graphs, a different tree in %d\n",
                tiedTrials, tiedDiffered);
}
```

The same graph is run through Kruskal twice, once with the edges shuffled. When
every weight is distinct the answer is identical every time — 516 graphs, 516
agreements. When weights repeat, a different tree comes out about a third of
the time.

That is the rule: **the minimum spanning tree is unique when all edge weights
are distinct.** With ties there may be several trees, all of the same total
weight, and which one you get depends on the order your sort happened to
produce. A test that compares the *set of edges* against an expected answer
will therefore pass on your machine and fail on the judge; compare the total
weight instead.

:::tip
Ties are also why the sort matters. `std::sort` is not stable, so two edges of
equal weight can come out in either order between runs of the same binary
compiled differently. If you genuinely need a reproducible tree, break ties
explicitly — by endpoint indices, say — rather than relying on the sort.
:::

## The property that makes it useful

Here is the result that makes an MST worth building even when you did not want
a network:

> For any two vertices, the path between them **in the MST** minimises the
> heaviest edge used, over all paths in the graph.

Where "cheapest total" was the wrong tool for shortest paths, "widest path" is
exactly what an MST answers:

```cpp run title="87,000 pairs, checked against the graph"
#include <algorithm>
#include <cstdio>
#include <limits>
#include <numeric>
#include <queue>
#include <random>
#include <vector>

struct Edge { int u, v; long long w; };

struct DSU {
    std::vector<int> parent;
    explicit DSU(int n) : parent(n) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    }
    bool unite(int a, int b) {
        a = find(a);
        b = find(b);
        if (a == b) return false;
        parent[b] = a;
        return true;
    }
};

const long long INF = std::numeric_limits<long long>::max() / 4;

std::vector<Edge> mstEdges(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    std::vector<Edge> tree;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) tree.push_back(e);
    return tree;
}

// Dijkstra with max instead of plus: the cost of a route is its heaviest edge.
std::vector<long long> widest(int n,
        const std::vector<std::vector<std::pair<int, long long>>>& g, int src) {
    std::vector<long long> best(n, INF);
    best[src] = 0;
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    pq.emplace(0, src);
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
    return best;
}

int main() {
    std::mt19937 rng(99);
    bool ok = true;
    long long pairs = 0;

    for (int trial = 0; trial < 3000; ++trial) {
        int n = 2 + static_cast<int>(rng() % 7);
        std::vector<Edge> edges;
        std::vector<std::vector<std::pair<int, long long>>> g(n);
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 50) {
                    long long w = 1 + static_cast<long long>(rng() % 25);
                    edges.push_back({u, v, w});
                    g[u].push_back({v, w});
                    g[v].push_back({u, w});
                }

        std::vector<std::vector<std::pair<int, long long>>> treeGraph(n);
        for (const Edge& e : mstEdges(n, edges)) {
            treeGraph[e.u].push_back({e.v, e.w});
            treeGraph[e.v].push_back({e.u, e.w});
        }

        for (int src = 0; src < n; ++src) {
            std::vector<long long> viaGraph = widest(n, g, src);
            std::vector<long long> viaTree = widest(n, treeGraph, src);
            for (int dst = 0; dst < n; ++dst) {
                ++pairs;
                if (viaGraph[dst] != viaTree[dst]) ok = false;
            }
        }
    }

    std::printf("%lld source-target pairs over 3,000 graphs\n", pairs);
    std::printf("MST route always has the same heaviest edge as the best route: %s\n",
                ok ? "yes" : "NO");
}
```

Every one of 87,236 pairs agrees. Once you have the MST you can throw the rest
of the graph away and still answer, exactly, "what is the lightest bridge I
must be able to cross to get from here to there".

That is the shape of a whole family of problems. *What is the smallest capacity
that still lets everyone reach everyone?* — the heaviest edge in the MST.
*Cluster these points into k groups so the closest pair in different groups is
as far apart as possible?* — build the MST and delete its k−1 heaviest edges,
which is single-linkage clustering. *Maximum* spanning tree? Negate the weights,
or sort descending; every argument above works with the inequality reversed.

## Which algorithm

```cpp run title="Measured: 40,000 vertices, 120,000 edges"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <numeric>
#include <queue>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

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

std::pair<long long, int> kruskal(int n, std::vector<Edge> edges) {
    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });
    DSU dsu(n);
    long long total = 0;
    int taken = 0;
    for (const Edge& e : edges)
        if (dsu.unite(e.u, e.v)) { total += e.w; ++taken; }
    return {total, taken};
}

std::pair<long long, int> prim(int n,
        const std::vector<std::vector<std::pair<int, long long>>>& g) {
    std::vector<char> inTree(n, 0);
    long long total = 0;
    int taken = 0;
    using Item = std::pair<long long, int>;
    for (int start = 0; start < n; ++start) {
        if (inTree[start]) continue;
        std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
        pq.emplace(0, start);
        bool first = true;
        while (!pq.empty()) {
            auto [w, v] = pq.top();
            pq.pop();
            if (inTree[v]) continue;
            inTree[v] = 1;
            if (!first) { total += w; ++taken; }
            first = false;
            for (auto [to, weight] : g[v])
                if (!inTree[to]) pq.emplace(weight, to);
        }
    }
    return {total, taken};
}

int main() {
    std::mt19937 rng(2323);
    const int n = 40'000, m = 120'000;

    std::vector<Edge> edges;
    edges.reserve(m);
    std::vector<std::vector<std::pair<int, long long>>> g(n);
    for (int i = 0; i < m; ++i) {
        int u = static_cast<int>(rng() % n), v = static_cast<int>(rng() % n);
        if (u == v) continue;
        long long w = 1 + static_cast<long long>(rng() % 1'000'000);
        edges.push_back({u, v, w});
        g[u].push_back({v, w});
        g[v].push_back({u, w});
    }

    auto t0 = std::chrono::steady_clock::now();
    auto [kruskalWeight, kruskalTaken] = kruskal(n, edges);
    double kruskalMs = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t0).count();

    t0 = std::chrono::steady_clock::now();
    auto [primWeight, primTaken] = prim(n, g);
    double primMs = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t0).count();

    keep(kruskalWeight);
    keep(primWeight);
    std::printf("n = %d, %zu edges\n", n, edges.size());
    std::printf("  Kruskal %.0f ms, weight %lld, %d edges\n",
                kruskalMs, kruskalWeight, kruskalTaken);
    std::printf("  Prim    %.0f ms, weight %lld, %d edges\n",
                primMs, primWeight, primTaken);
    std::printf("  %d components, so this is a forest and not a tree\n",
                n - kruskalTaken);
}
```

Here, under the runner's sanitized build: **Kruskal about 225 ms, Prim about
1,150 ms**, same weight, 93 components. Compiled at `-O2` the same program
reports 11 ms and 25 ms — the ordering holds but the gap narrows from five
times to about two, because the sanitizers charge Prim for every heap push and
Kruskal does one sort.

That is worth internalising rather than the numbers: **a ratio measured under
one build is not a ratio.** The chapter on measuring said the same thing; here
it costs you a factor of two.

The complexities are `O(m log m)` for Kruskal — the sort dominates, and the
union-find is effectively linear — and `O(m log n)` for the heap version of
Prim. Those are the same to within a constant, and the practical guidance is
simpler than the analysis:

| Situation | Take |
|---|---|
| Sparse graph, edge list in hand | Kruskal — one sort, and you already have the DSU |
| Edges arrive sorted, or are small integers | Kruskal, sorting by counting |
| Dense graph, `m` near `n²` | Prim with an adjacency **matrix** and no heap: `O(n²)`, which beats `O(n² log n)` |
| Edges too numerous to store | Prim, which never needs them all at once |
| You need the MST built incrementally, online | Kruskal, which is naturally offline — reconsider the problem |

The dense case is the one people miss. With `m ≈ n²`, sorting is `O(n² log n)`
and a matrix-based Prim that scans for the cheapest border vertex each round is
`O(n²)` — asymptotically better and much simpler, with no priority queue at all.

:::quiz
{
  "question": "A graph has 6 vertices and all edge weights are distinct. You run Kruskal twice, shuffling the edge list in between. What do you get?",
  "options": [
    { "text": "The same tree both times — distinct weights force a unique MST", "correct": true, "why": "Right. With no ties there is never a choice between equal edges, so the greedy sequence is determined and the tree is unique." },
    { "text": "The same total weight, but possibly different edges", "correct": false, "why": "That is the situation when weights repeat. With all weights distinct the edge set is determined too." },
    { "text": "Possibly different weights, since Kruskal depends on edge order", "correct": false, "why": "Kruskal sorts first, so the input order is irrelevant to the weight; it can only matter for breaking ties, and there are none." },
    { "text": "The same tree only if the graph is connected", "correct": false, "why": "Uniqueness comes from distinct weights. On a disconnected graph you get a unique spanning forest by the same argument." }
  ]
}
:::

## Practice

:::exercise mst-audit

:::exercise mst-bottleneck

:::exercise judge-network-cost

:::exercise judge-widest-route

:::recap
- A spanning tree has exactly `n - 1` edges; a minimum one has the least total
  weight. On a disconnected graph both algorithms give a spanning forest, and
  `n - taken` is the component count.
- **Kruskal** sorts the edges and uses union-find to reject the ones that close
  a cycle. **Prim** is Dijkstra's loop pushing `e.weight` instead of
  `d + e.weight`.
- Greedy is safe because of the **cut property**: the cheapest edge crossing any
  split belongs to some MST, proved by an exchange argument.
- An MST does **not** contain shortest paths — a triangle of 2, 2, 3 makes the
  0-to-2 journey cost 4 instead of 3.
- The MST is **unique when all weights are distinct**; with ties, compare total
  weights rather than edge sets.
- The MST path between two vertices minimises its **heaviest edge**, verified
  here over 87,236 pairs. That is what bottleneck and single-linkage clustering
  questions want.
- Kruskal for sparse, matrix-based Prim (`O(n²)`, no heap) for dense.
:::
