---
id: bellman-ford-audit
title: "Three relaxations with negative weights"
difficulty: core
chapter: negative-weights
topics: [graphs, bellman-ford, algorithms]
check: unit
standard: c++20
---

Three routines over a directed graph whose weights may be negative. Edges are
given as `(from, to, weight)`.

- `distances(n, edges, src)` — the distance to every vertex, `-1` where
  unreachable. Relaxes out of unreachable vertices, so `INF + (a negative
  weight)` leaks in as a real-looking distance.
- `has_negative_cycle(n, edges)` — whether the graph contains a negative cycle
  **anywhere**. Searches from vertex 0 only, so a cycle in another component is
  invisible.
- `affected_by_negative_cycle(n, edges, src)` — for each vertex, 1 if it has no
  shortest path from `src` and 0 otherwise. Marks only the vertices where an
  edge still improves, without propagating downstream.

Assume there is no negative cycle for `distances`.

## Starter
```cpp
#include <algorithm>
#include <array>
#include <cstddef>
#include <limits>
#include <vector>

using Edges = std::vector<std::array<long long, 3>>;   // {from, to, weight}
const long long INF = std::numeric_limits<long long>::max() / 4;

std::vector<long long> distances(int n, const Edges& edges, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int round = 0; round + 1 < n; ++round)
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] + e[2] < dist[v]) dist[v] = dist[u] + e[2];   // even from INF
        }
    for (long long& x : dist) if (x >= INF) x = -1;
    return dist;
}

bool has_negative_cycle(int n, const Edges& edges) {
    std::vector<long long> dist(n, INF);
    dist[0] = 0;                                       // one source, not all of them
    for (int round = 0; round < n; ++round) {
        bool changed = false;
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] < INF && dist[u] + e[2] < dist[v]) {
                dist[v] = dist[u] + e[2];
                changed = true;
            }
        }
        if (!changed) return false;
    }
    return true;
}

std::vector<int> affected_by_negative_cycle(int n, const Edges& edges, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int round = 0; round + 1 < n; ++round)
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] < INF && dist[u] + e[2] < dist[v]) dist[v] = dist[u] + e[2];
        }

    std::vector<int> bad(n, 0);
    for (const auto& e : edges) {                      // one pass, no propagation
        int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
        if (dist[u] < INF && dist[u] + e[2] < dist[v]) bad[v] = 1;
    }
    return bad;
}
```

## Tests
```cpp
using L = std::vector<long long>;
using I = std::vector<int>;

// distances -- no negative cycles in these
CHECK_EQ(distances(4, Edges{{0, 1, 1}, {0, 2, 5}, {2, 1, -10}, {1, 3, 1}}, 0),
         (L{0, -5, 5, -4}));
CHECK_EQ(distances(2, Edges{{0, 1, -5}}, 0), (L{0, -5}));
CHECK_EQ(distances(1, Edges{}, 0), (L{0}));
CHECK_EQ(distances(3, Edges{{0, 1, 4}, {1, 2, -2}}, 0), (L{0, 4, 2}));
// Vertices 1, 2, 3 are unreachable, and the negative edges must not reach them.
CHECK_EQ(distances(4, Edges{{1, 2, -1}, {2, 3, -1}}, 0), (L{0, -1, -1, -1}));
CHECK_EQ(distances(3, Edges{{1, 2, -5}}, 0), (L{0, -1, -1}));

// has_negative_cycle
CHECK(!has_negative_cycle(4, Edges{{0, 1, 1}, {0, 2, 5}, {2, 1, -10}, {1, 3, 1}}));
CHECK(has_negative_cycle(3, Edges{{0, 1, 1}, {1, 2, -1}, {2, 1, -1}}));
CHECK(!has_negative_cycle(2, Edges{{0, 1, -5}}));
CHECK(!has_negative_cycle(1, Edges{}));
// The cycle is in a component the source cannot reach.
CHECK(has_negative_cycle(4, Edges{{1, 2, -1}, {2, 3, -1}, {3, 1, -1}}));
CHECK(has_negative_cycle(5, Edges{{0, 1, 1}, {1, 2, 1}, {2, 1, -2}, {2, 3, 1}, {0, 4, 2}}));

// affected_by_negative_cycle
CHECK_EQ(affected_by_negative_cycle(3, Edges{{0, 1, 1}, {1, 2, -1}, {2, 1, -1}}, 0),
         (I{0, 1, 1}));
// Vertex 3 hangs off the cycle and is affected too.
CHECK_EQ(affected_by_negative_cycle(
             5, Edges{{0, 1, 1}, {1, 2, 1}, {2, 1, -2}, {2, 3, 1}, {0, 4, 2}}, 0),
         (I{0, 1, 1, 1, 0}));
CHECK_EQ(affected_by_negative_cycle(4, Edges{{0, 1, 1}, {0, 2, 5}, {2, 1, -10}, {1, 3, 1}}, 0),
         (I{0, 0, 0, 0}));
CHECK_EQ(affected_by_negative_cycle(4, Edges{{1, 2, -1}, {2, 3, -1}, {3, 1, -1}}, 0),
         (I{0, 0, 0, 0}));
CHECK_EQ(affected_by_negative_cycle(1, Edges{}, 0), (I{0}));
```

## Hints
- Guard every relaxation with `dist[u] < INF`. Without it, `INF + (−1)` is less than `INF`, so an unreachable vertex hands out a distance it does not have.
- The test with edges only among vertices 1, 2 and 3 is the one that catches it: from vertex 0 nothing else is reachable, and the answer is `{0, -1, -1, -1}`.
- To find a negative cycle *anywhere*, start with `dist[v] = 0` for every `v`. That is the same as adding a virtual source joined to everything by zero-weight edges, and it reaches every component at once.
- With a virtual source no vertex is ever unreachable, so the `dist[u] < INF` guard becomes unnecessary there — though harmless.
- Being on a cycle is not the question. A vertex reachable *from* a cycle also has no shortest path, so the marking has to propagate: repeat the pass `n` times, and treat an edge out of an already-marked vertex as marking its target.
- Vertex 3 in the five-vertex case hangs off the cycle rather than sitting on it, and it is affected.

## Solution
```cpp
#include <algorithm>
#include <array>
#include <cstddef>
#include <limits>
#include <vector>

using Edges = std::vector<std::array<long long, 3>>;
const long long INF = std::numeric_limits<long long>::max() / 4;

std::vector<long long> distances(int n, const Edges& edges, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int round = 0; round + 1 < n; ++round)
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] < INF && dist[u] + e[2] < dist[v])       // only from reachable
                dist[v] = dist[u] + e[2];
        }
    for (long long& x : dist) if (x >= INF) x = -1;
    return dist;
}

bool has_negative_cycle(int n, const Edges& edges) {
    std::vector<long long> dist(n, 0);                 // a virtual source, everywhere
    for (int round = 0; round < n; ++round) {
        bool changed = false;
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] + e[2] < dist[v]) { dist[v] = dist[u] + e[2]; changed = true; }
        }
        if (!changed) return false;
    }
    return true;
}

std::vector<int> affected_by_negative_cycle(int n, const Edges& edges, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int round = 0; round + 1 < n; ++round)
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] < INF && dist[u] + e[2] < dist[v]) dist[v] = dist[u] + e[2];
        }

    std::vector<int> bad(n, 0);
    for (int round = 0; round < n; ++round)            // propagate downstream
        for (const auto& e : edges) {
            int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
            if (dist[u] < INF && (bad[u] || dist[u] + e[2] < dist[v])) {
                bad[v] = 1;
                dist[v] = std::min(dist[v], dist[u] + e[2]);
            }
        }
    return bad;
}
```

## Notes
**`INF` is a sentinel, and arithmetic on a sentinel is meaningless.** With
`dist[u] == INF` and a weight of −1, the expression `dist[u] + e[2]` is
`INF − 1`, which really is less than `INF` — so the relaxation fires and the
unreachable vertex `v` now holds a number. Later rounds treat it as real and
spread it further.

Two things stop it. The guard `dist[u] < INF` is the direct fix. And keeping
`INF` at `max() / 4` rather than `max()` means the arithmetic is at least *well
defined* while it is wrong, which is what makes the bug a wrong answer rather
than undefined behaviour.

**A virtual source reaches every component.** Bellman–Ford from vertex 0 finds
cycles reachable from vertex 0, which is what you want when the question is
about distances from a particular start. When the question is "does this graph
contain a negative cycle at all", initialise every distance to 0 instead: that
is exactly the graph with one extra vertex joined to all the others by
zero-weight edges, and it costs nothing to write.

The four-vertex case with a cycle among vertices 1, 2 and 3 and nothing leaving
vertex 0 is the separator: the answer is yes, and a search from vertex 0 sees an
empty graph.

**Downstream counts.** A vertex `v` has no shortest path from `src` when some
route to it can be made arbitrarily cheap — which happens if `v` is on a
negative cycle *or* reachable from one. So the marking must propagate along
edges, and running the pass `n` times is enough for the same reason `n − 1`
rounds suffice for the distances: any propagation path is simple.

A single pass marks only the immediate targets of still-improving edges. On the
five-vertex graph that misses vertex 3, which hangs off the cycle rather than
lying on it — and vertex 3's answer is genuinely −∞.
