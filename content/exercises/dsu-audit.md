---
id: dsu-audit
title: "Three union-finds that lose count"
difficulty: core
chapter: union-find
topics: [union-find, graphs, algorithms]
check: unit
standard: c++20
---

Three routines sharing one disjoint-set structure. The `find` is correct in all
of them; what each gets wrong is what it does around the merge.

- `count_components(n, edges)` — the number of connected components. Decrements
  the count for every edge, including edges that join nothing.
- `largest_component(n, edges)` — the size of the biggest component. Reads the
  size stored at a vertex rather than at its root.
- `count_redundant_edges(n, edges)` — how many edges join two vertices that were
  already connected. Merges first and asks afterwards, by which time the answer
  is always yes.

Edges are 0-indexed and may include self-loops and repeats.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <utility>
#include <vector>

struct Dsu {
    std::vector<int> parent, size;
    explicit Dsu(int n) : parent(n), size(n, 1) {
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
        return true;
    }
    bool same(int a, int b) { return find(a) == find(b); }
};

int count_components(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(n);
    int components = n;
    for (auto [u, v] : edges) {
        dsu.unite(u, v);
        --components;                      // every edge, whether it merged or not
    }
    return components;
}

int largest_component(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(n);
    for (auto [u, v] : edges) dsu.unite(u, v);

    int best = 0;
    for (int v = 0; v < n; ++v) best = std::max(best, dsu.size[v]);   // not the root
    return best;
}

int count_redundant_edges(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(n);
    int redundant = 0;
    for (auto [u, v] : edges) {
        dsu.unite(u, v);
        if (dsu.same(u, v)) ++redundant;   // after merging, they always are
    }
    return redundant;
}
```

## Tests
```cpp
using E = std::vector<std::pair<int, int>>;
const E sample{{0, 1}, {2, 3}, {1, 2}, {0, 3}, {4, 4}};

// count_components
CHECK_EQ(count_components(5, sample), 2);
CHECK_EQ(count_components(4, E{}), 4);
CHECK_EQ(count_components(1, E{}), 1);
CHECK_EQ(count_components(3, E{{0, 1}, {1, 2}, {2, 0}}), 1);
CHECK_EQ(count_components(6, E{{0, 1}, {1, 2}, {3, 4}}), 3);
CHECK_EQ(count_components(2, E{{0, 1}, {0, 1}, {0, 1}}), 1);
CHECK_EQ(count_components(4, E{{0, 1}, {2, 3}, {1, 3}}), 1);

// largest_component
CHECK_EQ(largest_component(5, sample), 4);
CHECK_EQ(largest_component(4, E{}), 1);
CHECK_EQ(largest_component(1, E{}), 1);
CHECK_EQ(largest_component(3, E{{0, 1}, {1, 2}, {2, 0}}), 3);
CHECK_EQ(largest_component(6, E{{0, 1}, {1, 2}, {3, 4}}), 3);
CHECK_EQ(largest_component(2, E{{0, 1}, {0, 1}, {0, 1}}), 2);
CHECK_EQ(largest_component(4, E{{0, 1}, {2, 3}, {1, 3}}), 4);

// count_redundant_edges
CHECK_EQ(count_redundant_edges(5, sample), 2);        // the 0-3 edge and the self-loop
CHECK_EQ(count_redundant_edges(4, E{}), 0);
CHECK_EQ(count_redundant_edges(3, E{{0, 1}, {1, 2}, {2, 0}}), 1);
CHECK_EQ(count_redundant_edges(6, E{{0, 1}, {1, 2}, {3, 4}}), 0);
CHECK_EQ(count_redundant_edges(2, E{{0, 1}, {0, 1}, {0, 1}}), 2);
CHECK_EQ(count_redundant_edges(4, E{{0, 1}, {2, 3}, {1, 3}}), 0);
```

## Hints
- `unite` already returns whether it merged anything. Use it: `if (dsu.unite(u, v)) --components;`.
- An edge between two vertices already in the same set changes nothing, and a self-loop never merges anything either — `unite(4, 4)` finds the same root twice.
- `size[v]` is meaningful only when `v` is a root. For any other vertex it holds whatever it held when the vertex was last a root, which is stale. Ask for `dsu.size[dsu.find(v)]`.
- Equivalently, only look at roots: `if (dsu.find(v) == v) best = max(best, dsu.size[v]);`.
- `count_redundant_edges` must ask *before* merging. `if (!dsu.unite(u, v)) ++redundant;` does both in one call and is the idiomatic form.
- Every case with a repeated edge or a self-loop is there to separate "an edge arrived" from "something merged".

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <utility>
#include <vector>

struct Dsu {
    std::vector<int> parent, size;
    explicit Dsu(int n) : parent(n), size(n, 1) {
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
        return true;
    }
    bool same(int a, int b) { return find(a) == find(b); }
};

int count_components(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(n);
    int components = n;
    for (auto [u, v] : edges)
        if (dsu.unite(u, v)) --components;             // only a real merge counts
    return components;
}

int largest_component(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(n);
    for (auto [u, v] : edges) dsu.unite(u, v);

    int best = 0;
    for (int v = 0; v < n; ++v)
        best = std::max(best, dsu.size[dsu.find(v)]);  // the root holds the size
    return best;
}

int count_redundant_edges(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(n);
    int redundant = 0;
    for (auto [u, v] : edges)
        if (!dsu.unite(u, v)) ++redundant;             // ask by merging
    return redundant;
}
```

## Notes
Three bugs, one theme: **an edge arriving is not the same event as a merge
happening.**

**Count what merged, not what arrived.** `unite` already reports the
distinction, and ignoring its return value is throwing away the one piece of
information the structure computes. On the sample the count would fall to 0 —
five edges from five vertices — where the answer is 2. Self-loops and repeated
edges are the inputs that expose it, and both are common in real test data.

**Per-component data lives at the root.** `size[v]` is only meaningful when
`v == find(v)`. For any other vertex it is a leftover: the size that vertex's
set had at the moment it stopped being a root. It happens to be correct for
isolated vertices, which is why the edgeless cases pass and everything else does
not.

This generalises. Anything you attach to a component — a sum, a maximum, a count
of marked vertices — is stored at the root and merged inside `unite`, and read
back through `find`. Writing `data[find(v)]` rather than `data[v]` everywhere is
the discipline; a wrapper method like `size_of(int v) { return size[find(v)]; }`
is the way to stop having to remember.

**Ask before you merge.** `unite(u, v)` followed by `same(u, v)` is a question
whose answer the previous line just guaranteed. The single call `if
(!dsu.unite(u, v))` does the test and the merge together — and this is exactly
Kruskal's edge filter (chapter 10.23), where an edge that fails to merge is one
that would close a cycle.

One thing all three share: none of them needs an adjacency list, a queue, or a
traversal. That is the reason to reach for a DSU — the connectivity questions
answer themselves as the edges stream past, in near-constant time each, with no
graph built at all.
