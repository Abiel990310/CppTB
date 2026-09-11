---
id: judge-network-cost
title: "Cabling the town"
difficulty: core
chapter: minimum-spanning-trees
topics: [graphs, mst, kruskal, io]
check: output
standard: c++20
timeLimitMs: 3000
---

A town wants every building connected, directly or indirectly, for the least
total cost. Print that cost, or `-1` if some building cannot be reached at all.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `u`, `v` and `w`: a possible cable between buildings `u` and `v`
costing `w`.

**Output.** One line: the least total cost, or `-1` when the buildings cannot
all be connected.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`, `0 ≤ w ≤ 10⁹`. There may be
several cables between the same pair, and a cable may join a building to
itself.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

struct Edge { int u, v; long long w; };

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<Edge> edges(m);
    for (Edge& e : edges) {
        std::cin >> e.u >> e.v >> e.w;
        --e.u;
        --e.v;
    }

    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });

    std::vector<int> parent(n);
    std::iota(parent.begin(), parent.end(), 0);
    auto find = [&](int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    };

    long long total = 0;
    for (const Edge& e : edges) {
        int a = find(e.u), b = find(e.v);
        parent[b] = a;                     // united whether or not it was needed
        total += e.w;
    }

    std::cout << total << '\n';            // and never reports -1
}
```

## Cases

### Sample
```in
4 5
1 2 1
2 3 2
3 4 3
4 1 4
1 3 10
```
```out
6
```

### the expensive shortcut is never worth it
```in
3 3
1 2 2
2 3 2
1 3 3
```
```out
4
```

### one building is unreachable
```in
4 2
1 2 1
2 3 1
```
```out
-1
```

### a single building needs no cable
```in
1 0
```
```out
0
```

### no cables at all, and more than one building
```in
3 0
```
```out
-1
```

### parallel cables, cheapest wins
```in
2 3
1 2 9
1 2 4
1 2 7
```
```out
4
```

### a cable to itself is useless
```in
3 3
1 1 1
1 2 5
2 3 5
```
```out
10
```

### free cables
```in
4 3
1 2 0
2 3 0
3 4 0
```
```out
0
```

### a total no int can hold
```in
4 3
1 2 1000000000
2 3 1000000000
3 4 1000000000
```
```out
3000000000
```

### already a tree, so every cable is needed
```in
5 4
1 2 7
2 3 7
3 4 7
4 5 7
```
```out
28
```

## Hints
- The starter unites every pair whether or not they were already connected, so
  it charges for cables that close a cycle. `find(a) == find(b)` is the test.
- It also never prints `-1`. A spanning tree of `n` buildings uses exactly
  `n - 1` cables; count the ones you keep, and if that count is short, the town
  is not connectable.
- `n = 1` needs zero cables, which the `n - 1` rule already gives you.
- A cable from a building to itself joins a component to itself, so the same
  `find(a) == find(b)` test rejects it. No special case.
- 200,000 cables of 10⁹ each overflow a 32-bit total. The weight itself fits in
  `int`; the sum does not.
- `std::cin >> ` on 200,000 lines is fine with `sync_with_stdio(false)`, which
  the starter already does.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

struct Edge { int u, v; long long w; };

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<Edge> edges(m);
    for (Edge& e : edges) {
        std::cin >> e.u >> e.v >> e.w;
        --e.u;
        --e.v;
    }

    std::sort(edges.begin(), edges.end(),
              [](const Edge& a, const Edge& b) { return a.w < b.w; });

    std::vector<int> parent(n);
    std::vector<int> size(n, 1);
    std::iota(parent.begin(), parent.end(), 0);

    auto find = [&](int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    };

    long long total = 0;
    int taken = 0;
    for (const Edge& e : edges) {
        int a = find(e.u), b = find(e.v);
        if (a == b) continue;                      // already connected
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        total += e.w;
        ++taken;
    }

    std::cout << (taken == n - 1 ? total : -1) << '\n';
}
```

## Notes
This is Kruskal with the two lines that distinguish a working submission from a
plausible one.

**`if (a == b) continue;`** is the algorithm. Without it the routine unites
things that were already united — harmless for the DSU, which just overwrites a
root that was already correct — and charges for the cable anyway. On the sample
that gives 20 instead of 6, so it fails loudly; on a sparse graph that is nearly
a tree it gives something only slightly too large, which is the version that
gets submitted.

**`taken == n - 1`** is the connectivity check, and it is free. A spanning
forest of a graph with `c` components has `n - c` edges, so a short count means
`c > 1` and the answer is `-1`. There is no need for a separate BFS: Kruskal has
already computed the component structure by the time it finishes. Note that
`n = 1` needs `taken == 0`, which the same expression gives.

The overflow case is the one that separates this from the textbook version.
Each weight is at most 10⁹, which fits an `int`, and 199,999 of them do not fit
in one — the total needs `long long`. Reading into an `int` and accumulating
into a `long long` would also work; reading into a `long long` from the start is
one fewer thing to get wrong, and the input parsing is not the bottleneck.

Self-loops and parallel cables need no code at all. A self-loop fails the
`a == b` test like any other cycle-closing edge, and parallel cables are simply
several edges between the same pair — the sort puts the cheapest first, it is
taken, and the rest fail `a == b` afterwards. Every special case a beginner
writes for these is a special case that can be wrong.
