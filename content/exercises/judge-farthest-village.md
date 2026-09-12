---
id: judge-farthest-village
title: "The farthest village"
difficulty: core
chapter: tree-dp-and-rerooting
topics: [graphs, trees, dynamic-programming, io]
check: output
standard: c++20
timeLimitMs: 3000
---

The same country: `n` villages, `n − 1` roads, all connected. For **every**
village, print the distance to the village furthest from it.

**Input.** The first line contains `n`. Each of the next `n − 1` lines contains
`u` and `v`: a road between villages `u` and `v`.

**Output.** One line with `n` integers separated by single spaces — the answer
for village 1, then village 2, and so on. A country with one village answers
`0`.

**Constraints.** `1 ≤ n ≤ 200000`. The roads always form a tree.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i + 1 < n; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
        g[v - 1].push_back(u - 1);
    }

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    order.reserve(n);
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    // How deep each vertex can go within its own subtree.
    std::vector<int> down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        down[p] = std::max(down[p], down[v] + 1);
    }

    // The deepest branch leaving each vertex downwards, and which child gave it.
    std::vector<int> best1(n, 0), who(n, -1);
    for (int v = 0; v < n; ++v)
        for (int c : g[v]) {
            if (c == parent[v]) continue;
            if (down[c] + 1 > best1[v]) { best1[v] = down[c] + 1; who[v] = c; }
        }

    std::vector<int> up(n, 0);
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        int siblings = (who[p] == v) ? 0 : best1[p];   // what is left if v is excluded?
        up[v] = 1 + std::max(up[p], siblings);
    }

    for (int v = 0; v < n; ++v)
        std::cout << std::max(down[v], up[v]) << " \n"[v + 1 == n];
}
```

## Cases

### Sample
```in
6
1 2
1 3
2 4
2 5
3 6
```
```out
2 3 3 4 4 4
```

### one village
```in
1
```
```out
0
```

### two villages
```in
2
1 2
```
```out
1 1
```

### two equal branches
```in
3
1 2
1 3
```
```out
1 2 2
```

### a star
```in
6
1 2
1 3
1 4
1 5
1 6
```
```out
1 2 2 2 2 2
```

### a path
```in
7
1 2
2 3
3 4
4 5
5 6
6 7
```
```out
6 5 4 3 4 5 6
```

### roads in scrambled order
```in
8
7 8
3 6
1 3
4 7
2 4
1 2
5 6
```
```out
4 4 5 5 7 6 6 7
```

### a bigger tree
```in
40
13 29
11 17
11 20
6 28
21 34
2 23
4 24
5 37
18 27
6 16
13 26
30 32
8 15
1 2
5 6
3 7
1 30
7 31
3 9
3 8
11 13
13 22
2 11
35 39
13 18
7 14
4 35
12 33
30 38
25 40
8 12
3 19
1 5
8 10
19 21
2 3
11 25
23 36
3 4
```
```out
5 4 5 6 6 7 6 6 6 7 5 7 6 7 7 8 6 7 6 6 7 7 5 7 6 7 8 8 7 6 7 7 8 8 7 6 7 7 8 7
```

## Hints
- The answer for a village is the better of two directions: the deepest it can go inside its own subtree (`down`), and the deepest it can go by stepping to its parent first (`up`).
- Going up from `v` means reaching `p`, then either continuing up past `p`, or turning down into one of `v`'s **siblings**. Both options are one step plus something already known.
- "One of `v`'s siblings" is the part the starter gets wrong. It keeps only the single deepest branch of `p`, so when `v` *is* that branch there is nothing to fall back on and it uses 0.
- Keep the best **two** branch depths at each vertex. Excluding a child is then a lookup: if it was the best, use the second best; otherwise use the best.
- The case `two equal branches` is the smallest input that separates the two versions — three villages in a row, answered from the middle.
- A vertex with one child has no second branch and its `best2` stays 0, which is the correct fallback, so no extra case is needed.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i + 1 < n; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
        g[v - 1].push_back(u - 1);
    }

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    order.reserve(n);
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    std::vector<int> down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        down[p] = std::max(down[p], down[v] + 1);
    }

    // best1 >= best2: the two deepest branches leaving v downwards.
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

    for (int v = 0; v < n; ++v)
        std::cout << std::max(down[v], up[v]) << " \n"[v + 1 == n];
}
```

## Notes
**`max` has no inverse.** That single fact is the whole problem. In the
sum-of-distances version, a child's contribution can be removed by subtracting
it. Here it cannot: knowing the maximum over a vertex's branches tells you
nothing about the maximum over those branches with one removed.

So you keep enough information to answer the removal. For "remove exactly one",
the best two values are exactly enough — whatever you delete, one of them
survives.

**The three-village case.** Root `1 — 2 — 3` at village 1's neighbour and both
its branches are equally deep. Whichever became `best1` leaves the other
invisible to the starter, which then reports village 1's answer as 1 instead of
2. It is the smallest tree that separates the two programs, and it is in the
cases for that reason.

**The general form.** When the merge is associative but has no inverse and the
"best two" trick does not apply — a modular product, a matrix multiplication,
a min-plus combination — build **prefix and suffix accumulations** over each
vertex's child list and combine `prefix[i-1]` with `suffix[i+1]` to exclude
child *i*. The total work is still linear, because each vertex's child list is
scanned a constant number of times and the lists sum to `n − 1`.

**What falls out.** The largest value printed is the tree's **diameter**, and
the vertices achieving the smallest are its **centres**. Both come free from the
same two sweeps, which is a good reason to reach for this rather than the
two-BFS trick when a problem wants more than the diameter alone.

**What these cases check.** Correctness, including the tie that breaks the
naive version, a path, a star, `n = 1`, and roads listed in arbitrary order.
They do not enforce the linear bound — the input needed to time out a
per-vertex traversal will not fit legibly in this file — so the 200,000 limit
in the statement is the one a real judge applies, not one these cases prove.
