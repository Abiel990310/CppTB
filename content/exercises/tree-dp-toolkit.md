---
id: tree-dp-toolkit
title: "What the tree looks like from here"
difficulty: core
chapter: tree-dp-and-rerooting
topics: [graphs, trees, dynamic-programming]
check: unit
standard: c++20
---

Three questions about an unrooted tree, given as adjacency lists. Root it at
vertex 0 to compute them, but note that only the first answer depends on that
choice.

- `subtree_leaves(g)` — for each vertex, the number of leaves in its subtree
  when the tree is rooted at 0. A vertex with no children is a leaf and counts
  itself, so a one-vertex tree gives `{1}`.
- `largest_piece(g)` — for each vertex, the number of vertices in the **largest
  connected piece** that remains after deleting that vertex. Deleting `v` leaves
  one piece per child subtree, plus everything above `v`. Deleting the only
  vertex of a one-vertex tree leaves nothing, so the answer there is `{0}`.
- `centroid(g)` — the vertex whose `largest_piece` is smallest. On a tie, return
  the smaller index.

Each should run in time linear in the number of vertices; the checks include a
tree large enough that a per-vertex traversal would be noticeably slow.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

using Tree = std::vector<std::vector<int>>;

std::vector<long long> subtree_leaves(const Tree& g) {
    (void)g;
    return {};
}

std::vector<long long> largest_piece(const Tree& g) {
    (void)g;
    return {};
}

int centroid(const Tree& g) {
    (void)g;
    return -1;
}
```

## Tests
```cpp
//      0
//    /   \
//   1     2
//  / \     \
// 3   4     5
const Tree branchy{{1, 2}, {0, 3, 4}, {0, 5}, {1}, {1}, {2}};
const Tree centre3{{1, 2}, {0}, {0}};
const Tree star{{1, 2, 3, 4, 5}, {0}, {0}, {0}, {0}, {0}};
const Tree single{{}};
const Tree pair2{{1}, {0}};
const Tree path5{{1}, {0, 2}, {1, 3}, {2, 4}, {3}};

CHECK_EQ(subtree_leaves(branchy), (std::vector<long long>{3, 2, 1, 1, 1, 1}));
CHECK_EQ(subtree_leaves(centre3), (std::vector<long long>{2, 1, 1}));
CHECK_EQ(subtree_leaves(star), (std::vector<long long>{5, 1, 1, 1, 1, 1}));
CHECK_EQ(subtree_leaves(single), (std::vector<long long>{1}));
CHECK_EQ(subtree_leaves(pair2), (std::vector<long long>{1, 1}));
CHECK_EQ(subtree_leaves(path5), (std::vector<long long>{1, 1, 1, 1, 1}));

CHECK_EQ(largest_piece(branchy), (std::vector<long long>{3, 3, 4, 5, 5, 5}));
CHECK_EQ(largest_piece(centre3), (std::vector<long long>{1, 2, 2}));
CHECK_EQ(largest_piece(star), (std::vector<long long>{1, 5, 5, 5, 5, 5}));
CHECK_EQ(largest_piece(single), (std::vector<long long>{0}));
CHECK_EQ(largest_piece(pair2), (std::vector<long long>{1, 1}));
CHECK_EQ(largest_piece(path5), (std::vector<long long>{4, 3, 2, 3, 4}));

CHECK_EQ(centroid(branchy), 0);
CHECK_EQ(centroid(star), 0);
CHECK_EQ(centroid(single), 0);
CHECK_EQ(centroid(pair2), 0);      // both pieces are size 1; the smaller index wins
CHECK_EQ(centroid(path5), 2);      // the middle of a path

// A path of 100000 vertices: linear is required, and so is an iterative walk.
Tree long_path(100000);
for (int v = 1; v < 100000; ++v) {
    long_path[v - 1].push_back(v);
    long_path[v].push_back(v - 1);
}
CHECK_EQ(centroid(long_path), 49999);
CHECK_EQ(largest_piece(long_path)[0], 99999LL);
CHECK_EQ(subtree_leaves(long_path)[0], 1LL);
```

## Hints
- All three start the same way: one iterative DFS from vertex 0 recording the pre-order and each vertex's parent, then the pre-order walked backwards to fold children into parents.
- A vertex is a leaf when it has no children *in the rooted tree* — so every neighbour except its parent. The root of a one-vertex tree qualifies.
- Deleting `v` cuts every edge at `v`. The pieces are its child subtrees, of sizes `size[c]`, and one more piece holding everything else: `n - size[v]` vertices.
- For the root that last piece is `n - n == 0`, which drops out of the maximum on its own — no special case needed.
- `centroid` is a `std::min_element` over `largest_piece`, and `min_element` already returns the first of equal values, which is the tie rule.
- The 100,000-vertex path is there to catch a recursive DFS. Chapter 10.18 explains why that shape is the one that overflows.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

using Tree = std::vector<std::vector<int>>;

// Pre-order from vertex 0, with each vertex's parent.
static void walk(const Tree& g, std::vector<int>& order, std::vector<int>& parent) {
    int n = static_cast<int>(g.size());
    order.clear();
    order.reserve(n);
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

std::vector<long long> subtree_leaves(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);

    std::vector<long long> leaves(n, 0);
    for (int v = 0; v < n; ++v) {
        bool has_child = false;
        for (int c : g[v])
            if (c != parent[v]) { has_child = true; break; }
        if (!has_child) leaves[v] = 1;
    }
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i];
        leaves[parent[v]] += leaves[v];
    }
    return leaves;
}

std::vector<long long> largest_piece(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> order, parent;
    walk(g, order, parent);

    std::vector<long long> size(n, 1);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i];
        size[parent[v]] += size[v];
    }

    std::vector<long long> best(n, 0);
    for (int v = 0; v < n; ++v) {
        long long m = n - size[v];                 // everything above v
        for (int c : g[v])
            if (c != parent[v]) m = std::max(m, size[c]);
        best[v] = m;
    }
    return best;
}

int centroid(const Tree& g) {
    std::vector<long long> best = largest_piece(g);
    return static_cast<int>(std::min_element(best.begin(), best.end()) - best.begin());
}
```

## Notes
**One walk, three answers.** Every routine here is the same two lines of
plumbing — a pre-order with parents, then that order reversed — with a different
combine step. Once you have written it twice you stop thinking of it as an
algorithm and start thinking of it as the shape a tree question has.

**The piece above.** `largest_piece` is the one that generalises. Deleting a
vertex splits the tree into its child subtrees plus one more piece, and that
last piece is the whole point of rerooting: its size is `n - size[v]`, known
without looking at it. Every rerooting transition is some version of "and the
rest of the tree, which I can describe by subtraction".

For the root the outside piece is empty, and `n - size[root]` is 0, so the
maximum ignores it. Special-casing the root here is a common way to introduce a
bug rather than avoid one.

**The centroid.** The vertex minimising `largest_piece` has a property worth
knowing: its largest remaining piece is at most ⌊n/2⌋, always. That is what
makes centroid decomposition work — recursing into pieces that each at most
halve gives O(log n) depth — and chapter 10.35 builds on exactly this function.

A tree has one centroid or two, never more. `path5` has one, at index 2;
`pair2` has two, and the tie rule picks the smaller index.

**Why the long path is in the tests.** Correct and linear are different claims,
and only one of them is checked by six-vertex examples. The path also fails a
recursive implementation outright — 100,000 frames is past what the stack holds
under the sanitizers this runner uses, which is chapter 10.18's argument for
writing the iterative form first rather than converting later.
