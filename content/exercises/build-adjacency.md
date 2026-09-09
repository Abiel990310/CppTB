---
id: build-adjacency
title: "Compressed adjacency, off by one"
difficulty: stretch
chapter: representing-graphs
topics: [graphs, prefix-sums, algorithms]
check: unit
standard: c++20
---

The compressed adjacency structure from this chapter: two flat arrays, `start`
of size `n + 1` and `target` of size `2m`, where the neighbours of `v` are
`target[start[v] … start[v+1])`.

- `compress(n, edges)` — build it from 0-indexed undirected edges. Accumulates
  the degree of `v` into `start[v]` rather than `start[v + 1]`, which makes the
  prefix sum land one slot early.
- `neighbours(csr, v)` — return `v`'s neighbours in stored order. Reads the
  block `[start[v - 1], start[v])`.

Self-loops appear once in the vertex's own list; edges are otherwise stored in
both directions.

## Starter
```cpp
#include <cstddef>
#include <utility>
#include <vector>

struct Csr {
    std::vector<int> start;      // n + 1 offsets
    std::vector<int> target;     // the neighbour blocks, back to back
};

Csr compress(int n, const std::vector<std::pair<int, int>>& edges) {
    Csr g;
    g.start.assign(n + 1, 0);

    for (auto [u, v] : edges) {
        ++g.start[u];                          // the degree of u belongs at u + 1
        if (u != v) ++g.start[v];
    }
    for (int i = 0; i < n; ++i) g.start[i + 1] += g.start[i];

    g.target.assign(g.start[n], 0);
    std::vector<int> cursor(g.start.begin(), g.start.end() - 1);
    for (auto [u, v] : edges) {
        g.target[cursor[u]++] = v;
        if (u != v) g.target[cursor[v]++] = u;
    }
    return g;
}

std::vector<int> neighbours(const Csr& g, int v) {
    return std::vector<int>(g.target.begin() + g.start[v == 0 ? 0 : v - 1],
                            g.target.begin() + g.start[v]);
}
```

## Tests
```cpp
using E = std::vector<std::pair<int, int>>;

// A path 0-1-2-3.
Csr path = compress(4, E{{0, 1}, {1, 2}, {2, 3}});
CHECK_EQ(path.start, (std::vector<int>{0, 1, 3, 5, 6}));
CHECK_EQ(neighbours(path, 0), (std::vector<int>{1}));
CHECK_EQ(neighbours(path, 1), (std::vector<int>{0, 2}));
CHECK_EQ(neighbours(path, 2), (std::vector<int>{1, 3}));
CHECK_EQ(neighbours(path, 3), (std::vector<int>{2}));

// A triangle.
Csr tri = compress(3, E{{0, 1}, {1, 2}, {2, 0}});
CHECK_EQ(tri.start, (std::vector<int>{0, 2, 4, 6}));
CHECK_EQ(neighbours(tri, 0), (std::vector<int>{1, 2}));
CHECK_EQ(neighbours(tri, 1), (std::vector<int>{0, 2}));
CHECK_EQ(neighbours(tri, 2), (std::vector<int>{1, 0}));

// Isolated vertices and a self-loop.
Csr odd = compress(4, E{{1, 1}, {2, 3}});
CHECK_EQ(odd.start, (std::vector<int>{0, 0, 1, 2, 3}));
CHECK_EQ(neighbours(odd, 0), (std::vector<int>{}));
CHECK_EQ(neighbours(odd, 1), (std::vector<int>{1}));
CHECK_EQ(neighbours(odd, 2), (std::vector<int>{3}));
CHECK_EQ(neighbours(odd, 3), (std::vector<int>{2}));

// No edges at all.
Csr empty = compress(2, E{});
CHECK_EQ(empty.start, (std::vector<int>{0, 0, 0}));
CHECK_EQ(neighbours(empty, 0), (std::vector<int>{}));
CHECK_EQ(neighbours(empty, 1), (std::vector<int>{}));

// Parallel edges are stored, not merged.
Csr multi = compress(2, E{{0, 1}, {0, 1}});
CHECK_EQ(multi.start, (std::vector<int>{0, 2, 4}));
CHECK_EQ(neighbours(multi, 0), (std::vector<int>{1, 1}));
CHECK_EQ(neighbours(multi, 1), (std::vector<int>{0, 0}));
```

## Hints
- The counting pass should leave `start[v + 1]` holding the degree of `v`, so that after the prefix sum `start[v]` is where `v`'s block begins. Increment `start[u + 1]`, not `start[u]`.
- Check the shape on the path graph: degrees are 1, 2, 2, 1, so `start` must come out as `{0, 1, 3, 5, 6}` — beginning at 0 and ending at `2m`.
- `neighbours(v)` reads `[start[v], start[v + 1])`. The starter's `v - 1` is the same off-by-one seen from the other end, and its special case for `v == 0` is the tell: a correct formula needs no special case.
- `start` has `n + 1` entries precisely so that `start[v + 1]` is always readable, including for the last vertex.
- The cursor array is a copy of the block starts, so `std::vector<int> cursor(g.start.begin(), g.start.end() - 1)` — `n` entries, not `n + 1`.
- The self-loop test pins the convention: vertex 1 appears once in its own list, so `start` for `{{1,1},{2,3}}` is `{0, 0, 1, 2, 3}`.

## Solution
```cpp
#include <cstddef>
#include <utility>
#include <vector>

struct Csr {
    std::vector<int> start;
    std::vector<int> target;
};

Csr compress(int n, const std::vector<std::pair<int, int>>& edges) {
    Csr g;
    g.start.assign(n + 1, 0);

    for (auto [u, v] : edges) {
        ++g.start[u + 1];                      // degree of u, shifted by one
        if (u != v) ++g.start[v + 1];
    }
    for (int i = 0; i < n; ++i) g.start[i + 1] += g.start[i];   // offsets

    g.target.assign(g.start[n], 0);
    std::vector<int> cursor(g.start.begin(), g.start.end() - 1);
    for (auto [u, v] : edges) {
        g.target[cursor[u]++] = v;
        if (u != v) g.target[cursor[v]++] = u;
    }
    return g;
}

std::vector<int> neighbours(const Csr& g, int v) {
    return std::vector<int>(g.target.begin() + g.start[v],
                            g.target.begin() + g.start[v + 1]);
}
```

## Notes
This is chapter 10.7's prefix sum with a graph on top, and it has the same
leading-zero discipline.

**Count into `start[v + 1]`, so the prefix sum produces starts.** After the
counting pass, `start[v + 1]` is the degree of `v` and `start[0]` is 0. The
prefix sum then makes `start[v]` the index where `v`'s block begins and
`start[v + 1]` the index one past its end — which is exactly the half-open range
every loop wants. Counting into `start[v]` instead shifts everything by one
vertex, so `start[0]` becomes the degree of vertex 0 rather than 0, and every
block boundary is wrong.

The invariant to check by hand: **`start[0] == 0` and `start[n] == 2m`** (minus
one per self-loop, with this convention). On the path graph that is 0 and 6, and
on a broken build the first of those fails immediately.

**A special case is a symptom.** `neighbours` in the starter needs
`v == 0 ? 0 : v - 1` because its formula is wrong; with the correct
`[start[v], start[v + 1])` there is nothing to special-case, and `start` having
`n + 1` entries is what guarantees `start[v + 1]` exists. Whenever a boundary
needs a conditional, check whether the indexing convention is off by one — the
conditional is usually patching the symptom.

**The cursor is a copy, and it must be.** `cursor[v]` starts at `start[v]` and
advances as neighbours are written, so at the end `cursor[v] == start[v + 1]`.
Writing into `start` directly would destroy the offsets you just computed; the
copy is `n` entries, and taking `g.start.end() - 1` rather than `g.start.end()`
keeps it that size.

**Why this layout at all.** Everything is two `std::vector<int>`s: no per-vertex
allocation, and the neighbour blocks are contiguous, so a traversal walks memory
in order. The chapter measures 745 ms against 80 ms to build and 70 ms against
16 ms to walk at n = 200,000. The cost is that the structure is fixed once
built — there is no `push_back` — which is fine for a graph read from input and
useless for one that grows.
