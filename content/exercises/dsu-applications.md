---
id: dsu-applications
title: "Two things a union-find can do"
difficulty: stretch
chapter: union-find
topics: [union-find, graphs, offline, algorithms]
check: unit
standard: c++20
---

Two applications of the same structure. Each has one bug, and neither is in the
union-find itself.

- `is_bipartite(n, edges)` — whether the undirected graph can be two-coloured,
  using two nodes per vertex. Records only one of the two consequences of an
  edge.
- `components_after_removals(n, edges, removal_order)` — the number of connected
  components after each removal, answered offline by running the sequence
  backwards. Records each answer one step too late.

Edges are 0-indexed. `removal_order` lists edge indices, all distinct.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <utility>
#include <vector>

struct Dsu {
    std::vector<int> parent, size;
    int components;
    explicit Dsu(int n) : parent(n), size(n, 1), components(n) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int v) {
        int root = v;
        while (parent[root] != root) root = parent[root];
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        --components;
        return true;
    }
    bool same(int a, int b) { return find(a) == find(b); }
};

// Node v means "v on side A"; node v + n means "v on side B".
bool is_bipartite(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(2 * n);
    for (auto [u, v] : edges) {
        if (dsu.same(u, v)) return false;
        dsu.unite(u, v + n);               // only half of what the edge says
    }
    return true;
}

std::vector<int> components_after_removals(
        int n, const std::vector<std::pair<int, int>>& edges,
        const std::vector<int>& removal_order) {
    std::vector<char> removed(edges.size(), 0);
    for (int id : removal_order) removed[id] = 1;

    Dsu dsu(n);
    for (std::size_t i = 0; i < edges.size(); ++i)
        if (!removed[i]) dsu.unite(edges[i].first, edges[i].second);

    std::vector<int> answer(removal_order.size());
    for (int step = static_cast<int>(removal_order.size()) - 1; step >= 0; --step) {
        int id = removal_order[step];
        dsu.unite(edges[id].first, edges[id].second);
        answer[step] = dsu.components;     // the edge is already back
    }
    return answer;
}
```

## Tests
```cpp
using E = std::vector<std::pair<int, int>>;

// is_bipartite
CHECK(is_bipartite(4, E{{0, 1}, {1, 2}, {2, 3}, {3, 0}}));     // an even cycle
CHECK(!is_bipartite(3, E{{0, 1}, {1, 2}, {2, 0}}));            // a triangle
CHECK(!is_bipartite(1, E{{0, 0}}));                            // a self-loop
CHECK(is_bipartite(4, E{{0, 1}, {2, 3}}));
CHECK(is_bipartite(2, E{{0, 1}}));
CHECK(!is_bipartite(5, E{{0, 1}, {1, 2}, {2, 3}, {3, 4}, {4, 0}}));
CHECK(is_bipartite(1, E{}));

// components_after_removals
CHECK_EQ(components_after_removals(4, E{{0, 1}, {1, 2}, {2, 3}}, {1}),
         (std::vector<int>{2}));
CHECK_EQ(components_after_removals(4, E{{0, 1}, {1, 2}, {2, 3}}, {0, 2}),
         (std::vector<int>{2, 3}));
CHECK_EQ(components_after_removals(3, E{{0, 1}, {1, 2}}, {0, 1}),
         (std::vector<int>{2, 3}));
CHECK_EQ(components_after_removals(2, E{{0, 1}}, {0}), (std::vector<int>{2}));
CHECK_EQ(components_after_removals(5, E{{0, 1}, {1, 2}, {3, 4}, {2, 3}}, {3, 0, 1, 2}),
         (std::vector<int>{2, 3, 4, 5}));
CHECK_EQ(components_after_removals(3, E{{0, 1}, {0, 1}}, {0}), (std::vector<int>{2}));
```

## Hints
- An edge `u–v` says two things: `u` on side A implies `v` on side B, **and** `v` on side A implies `u` on side B. Both have to be recorded: `unite(u, v + n)` and `unite(v, u + n)`.
- With only one of them, the structure never learns enough to contradict itself, so `is_bipartite` returns true for everything. The triangle is the smallest case.
- Check for the contradiction *before* merging: if `u` and `v` are already in the same set, the edge is asking for two vertices on the same side to be on opposite sides.
- For the removals, the answer for step `k` is the state with the first `k + 1` removals applied — which is the state *before* you put edge `removal_order[k]` back.
- So record `dsu.components` first, then re-add the edge. Reversing those two lines shifts every answer by one step.
- The last removal's answer is the state of the graph with every removed edge gone, which is exactly what the initial "add everything that survives" pass builds.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <utility>
#include <vector>

struct Dsu {
    std::vector<int> parent, size;
    int components;
    explicit Dsu(int n) : parent(n), size(n, 1), components(n) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int v) {
        int root = v;
        while (parent[root] != root) root = parent[root];
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        --components;
        return true;
    }
    bool same(int a, int b) { return find(a) == find(b); }
};

bool is_bipartite(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(2 * n);
    for (auto [u, v] : edges) {
        if (dsu.same(u, v)) return false;      // already forced onto one side
        dsu.unite(u, v + n);                   // u with "v is on the other side"
        dsu.unite(v, u + n);                   // and symmetrically
    }
    return true;
}

std::vector<int> components_after_removals(
        int n, const std::vector<std::pair<int, int>>& edges,
        const std::vector<int>& removal_order) {
    std::vector<char> removed(edges.size(), 0);
    for (int id : removal_order) removed[id] = 1;

    Dsu dsu(n);
    for (std::size_t i = 0; i < edges.size(); ++i)
        if (!removed[i]) dsu.unite(edges[i].first, edges[i].second);

    std::vector<int> answer(removal_order.size());
    for (int step = static_cast<int>(removal_order.size()) - 1; step >= 0; --step) {
        answer[step] = dsu.components;         // record, then undo the removal
        int id = removal_order[step];
        dsu.unite(edges[id].first, edges[id].second);
    }
    return answer;
}
```

## Notes
**An edge is two implications.** The doubling encodes "different" as "the same
as the opposite", and the relation is symmetric, so it takes two merges. With
only `unite(u, v + n)`, the set containing `v` never learns anything about `u`,
so `same(u, v)` is never true and every graph is declared bipartite.

The triangle is the smallest demonstration. After `0–1` and `1–2`, the correct
version has forced 0 and 2 onto the same side, so the edge `2–0` contradicts
immediately; the starter has not made that connection and returns true.

It is worth seeing why the check comes first. `same(u, v)` asks whether `u` and
`v` have already been forced onto the same side — and the edge about to be
processed insists they are on *different* sides. Doing the merges first destroys
the evidence, in exactly the way `count_redundant_edges` does in the previous
problem.

**Offline reversal is an ordering, not an algorithm.** The structure only ever
merges, so a sequence of deletions is run backwards as a sequence of insertions.
The whole subtlety is *when* to read the answer:

```
state after removals 0..k  ==  state before edge removal_order[k] is put back
```

So the loop body is record, then undo — and the starter's undo-then-record
reports the state after removals `0..k-1` for step `k`, shifting everything by
one and leaving the last answer unrecorded entirely. On a two-vertex graph with
its only edge removed, the answer is 2 and the starter says 1.

The technique needs the whole removal list up front, which is what makes it
*offline*. A problem that must answer each query before revealing the next one
cannot use it — that wants a link-cut tree or a segment tree over time — so the
input format is what tells you whether this is available. When it is, it turns an
impossible problem into twenty lines: chapter 10.20 measures 8.2 ms for 40,000
answers against an extrapolated forty minutes of rebuilding.
