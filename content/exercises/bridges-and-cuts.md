---
id: bridges-and-cuts
title: "Bridges and cut vertices"
difficulty: stretch
chapter: dfs
topics: [graphs, dfs, low-link, algorithms]
check: unit
standard: c++20
---

Two low-link searches over an undirected graph, sharing a skeleton and differing
in one comparison. Each has one bug.

- `find_bridges(n, edges)` — the edges whose removal increases the number of
  connected components, as sorted `(min, max)` pairs. Skips the parent by
  *vertex*, so a pair of parallel edges is misread as a single one.
- `articulation_points(n, edges)` — the vertices whose removal increases the
  number of components, sorted. Uses the bridge comparison rather than the cut
  one.

Edges are 0-indexed, may repeat, and there are no self-loops.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

std::vector<std::pair<int, int>> find_bridges(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<std::pair<int, int>>> adj(n);     // (neighbour, edge id)
    for (int i = 0; i < static_cast<int>(edges.size()); ++i) {
        adj[edges[i].first].emplace_back(edges[i].second, i);
        adj[edges[i].second].emplace_back(edges[i].first, i);
    }

    std::vector<int> entry(n, -1), low(n, 0), iter(n, 0), parent(n, -1), stack;
    std::vector<std::pair<int, int>> found;
    int timer = 0;

    for (int s = 0; s < n; ++s) {
        if (entry[s] != -1) continue;
        entry[s] = low[s] = timer++;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(adj[v].size())) {
                auto [w, id] = adj[v][iter[v]++];
                (void)id;
                if (w == parent[v]) continue;                 // skips every parent edge
                if (entry[w] == -1) {
                    parent[w] = v;
                    entry[w] = low[w] = timer++;
                    stack.push_back(w);
                } else {
                    low[v] = std::min(low[v], entry[w]);
                }
            } else {
                stack.pop_back();
                if (!stack.empty()) {
                    int p = stack.back();
                    low[p] = std::min(low[p], low[v]);
                    if (low[v] > entry[p])
                        found.emplace_back(std::min(p, v), std::max(p, v));
                }
            }
        }
    }
    std::sort(found.begin(), found.end());
    return found;
}

std::vector<int> articulation_points(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<std::pair<int, int>>> adj(n);
    for (int i = 0; i < static_cast<int>(edges.size()); ++i) {
        adj[edges[i].first].emplace_back(edges[i].second, i);
        adj[edges[i].second].emplace_back(edges[i].first, i);
    }

    std::vector<int> entry(n, -1), low(n, 0), iter(n, 0), parent_edge(n, -1);
    std::vector<int> root_kids(n, 0), stack;
    std::vector<char> is_cut(n, 0);
    int timer = 0;

    for (int s = 0; s < n; ++s) {
        if (entry[s] != -1) continue;
        int root = s;
        entry[s] = low[s] = timer++;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(adj[v].size())) {
                auto [w, id] = adj[v][iter[v]++];
                if (id == parent_edge[v]) continue;
                if (entry[w] == -1) {
                    parent_edge[w] = id;
                    entry[w] = low[w] = timer++;
                    if (v == root) ++root_kids[root];
                    stack.push_back(w);
                } else {
                    low[v] = std::min(low[v], entry[w]);
                }
            } else {
                stack.pop_back();
                if (!stack.empty()) {
                    int p = stack.back();
                    low[p] = std::min(low[p], low[v]);
                    if (p != root && low[v] > entry[p]) is_cut[p] = 1;   // bridge test
                }
            }
        }
        if (root_kids[root] >= 2) is_cut[root] = 1;
    }

    std::vector<int> out;
    for (int v = 0; v < n; ++v) if (is_cut[v]) out.push_back(v);
    return out;
}
```

## Tests
```cpp
using E = std::vector<std::pair<int, int>>;
using P = std::vector<std::pair<int, int>>;

// find_bridges
CHECK_EQ(find_bridges(4, E{{0, 1}, {1, 2}, {2, 0}, {2, 3}}), (P{{2, 3}}));
CHECK_EQ(find_bridges(4, E{{0, 1}, {1, 2}, {2, 3}}), (P{{0, 1}, {1, 2}, {2, 3}}));
CHECK_EQ(find_bridges(3, E{{0, 1}, {1, 2}, {2, 0}}), (P{}));
CHECK_EQ(find_bridges(1, E{}), (P{}));
// Two parallel edges between 0 and 1: neither is a bridge.
CHECK_EQ(find_bridges(4, E{{0, 1}, {0, 1}, {1, 2}}), (P{{1, 2}}));
CHECK_EQ(find_bridges(2, E{{0, 1}, {0, 1}}), (P{}));
CHECK_EQ(find_bridges(5, E{{0, 1}, {2, 3}, {3, 4}, {4, 2}}), (P{{0, 1}}));
CHECK_EQ(find_bridges(4, E{{0, 1}, {1, 2}, {2, 3}, {3, 1}}), (P{{0, 1}}));

// articulation_points
CHECK_EQ(articulation_points(4, E{{0, 1}, {1, 2}, {2, 3}, {3, 1}}),
         (std::vector<int>{1}));
CHECK_EQ(articulation_points(4, E{{0, 1}, {1, 2}, {2, 0}, {2, 3}}),
         (std::vector<int>{2}));
CHECK_EQ(articulation_points(4, E{{0, 1}, {1, 2}, {2, 3}}), (std::vector<int>{1, 2}));
CHECK_EQ(articulation_points(3, E{{0, 1}, {0, 2}}), (std::vector<int>{0}));
CHECK_EQ(articulation_points(3, E{{0, 1}, {1, 2}, {2, 0}}), (std::vector<int>{}));
CHECK_EQ(articulation_points(2, E{{0, 1}}), (std::vector<int>{}));
CHECK_EQ(articulation_points(1, E{}), (std::vector<int>{}));
CHECK_EQ(articulation_points(5, E{{0, 1}, {1, 2}, {2, 0}, {0, 3}, {3, 4}}),
         (std::vector<int>{0, 3}));
CHECK_EQ(articulation_points(5, E{{0, 1}, {2, 3}, {3, 4}, {4, 2}}),
         (std::vector<int>{}));
```

## Hints
- Skip the edge you arrived on, not every edge to the parent vertex. The adjacency lists already carry an edge id: compare `id == parent_edge[v]`.
- With two parallel edges between 0 and 1, the second one is a genuine route upwards, so neither edge is a bridge. Skipping by vertex hides it and reports both as bridges.
- The `articulation_points` skeleton is already right about edge ids and about the root; only the comparison is wrong.
- A **bridge** needs `low[child] > entry[v]`: nothing under the child can reach `v` *or above*. A **cut vertex** needs `low[child] >= entry[v]`: nothing under the child can reach *strictly above* `v`.
- `{{0,1},{1,2},{2,3},{3,1}}` separates them — a triangle 1-2-3 with a pendant 0. Vertex 1 is a cut vertex, and `low[2] == entry[1]`, so only `>=` finds it.
- The root of each DFS tree is special: it is a cut vertex exactly when it has two or more DFS children. The starter already handles that, and it is why `root_kids` exists.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

std::vector<std::pair<int, int>> find_bridges(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<std::pair<int, int>>> adj(n);
    for (int i = 0; i < static_cast<int>(edges.size()); ++i) {
        adj[edges[i].first].emplace_back(edges[i].second, i);
        adj[edges[i].second].emplace_back(edges[i].first, i);
    }

    std::vector<int> entry(n, -1), low(n, 0), iter(n, 0), parent_edge(n, -1), stack;
    std::vector<std::pair<int, int>> found;
    int timer = 0;

    for (int s = 0; s < n; ++s) {
        if (entry[s] != -1) continue;
        entry[s] = low[s] = timer++;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(adj[v].size())) {
                auto [w, id] = adj[v][iter[v]++];
                if (id == parent_edge[v]) continue;           // that one edge only
                if (entry[w] == -1) {
                    parent_edge[w] = id;
                    entry[w] = low[w] = timer++;
                    stack.push_back(w);
                } else {
                    low[v] = std::min(low[v], entry[w]);
                }
            } else {
                stack.pop_back();
                if (!stack.empty()) {
                    int p = stack.back();
                    low[p] = std::min(low[p], low[v]);
                    if (low[v] > entry[p])
                        found.emplace_back(std::min(p, v), std::max(p, v));
                }
            }
        }
    }
    std::sort(found.begin(), found.end());
    return found;
}

std::vector<int> articulation_points(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<std::pair<int, int>>> adj(n);
    for (int i = 0; i < static_cast<int>(edges.size()); ++i) {
        adj[edges[i].first].emplace_back(edges[i].second, i);
        adj[edges[i].second].emplace_back(edges[i].first, i);
    }

    std::vector<int> entry(n, -1), low(n, 0), iter(n, 0), parent_edge(n, -1);
    std::vector<int> root_kids(n, 0), stack;
    std::vector<char> is_cut(n, 0);
    int timer = 0;

    for (int s = 0; s < n; ++s) {
        if (entry[s] != -1) continue;
        int root = s;
        entry[s] = low[s] = timer++;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(adj[v].size())) {
                auto [w, id] = adj[v][iter[v]++];
                if (id == parent_edge[v]) continue;
                if (entry[w] == -1) {
                    parent_edge[w] = id;
                    entry[w] = low[w] = timer++;
                    if (v == root) ++root_kids[root];
                    stack.push_back(w);
                } else {
                    low[v] = std::min(low[v], entry[w]);
                }
            } else {
                stack.pop_back();
                if (!stack.empty()) {
                    int p = stack.back();
                    low[p] = std::min(low[p], low[v]);
                    if (p != root && low[v] >= entry[p]) is_cut[p] = 1;   // cut test
                }
            }
        }
        if (root_kids[root] >= 2) is_cut[root] = 1;
    }

    std::vector<int> out;
    for (int v = 0; v < n; ++v) if (is_cut[v]) out.push_back(v);
    return out;
}
```

## Notes
Two searches, one skeleton, and two decisions that look like details.

**The parent is an edge, not a vertex.** `if (w == parent[v]) continue;` is the
version written in most tutorials, and it is correct exactly when the graph is
simple. With two edges between 0 and 1, the second one is a real route back up
— you can leave along one and return along the other — so neither is a bridge.
Skipping by vertex hides that route, `low[1]` never learns about `entry[0]`, and
both edges are reported.

`find_bridges(2, {{0,1},{0,1}})` is the whole test: a graph you cannot
disconnect by removing one edge, where the starter finds two bridges. Carrying
the edge id costs one `int` per adjacency entry and removes the assumption.

**`>` is a bridge; `>=` is a cut vertex.** The two conditions differ by whether
the child's subtree may reach `v` *itself*:

```
low[child] >  entry[v]    nothing below can reach v or above  -> the edge is a bridge
low[child] >= entry[v]    nothing below can reach above v     -> v is a cut vertex
```

A child that can reach exactly `v` and no higher makes `v` a cut vertex without
making the edge a bridge — which is precisely the triangle-with-a-pendant case,
where removing vertex 1 disconnects 0 while removing any single edge does not.
Getting this backwards produces answers that are right on trees, where every edge
is a bridge and every internal vertex is a cut vertex, and wrong the moment a
cycle appears.

**The root needs its own rule.** `low[child] >= entry[root]` is *always* true for
the root, since `entry[root]` is the smallest time in its tree — so the general
test would call every root a cut vertex. The correct rule is structural: the root
is a cut vertex exactly when it has two or more DFS children, because then its
subtrees are joined only through it. That is why `root_kids` is counted and why
the loop skips `p != root`.

**Why iterative.** Both searches need the *finish* moment — the point where a
child's `low` is folded into its parent's — which is what the `iter[v]` cursor
recreates. The recursive versions are shorter and overflow the stack on a long
path, as chapter 10.18 measures: about 854 bytes a frame and roughly 9,800 frames
available.
