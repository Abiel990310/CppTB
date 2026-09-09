---
title: "Bellman–Ford and Floyd–Warshall"
navTitle: "Negative weights"
summary: >-
  What to do when Dijkstra's precondition fails, and the two algorithms that do
  not need it.
objectives:
  - Relax every edge n-1 times, and detect a negative cycle with one more round
  - Mark the vertices that have no shortest path at all
  - Write Floyd-Warshall with the intermediate vertex in the outermost loop
  - Choose between all-pairs Floyd-Warshall and n runs of Dijkstra
status: complete
standard: c++20
requires: [dijkstra]
---

Chapter 10.21 ended on a four-vertex graph where Dijkstra answers 2 and the
truth is −4. This chapter is the two algorithms that handle that graph, and the
question of when each is the right one.

Both are older, slower and simpler than Dijkstra. Both are worth having.

## Relax everything, n − 1 times

```cpp run title="Bellman-Ford, and the round that detects a cycle"
#include <algorithm>
#include <cstdio>
#include <limits>
#include <random>
#include <vector>

struct Edge { int from, to; long long weight; };
const long long INF = std::numeric_limits<long long>::max() / 4;

int rounds_used = 0;

// n-1 rounds of relaxing every edge; a change in round n means a negative cycle.
std::pair<std::vector<long long>, bool> bellman_ford(int n, const std::vector<Edge>& edges,
                                                     int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    rounds_used = 0;
    for (int round = 0; round < n; ++round) {
        bool changed = false;
        for (const Edge& e : edges)
            if (dist[e.from] < INF && dist[e.from] + e.weight < dist[e.to]) {
                dist[e.to] = dist[e.from] + e.weight;
                changed = true;
            }
        ++rounds_used;
        if (!changed) return {dist, false};          // settled early: no negative cycle
        if (round == n - 1) return {dist, true};     // still improving after n-1 rounds
    }
    return {dist, false};
}

// Reference: the cheapest walk of at most n-1 edges, computed exhaustively.
std::vector<long long> brute(int n, const std::vector<Edge>& edges, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int i = 0; i < n - 1; ++i) {
        std::vector<long long> next = dist;
        for (const Edge& e : edges)
            if (dist[e.from] < INF)
                next[e.to] = std::min(next[e.to], dist[e.from] + e.weight);
        dist = next;
    }
    return dist;
}

int main() {
    // 0->1 (1), 0->2 (5), 2->1 (-10), 1->3 (1): the cheap route to 3 costs -4.
    std::vector<Edge> g{{0, 1, 1}, {0, 2, 5}, {2, 1, -10}, {1, 3, 1}};
    auto [d, cyc] = bellman_ford(4, g, 0);
    std::printf("distances:");
    for (long long x : d) std::printf(" %lld", x);
    std::printf("   negative cycle: %s (after %d rounds)\n", cyc ? "yes" : "no", rounds_used);

    // A negative cycle: 0->1 (1), 1->2 (-1), 2->1 (-1).
    std::vector<Edge> neg{{0, 1, 1}, {1, 2, -1}, {2, 1, -1}};
    auto [d2, cyc2] = bellman_ford(3, neg, 0);
    std::printf("with a negative cycle: detected = %s\n", cyc2 ? "yes" : "no");

    std::mt19937 rng(150);
    bool ok = true;
    int with_cycle = 0;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 7);
        std::vector<Edge> e;
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 35)
                    e.push_back({u, v, static_cast<long long>(rng() % 21) - 8});
        auto [a, c] = bellman_ford(n, e, 0);
        if (c) { ++with_cycle; continue; }           // brute force is only valid without one
        if (a != brute(n, e, 0)) ok = false;
    }
    std::printf("3000 random graphs with negative weights (%d had a negative cycle):\n"
                "  the rest match an exhaustive relaxation: %s\n",
                with_cycle, ok ? "yes" : "NO");
}
```

Correct distances on the graph that defeated Dijkstra, a negative cycle detected
on the graph that has one, and 3,000 random graphs with negative weights — 825
of them containing a negative cycle — agreeing with an exhaustive relaxation.

The algorithm is one loop inside another:

- **After `k` rounds, `dist[v]` is the cheapest walk to `v` using at most `k`
  edges.** That is the invariant, and it is why `n − 1` rounds suffice: a
  shortest path in a graph with no negative cycle is simple, so it has at most
  `n − 1` edges.
- **If round `n` still improves something, there is a negative cycle**, because
  an improvement needs a walk of `n` edges that beats every shorter one — and a
  walk of `n` edges in an `n`-vertex graph repeats a vertex.
- **If a round changes nothing, stop.** On the first graph here that happens
  after 2 rounds rather than 3. The early exit costs one boolean and turns the
  worst case O(n·m) into something usually much faster.

The guard `dist[e.from] < INF` matters: without it, `INF + weight` is computed
for every unreachable vertex, and with a negative weight that produces a value
*below* `INF` which then propagates as if it were a real distance.

## No shortest path at all

A negative cycle does not merely break the algorithm — it means some distances
do not exist. Going round the cycle once more is always cheaper, so the infimum
is −∞ and there is no shortest path to report.

```cpp run title="Marking the vertices with no answer"
#include <algorithm>
#include <cstdio>
#include <limits>
#include <random>
#include <vector>

struct Edge { int from, to; long long weight; };
const long long INF = std::numeric_limits<long long>::max() / 4;
const long long NEG = -INF;                       // "arbitrarily cheap"

// Distances, with NEG for vertices reachable from a negative cycle.
std::vector<long long> distances(int n, const std::vector<Edge>& edges, int src) {
    std::vector<long long> dist(n, INF);
    dist[src] = 0;

    for (int round = 0; round + 1 < n; ++round)
        for (const Edge& e : edges)
            if (dist[e.from] < INF && dist[e.from] + e.weight < dist[e.to])
                dist[e.to] = dist[e.from] + e.weight;

    // Anything that still improves is on or downstream of a negative cycle.
    for (int round = 0; round < n; ++round)
        for (const Edge& e : edges)
            if (dist[e.from] < INF &&
                (dist[e.from] == NEG || dist[e.from] + e.weight < dist[e.to]))
                dist[e.to] = NEG;

    return dist;
}

int main() {
    // 0 -> 1 (1); the cycle 1 -> 2 -> 1 costs -1; 2 -> 3 (1); 0 -> 4 (2), 4 is safe.
    std::vector<Edge> g{{0, 1, 1}, {1, 2, 1}, {2, 1, -2}, {2, 3, 1}, {0, 4, 2}};
    std::vector<long long> d = distances(5, g, 0);
    const char* names[5] = {"0", "1", "2", "3", "4"};
    for (int v = 0; v < 5; ++v) {
        if (d[v] == NEG) std::printf("vertex %s: no shortest path (a negative cycle)\n", names[v]);
        else if (d[v] >= INF) std::printf("vertex %s: unreachable\n", names[v]);
        else std::printf("vertex %s: %lld\n", names[v], d[v]);
    }

    // Cross-check: a vertex has a finite answer exactly when the cheapest walk
    // stops improving. Two hundred more relaxation rounds settle any graph this
    // small that has no negative cycle, and never settle one that has.
    std::mt19937 rng(180);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 6);
        std::vector<Edge> e;
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 40)
                    e.push_back({u, v, static_cast<long long>(rng() % 15) - 6});

        std::vector<long long> got = distances(n, e, 0);

        std::vector<long long> walk(n, INF);
        walk[0] = 0;
        std::vector<long long> early, late;
        for (int step = 0; step < 400; ++step) {
            std::vector<long long> next = walk;
            for (const Edge& x : e)
                if (walk[x.from] < INF)
                    next[x.to] = std::min(next[x.to], walk[x.from] + x.weight);
            walk = next;
            if (step + 1 == 200) early = walk;
        }
        late = walk;

        for (int v = 0; v < n; ++v) {
            bool unbounded = late[v] < early[v];
            if (unbounded && got[v] != NEG) ok = false;
            if (!unbounded && got[v] != late[v]) ok = false;
        }
    }
    std::printf("2000 random graphs: NEG marks exactly the unbounded vertices: %s\n",
                ok ? "yes" : "NO");
}
```

Vertices 1, 2 and 3 have no shortest path; vertex 4, reachable only by an edge
that avoids the cycle, has the ordinary answer 2. 2,000 random graphs confirm
that the marking is exactly right.

Two points about that second loop.

**Being on a cycle is not the question; being downstream of one is.** Vertex 3
is not on the cycle — it hangs off vertex 2 — and its distance is still
unbounded below, because any route to it can loop first. So the marking has to
*propagate*: once a vertex is `NEG`, every vertex it can reach is too. Running
the propagation `n` times is enough, for the same reason `n − 1` rounds suffice
above.

**"Still improving" is the detector, not "negative weight".** A graph can be
full of negative edges and have no negative cycle at all — the first sample's
graph is exactly that — and then every distance is perfectly well defined. It is
only a *cycle* of negative total weight that removes the answer.

## All pairs at once

Floyd–Warshall computes every pairwise distance in three nested loops. The order
of those loops is the algorithm.

```cpp run title="The intermediate vertex goes outermost"
#include <algorithm>
#include <array>
#include <cstdio>
#include <limits>
#include <random>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;
using Matrix = std::vector<std::vector<long long>>;

// The intermediate vertex k must be the OUTERMOST loop.
Matrix floyd(Matrix d) {
    int n = static_cast<int>(d.size());
    for (int k = 0; k < n; ++k)
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
    return d;
}

// The same three loops with k innermost -- a different, wrong algorithm.
Matrix floyd_wrong_order(Matrix d) {
    int n = static_cast<int>(d.size());
    for (int i = 0; i < n; ++i)
        for (int j = 0; j < n; ++j)
            for (int k = 0; k < n; ++k)
                if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
    return d;
}

Matrix from_edges(int n, const std::vector<std::array<long long, 3>>& edges) {
    Matrix d(n, std::vector<long long>(n, INF));
    for (int v = 0; v < n; ++v) d[v][v] = 0;
    for (const auto& e : edges) {
        int u = static_cast<int>(e[0]), v = static_cast<int>(e[1]);
        d[u][v] = std::min(d[u][v], e[2]);
    }
    return d;
}

int main() {
    // 0 -> 1 -> 3 -> 2, all of weight 1. The route to 2 passes through a
    // higher-numbered vertex, which the wrong loop order never considers.
    std::vector<std::array<long long, 3>> chain{{0, 1, 1}, {1, 3, 1}, {3, 2, 1}};
    Matrix good = floyd(from_edges(4, chain));
    Matrix bad = floyd_wrong_order(from_edges(4, chain));
    std::printf("distance 0 -> 2:  k outermost %lld,  k innermost %s\n",
                good[0][2], bad[0][2] >= INF ? "unreachable" : "?");

    std::mt19937 rng(160);
    int differed = 0, checked = 0;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 2 + static_cast<int>(rng() % 6);
        std::vector<std::array<long long, 3>> e;
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 35)
                    e.push_back({u, v, static_cast<long long>(1 + rng() % 9)});
        Matrix a = floyd(from_edges(n, e)), b = floyd_wrong_order(from_edges(n, e));
        if (a != b) ++differed;
        ++checked;
    }
    std::printf("%d random graphs: the two loop orders differ on %d of them\n",
                checked, differed);

    // Cross-check the correct one against repeated Bellman-Ford-style relaxation.
    bool ok = true;
    for (int trial = 0; trial < 1000; ++trial) {
        int n = 2 + static_cast<int>(rng() % 6);
        Matrix d(n, std::vector<long long>(n, INF));
        for (int v = 0; v < n; ++v) d[v][v] = 0;
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 40)
                    d[u][v] = static_cast<long long>(1 + rng() % 9);
        Matrix a = floyd(d);
        Matrix b = d;
        for (int round = 0; round < n; ++round)          // relax until stable
            for (int i = 0; i < n; ++i)
                for (int k = 0; k < n; ++k)
                    for (int j = 0; j < n; ++j)
                        b[i][j] = std::min(b[i][j], b[i][k] + b[k][j]);
        if (a != b) ok = false;
    }
    std::printf("1000 random graphs: k-outermost matches relax-until-stable: %s\n",
                ok ? "yes" : "NO");
}
```

With `k` outermost the distance from 0 to 2 is 3; with `k` innermost that route
is never found at all, and the two orders disagree on 524 of 2,000 random
graphs.

The reason is the invariant. **After the outer loop has processed `k = 0 … K`,
`d[i][j]` is the shortest path from `i` to `j` using only those vertices as
intermediates.** Each new `k` extends the permitted set by one vertex, and every
pair is updated against it before the set grows again.

Put `k` innermost and that invariant is gone: `d[i][j]` is finalised while
later-numbered vertices have not yet been considered as intermediates, and a
route through a higher-numbered vertex is simply missed. The four-vertex chain
`0 → 1 → 3 → 2` shows it — the route to 2 passes through vertex 3, which the
wrong order has not yet processed when it finalises `d[0][2]`.

Three practical notes:

- **`d[v][v] = 0` and everything else `INF`** to start, then the given edges.
  Keep the *smallest* weight when parallel edges appear.
- **`INF` must be `max() / 4`**, since `d[i][k] + d[k][j]` is computed for pairs
  that are both infinite.
- **Negative cycles show up as `d[v][v] < 0`** after the run, which is a
  one-line detector for the whole graph rather than one source.

## Which to use

```cpp run title="Floyd-Warshall against n runs of Dijkstra, on a dense graph"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <limits>
#include <queue>
#include <random>
#include <utility>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

const long long INF = std::numeric_limits<long long>::max() / 4;

int main() {
    const int n = 250;                       // dense: every pair joined
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    std::vector<std::vector<std::pair<int, long long>>> g(n);
    std::mt19937 rng(170);
    for (int v = 0; v < n; ++v) d[v][v] = 0;
    for (int u = 0; u < n; ++u)
        for (int v = 0; v < n; ++v)
            if (u != v) {
                long long w = 1 + static_cast<long long>(rng() % 1000);
                d[u][v] = w;
                g[u].emplace_back(v, w);
            }

    auto t0 = std::chrono::steady_clock::now();
    std::vector<std::vector<long long>> fw = d;
    for (int k = 0; k < n; ++k)
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (fw[i][k] + fw[k][j] < fw[i][j]) fw[i][j] = fw[i][k] + fw[k][j];
    auto t1 = std::chrono::steady_clock::now();

    std::vector<std::vector<long long>> dj(n, std::vector<long long>(n, INF));
    using Item = std::pair<long long, int>;
    for (int s = 0; s < n; ++s) {
        std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
        dj[s][s] = 0;
        pq.emplace(0, s);
        while (!pq.empty()) {
            auto [dd, v] = pq.top(); pq.pop();
            if (dd != dj[s][v]) continue;
            for (auto [to, w] : g[v])
                if (dd + w < dj[s][to]) { dj[s][to] = dd + w; pq.emplace(dj[s][to], to); }
        }
    }
    auto t2 = std::chrono::steady_clock::now();

    keep(fw); keep(dj);
    std::printf("n = %d, dense (%d edges)\n", n, n * (n - 1));
    std::printf("  Floyd-Warshall   %8.1f ms  (n^3 = %lld operations)\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(),
                static_cast<long long>(n) * n * n);
    std::printf("  n x Dijkstra     %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count());
    std::printf("  identical: %s\n", fw == dj ? "yes" : "NO");
}
```

538 ms against 2,387 ms on a dense 250-vertex graph, for identical matrices.

That result flips with the density. Floyd–Warshall is O(n³) whatever the edges;
`n` runs of Dijkstra are O(n·(n + m)·log n), which is better when `m` is small
and worse when `m` approaches `n²`. The crossover is roughly where `m log n`
exceeds `n²`, and in practice:

| Situation | Use |
|---|---|
| all pairs, `n ≤ 500`, any density | Floyd–Warshall |
| all pairs, sparse, `n` up to a few thousand | `n` × Dijkstra |
| one source, non-negative weights | Dijkstra (10.21) |
| one source, negative weights, no negative cycle | Bellman–Ford |
| detect a negative cycle anywhere | Floyd–Warshall, or Bellman–Ford from a virtual source |
| transitive closure only | Floyd–Warshall with `bool` and `|=` |

`n ≤ 500` is the usual signal for Floyd–Warshall: 1.25 × 10⁸ operations, each a
comparison and an addition on contiguous memory, which is fast in a way the
operation count understates. At `n = 1000` it is 10⁹ and marginal.

**The transitive-closure variant** is worth knowing: replace `long long` with
`bool` and the relaxation with `reach[i][j] = reach[i][j] || (reach[i][k] &&
reach[k][j])`. With `std::bitset<N>` per row it becomes `reach[i] |= reach[k]`
when `reach[i][k]`, which is 64 pairs per instruction — the fastest way to
compute reachability for `n` in the low thousands.

:::quiz
{
  "question": "You run Bellman-Ford for n-1 rounds on a graph with negative weights and no negative cycle, but omit the guard `if (dist[e.from] < INF)`. What can go wrong?",
  "options": [
    { "text": "`INF + weight` with a negative weight is smaller than `INF`, so unreachable vertices acquire finite-looking distances that then propagate as if real", "correct": true, "why": "The relaxation compares `dist[from] + w < dist[to]`, and with `dist[from] == INF` and `w` negative that is true. The vertex is not reachable at all, but the array now says otherwise, and later rounds spread the value." },
    { "text": "`INF + weight` overflows, which is undefined behaviour", "why": "It would if INF were `numeric_limits<long long>::max()`, which is exactly why INF is set to a quarter of that. With the usual sentinel there is no overflow — the problem is a wrong value, not an invalid one." },
    { "text": "Nothing: unreachable vertices stay at INF because no edge leads to them", "why": "Edges *out of* an unreachable vertex are still in the edge list and still relaxed. The guard is about the source of the edge, not the destination." },
    { "text": "The negative-cycle detection stops working, but the distances stay correct", "why": "The distances are the first casualty. Detection is affected too, since spurious improvements keep appearing, but the wrong answers come first." }
  ]
}
:::

## Practice

:::exercise bellman-ford-audit

:::exercise floyd-warshall-audit

:::exercise judge-negative-cycle

:::exercise judge-all-pairs

:::recap
- Bellman–Ford relaxes every edge `n − 1` times; after `k` rounds `dist[v]` is
  the cheapest walk of at most `k` edges. An improvement in round `n` proves a
  negative cycle, and a round that changes nothing means you can stop early.
- Guard the relaxation with `dist[e.from] < INF`, or unreachable vertices pick
  up finite-looking distances through negative edges.
- A negative cycle means some vertices have *no* shortest path. Mark them by
  propagating from any edge that still improves — being downstream of a cycle is
  enough, and vertex 3 in this chapter's sample is not on one.
- Floyd–Warshall's intermediate vertex `k` must be the outermost loop. Measured:
  the wrong order disagrees on 524 of 2,000 random graphs, and misses the route
  `0 → 1 → 3 → 2` entirely.
- On a dense 250-vertex graph, Floyd–Warshall took 538 ms against 2,387 ms for
  `n` runs of Dijkstra. The choice is density, not preference.
:::
