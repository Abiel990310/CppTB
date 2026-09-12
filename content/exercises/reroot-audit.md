---
id: reroot-audit
title: "Three sweeps over a tree"
difficulty: core
chapter: tree-dp-and-rerooting
topics: [graphs, trees, dynamic-programming]
check: unit
standard: c++20
---

Three routines over an unrooted tree given as adjacency lists, each rooted at
vertex 0 internally. Each has one bug, and each bug is one of the three mistakes
the chapter warns about.

- `subtree_sizes(g)` — the number of vertices in each vertex's subtree. Sweeps
  the traversal order in the wrong direction, so a vertex is combined into its
  parent before its own children have been combined into it.
- `distance_sums(g)` — for each vertex, the sum of the distances to every other
  vertex. The rerooting transition forgets that the vertices outside the subtree
  move *away* while the ones inside move closer.
- `farthest(g)` — for each vertex, the distance to the furthest vertex. Keeps
  only the single deepest branch at each vertex, so excluding that branch leaves
  nothing behind.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

using Tree = std::vector<std::vector<int>>;

// Pre-order (parents before children) plus each vertex's parent.
static void walk(const Tree& g, std::vector<int>& order, std::vector<int>& parent) {
    int n = static_cast<int>(g.size());
    order.clear();
    parent.assign(n, -1);
    std::vector<bool> seen(n, false);
    std::vector<int> stack{0};
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }
}

std::vector<long long> subtree_sizes(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);
    std::vector<long long> size(n, 1);
    for (int i = 1; i < n; ++i) {              // parents before children
        int v = order[i];
        size[parent[v]] += size[v];
    }
    return size;
}

std::vector<long long> distance_sums(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);

    std::vector<long long> size(n, 1), down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        size[p] += size[v];
        down[p] += down[v] + size[v];
    }

    std::vector<long long> ans(n, 0);
    ans[0] = down[0];
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        ans[v] = ans[p] + n - size[v];         // only the inside was counted
    }
    return ans;
}

std::vector<int> farthest(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);

    std::vector<int> down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        down[p] = std::max(down[p], down[v] + 1);
    }

    std::vector<int> best1(n, 0), who(n, -1);
    for (int v = 0; v < n; ++v)
        for (int c : g[v]) {
            if (c == parent[v]) continue;
            if (down[c] + 1 > best1[v]) { best1[v] = down[c] + 1; who[v] = c; }
        }

    std::vector<int> up(n, 0);
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        int siblings = (who[p] == v) ? 0 : best1[p];   // nothing left to fall back on
        up[v] = 1 + std::max(up[p], siblings);
    }

    std::vector<int> ans(n);
    for (int v = 0; v < n; ++v) ans[v] = std::max(down[v], up[v]);
    return ans;
}
```

## Tests
```cpp
//      0                                    0 with five leaves
//    /   \
//   1     2
//  / \     \
// 3   4     5
const Tree branchy{{1, 2}, {0, 3, 4}, {0, 5}, {1}, {1}, {2}};
const Tree centre3{{1, 2}, {0}, {0}};        // 1 — 0 — 2, rooted at the middle
const Tree star{{1, 2, 3, 4, 5}, {0}, {0}, {0}, {0}, {0}};
const Tree single{{}};
const Tree pair2{{1}, {0}};

// subtree_sizes — rooted at 0
CHECK_EQ(subtree_sizes(branchy), (std::vector<long long>{6, 3, 2, 1, 1, 1}));
CHECK_EQ(subtree_sizes(centre3), (std::vector<long long>{3, 1, 1}));
CHECK_EQ(subtree_sizes(star), (std::vector<long long>{6, 1, 1, 1, 1, 1}));
CHECK_EQ(subtree_sizes(single), (std::vector<long long>{1}));
CHECK_EQ(subtree_sizes(pair2), (std::vector<long long>{2, 1}));

// distance_sums
CHECK_EQ(distance_sums(branchy), (std::vector<long long>{8, 8, 10, 12, 12, 14}));
CHECK_EQ(distance_sums(centre3), (std::vector<long long>{2, 3, 3}));
CHECK_EQ(distance_sums(star), (std::vector<long long>{5, 9, 9, 9, 9, 9}));
CHECK_EQ(distance_sums(single), (std::vector<long long>{0}));
CHECK_EQ(distance_sums(pair2), (std::vector<long long>{1, 1}));

// farthest
CHECK_EQ(farthest(branchy), (std::vector<int>{2, 3, 3, 4, 4, 4}));
CHECK_EQ(farthest(centre3), (std::vector<int>{1, 2, 2}));    // the three-vertex case
CHECK_EQ(farthest(star), (std::vector<int>{1, 2, 2, 2, 2, 2}));
CHECK_EQ(farthest(single), (std::vector<int>{0}));
CHECK_EQ(farthest(pair2), (std::vector<int>{1, 1}));
```

## Hints
- `subtree_sizes` needs its children finished before their parent is read. The pre-order has parents first, so walk it **backwards** — `for (int i = n - 1; i >= 1; --i)`.
- Moving the root from `p` to a child `v` brings `size[v]` vertices one step closer and pushes the other `n - size[v]` one step further. The net change is `-size[v] + (n - size[v])`.
- `farthest` fails on the smallest interesting tree: a path of three vertices, where the middle one has two equally deep children.
- When `v` is the child that produced the best branch of `p`, the fallback is the *second* best branch, not zero. Track `best2` alongside `best1`.
- A vertex with one child has no second branch, and `best2` stays 0 — which is the right answer there, so the same line covers both cases.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

using Tree = std::vector<std::vector<int>>;

static void walk(const Tree& g, std::vector<int>& order, std::vector<int>& parent) {
    int n = static_cast<int>(g.size());
    order.clear();
    parent.assign(n, -1);
    std::vector<bool> seen(n, false);
    std::vector<int> stack{0};
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }
}

std::vector<long long> subtree_sizes(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);
    std::vector<long long> size(n, 1);
    for (int i = n - 1; i >= 1; --i) {          // children first
        int v = order[i];
        size[parent[v]] += size[v];
    }
    return size;
}

std::vector<long long> distance_sums(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);

    std::vector<long long> size(n, 1), down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        size[p] += size[v];
        down[p] += down[v] + size[v];
    }

    std::vector<long long> ans(n, 0);
    ans[0] = down[0];
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        ans[v] = ans[p] + n - 2 * size[v];      // closer inside, further outside
    }
    return ans;
}

std::vector<int> farthest(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);

    std::vector<int> down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        down[p] = std::max(down[p], down[v] + 1);
    }

    std::vector<int> best1(n, 0), best2(n, 0), who(n, -1);
    for (int v = 0; v < n; ++v)
        for (int c : g[v]) {
            if (c == parent[v]) continue;
            int cand = down[c] + 1;
            if (cand > best1[v]) { best2[v] = best1[v]; best1[v] = cand; who[v] = c; }
            else if (cand > best2[v]) { best2[v] = cand; }
        }

    std::vector<int> up(n, 0);
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        int siblings = (who[p] == v) ? best2[p] : best1[p];
        up[v] = 1 + std::max(up[p], siblings);
    }

    std::vector<int> ans(n);
    for (int v = 0; v < n; ++v) ans[v] = std::max(down[v], up[v]);
    return ans;
}
```

## Notes
**Direction.** A pre-order lists every vertex before its descendants. Reversed,
it lists every vertex after them, which is exactly the guarantee a subtree DP
needs: when `order[i]` is read, everything below it is already folded in. The
starter walks forwards, so `size[parent[v]] += size[v]` adds a 1 that has not
yet grown into anything, and every internal vertex comes out too small.

The symptom is diagnostic: the root is still correct on a path (each vertex has
one child, so the order happens to work out), and wrong on anything branchy.

**Both sides of the edge.** Rerooting across `(p, v)` splits the tree in two.
The starter counted the half that got closer and forgot that the other half got
further. Writing the transition as the sum of two movements —
`-size[v]` for the inside, `+(n - size[v])` for the outside — makes the
`2` appear on its own rather than being a constant to memorise.

**Why `max` needs two.** A sum can have a child's contribution subtracted out.
`max` cannot: the maximum of a set says nothing about the maximum of that set
with one element deleted. So you keep enough to answer the deletion — and for
"delete one element" that is precisely the top two.

The smallest failing case is three vertices in a path, rooted at the middle. Its
two children are equally deep, so whichever became `best1` leaves the other
invisible, and the starter reports the middle vertex's own depth instead of the
distance across to its sibling.

This generalises. For an arbitrary associative merge with no inverse, keep
prefix and suffix accumulations over each vertex's child list and combine
`prefix[i-1]` with `suffix[i+1]` to exclude child *i*. The top-two trick is that
idea specialised to `max`, where two values are all a prefix and suffix can ever
disagree about.
