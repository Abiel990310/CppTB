---
id: dfs-audit
title: "Three depth-first searches"
difficulty: core
chapter: dfs
topics: [graphs, dfs, algorithms]
check: unit
standard: c++20
---

Three DFS routines, each losing one thing: the vertices the first search never
reaches, the difference between "on the stack" and "finished", or the vertex
itself.

- `count_components(n, edges)` — the number of connected components of an
  undirected graph. Searches from vertex 0 only.
- `has_cycle(g)` — whether a **directed** graph contains a cycle. Uses a single
  `visited` flag, so any second arrival at a vertex looks like a back edge.
- `subtree_of(children, root, u)` — the vertices in `u`'s subtree, sorted, using
  entry and exit times. Compares strictly, so `u` is missing from its own
  subtree.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

int count_components(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) { adj[u].push_back(v); adj[v].push_back(u); }

    std::vector<char> seen(n, 0);
    std::vector<int> stack;
    int components = 0;

    seen[0] = 1;                          // only one search is ever started
    stack.push_back(0);
    ++components;
    while (!stack.empty()) {
        int v = stack.back();
        stack.pop_back();
        for (int w : adj[v]) if (!seen[w]) { seen[w] = 1; stack.push_back(w); }
    }
    return components;
}

bool has_cycle(const std::vector<std::vector<int>>& g) {
    int n = static_cast<int>(g.size());
    std::vector<char> visited(n, 0);      // one flag: no "on the stack" state
    std::vector<int> stack, iter(n, 0);

    for (int s = 0; s < n; ++s) {
        if (visited[s]) continue;
        visited[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (visited[w]) return true;
                visited[w] = 1;
                stack.push_back(w);
            } else {
                stack.pop_back();
            }
        }
    }
    return false;
}

std::vector<int> subtree_of(const std::vector<std::vector<int>>& children,
                            int root, int u) {
    int n = static_cast<int>(children.size());
    std::vector<int> tin(n, 0), tout(n, 0), iter(n, 0), stack{root};
    int timer = 0;
    tin[root] = timer++;
    while (!stack.empty()) {
        int v = stack.back();
        if (iter[v] < static_cast<int>(children[v].size())) {
            int w = children[v][iter[v]++];
            tin[w] = timer++;
            stack.push_back(w);
        } else {
            tout[v] = timer++;
            stack.pop_back();
        }
    }

    std::vector<int> out;
    for (int v = 0; v < n; ++v)
        if (tin[u] < tin[v] && tout[v] < tout[u]) out.push_back(v);   // strict
    return out;
}
```

## Tests
```cpp
using E = std::vector<std::pair<int, int>>;

// count_components
CHECK_EQ(count_components(5, E{{0, 1}, {1, 2}, {3, 4}}), 2);
CHECK_EQ(count_components(1, E{}), 1);
CHECK_EQ(count_components(4, E{}), 4);
CHECK_EQ(count_components(3, E{{0, 1}, {1, 2}, {2, 0}}), 1);
CHECK_EQ(count_components(6, E{{0, 1}, {2, 3}, {4, 5}}), 3);
CHECK_EQ(count_components(2, E{{0, 1}}), 1);

// has_cycle
using G = std::vector<std::vector<int>>;
CHECK(has_cycle(G{{1}, {2}, {0}}));                  // a triangle
CHECK(!has_cycle(G{{1, 2}, {2}, {}}));               // a DAG with two routes to 2
CHECK(has_cycle(G{{0}}));                            // a self-loop
CHECK(!has_cycle(G{{}}));
CHECK(!has_cycle(G{{1}, {2}, {3}, {}}));             // a chain
CHECK(has_cycle(G{{1, 2}, {3}, {3}, {1}}));
CHECK(!has_cycle(G{{1}, {}}));

// subtree_of -- the tree 0 -> 1,2 ; 1 -> 3,4 ; 2 -> 5
const G tree{{1, 2}, {3, 4}, {5}, {}, {}, {}};
CHECK_EQ(subtree_of(tree, 0, 0), (std::vector<int>{0, 1, 2, 3, 4, 5}));
CHECK_EQ(subtree_of(tree, 0, 1), (std::vector<int>{1, 3, 4}));
CHECK_EQ(subtree_of(tree, 0, 2), (std::vector<int>{2, 5}));
CHECK_EQ(subtree_of(tree, 0, 3), (std::vector<int>{3}));
CHECK_EQ(subtree_of(tree, 0, 5), (std::vector<int>{5}));
```

## Hints
- A component is found by starting a search from a vertex nothing has reached yet, so the search has to be wrapped in a loop over all vertices: `for (int s = 0; s < n; ++s) if (!seen[s]) { ++components; ... }`.
- `count_components(4, {})` — four isolated vertices — is the case that says so, and the starter answers 1.
- Directed cycle detection needs three states, not two: unvisited, **on the current path**, and finished. Only an edge to a vertex on the current path is a back edge.
- Mark a vertex as finished when it comes off the stack — that is what `else { colour[v] = 2; stack.pop_back(); }` is for — and treat an edge to a finished vertex as ordinary.
- `0 → 1, 0 → 2, 1 → 2` is the smallest DAG the two-flag version calls cyclic: vertex 2 is reached from 1 and then again from 0, but by then it is finished.
- A vertex is in its own subtree, so the containment test is `tin[u] <= tin[v] && tout[v] <= tout[u]`. With strict comparisons `u` itself never qualifies.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

int count_components(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) { adj[u].push_back(v); adj[v].push_back(u); }

    std::vector<char> seen(n, 0);
    std::vector<int> stack;
    int components = 0;

    for (int s = 0; s < n; ++s) {         // one search per unreached vertex
        if (seen[s]) continue;
        ++components;
        seen[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            stack.pop_back();
            for (int w : adj[v]) if (!seen[w]) { seen[w] = 1; stack.push_back(w); }
        }
    }
    return components;
}

bool has_cycle(const std::vector<std::vector<int>>& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> colour(n, 0);        // 0 white, 1 on the path, 2 finished
    std::vector<int> stack, iter(n, 0);

    for (int s = 0; s < n; ++s) {
        if (colour[s] != 0) continue;
        colour[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (colour[w] == 1) return true;          // back edge
                if (colour[w] == 0) { colour[w] = 1; stack.push_back(w); }
            } else {
                colour[v] = 2;                            // finished
                stack.pop_back();
            }
        }
    }
    return false;
}

std::vector<int> subtree_of(const std::vector<std::vector<int>>& children,
                            int root, int u) {
    int n = static_cast<int>(children.size());
    std::vector<int> tin(n, 0), tout(n, 0), iter(n, 0), stack{root};
    int timer = 0;
    tin[root] = timer++;
    while (!stack.empty()) {
        int v = stack.back();
        if (iter[v] < static_cast<int>(children[v].size())) {
            int w = children[v][iter[v]++];
            tin[w] = timer++;
            stack.push_back(w);
        } else {
            tout[v] = timer++;
            stack.pop_back();
        }
    }

    std::vector<int> out;
    for (int v = 0; v < n; ++v)
        if (tin[u] <= tin[v] && tout[v] <= tout[u]) out.push_back(v);   // inclusive
    return out;
}
```

## Notes
**One search is not a survey.** A DFS reaches exactly one component, so counting
components means starting a fresh search from every vertex nothing has touched
yet. The loop over `s` is not boilerplate around the algorithm; it *is* the
algorithm for this question, and the search inside it is the subroutine.

`count_components(4, {})` — four vertices, no edges — is the smallest input that
exposes a missing outer loop, and it is worth keeping in any component-counting
test set for exactly that reason.

**Two states cannot express three facts.** A directed DFS needs to distinguish a
vertex that is an *ancestor* of the current one from a vertex that is merely
*already done*. An edge to the first is a back edge and proves a cycle; an edge
to the second is a cross or forward edge and proves nothing at all.

The DAG `0 → 1, 0 → 2, 1 → 2` has both. With a single flag, arriving at 2 for
the second time looks identical to closing a loop, and the function reports a
cycle in a graph that has none. Note that the error is one-directional: a
two-flag version never *misses* a cycle, it only invents them — which means it
passes every cyclic test you write and fails on the acyclic ones.

For an **undirected** graph the rule is different again: any edge to a visited
vertex other than the one you arrived along is a cycle, and no colours are
needed. Three graph types, three tests; copying one into another is how this bug
travels.

**A vertex is in its own subtree.** `tin[u] <= tin[v] && tout[v] <= tout[u]`
holds trivially for `v == u`, and that is the intended answer:
`subtree_of(tree, 0, 3)` is `{3}`, not `{}`. Strict comparisons exclude the
vertex and silently shrink every answer by one.

The property underneath is worth remembering on its own: **DFS intervals are
nested or disjoint, never partially overlapping.** That is what makes a subtree a
contiguous range once the vertices are listed in entry-time order, which in turn
is what lets a Fenwick tree (chapter 10.31) update a whole subtree in one
operation.
